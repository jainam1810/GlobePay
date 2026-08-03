import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { guard, ipOf } from "@/lib/rate-limit";
import { VERIFY_TOKEN_TTL_HOURS, verificationMessage } from "@/lib/wallet-verification";

// Two halves of the same flow:
//
//   POST  { contractorId }             — signed in. Mints a one-time link to
//                                        send the freelancer.
//   GET   ?token=…                     — public. Returns what to sign.
//   PUT   { token, signature, address} — public. Checks the signature.
//
// The GET and PUT are deliberately unauthenticated: the freelancer being asked
// to prove the wallet is not a GlobePay user and never will be. The token is
// the only credential, it is single-use, and it expires.

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

const expired = (at: string | null) =>
    !at || Date.now() - new Date(at).getTime() > VERIFY_TOKEN_TTL_HOURS * 3600_000;

/** Mint a verification link for one freelancer. */
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { contractorId } = await req.json();
        if (!contractorId) return NextResponse.json({ error: "contractorId is required" }, { status: 400 });

        const supabase = getSupabase();
        const { data: c } = await supabase.from("contractors").select("*").eq("id", contractorId).single();
        if (!c) return NextResponse.json({ error: "Freelancer not found" }, { status: 404 });
        if (s.role !== "globepay_admin" && c.client_id !== s.clientId) {
            return NextResponse.json({ error: "That freelancer belongs to another client" }, { status: 403 });
        }

        const token = crypto.randomUUID();
        const { error } = await supabase.from("contractors")
            .update({ verify_token: token, verify_token_at: new Date().toISOString() })
            .eq("id", contractorId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ token, expiresInHours: VERIFY_TOKEN_TTL_HOURS });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

/** Public: what am I being asked to confirm? */
export async function GET(req: Request) {
    try {
        const token = new URL(req.url).searchParams.get("token");
        if (!token) return NextResponse.json({ error: "Missing link" }, { status: 400 });

        const supabase = getSupabase();
        const { data: c } = await supabase.from("contractors")
            .select("id, name, wallet, client_id, verify_token_at, wallet_verified_at, verified_wallet")
            .eq("verify_token", token).single();

        if (!c) return NextResponse.json({ error: "This link isn't valid. Ask whoever sent it for a new one." }, { status: 404 });
        if (expired(c.verify_token_at)) {
            return NextResponse.json({ error: "This link has expired. Ask for a fresh one — they're quick to send." }, { status: 410 });
        }

        const { data: client } = await supabase.from("clients")
            .select("company_name").eq("id", c.client_id).single();

        // Deliberately narrow: a name, a company and the wallet already on file.
        // Nothing about amounts, other freelancers, or anyone's history — this
        // endpoint has no session behind it.
        return NextResponse.json({
            name: c.name,
            company: client?.company_name ?? "your client",
            wallet: c.wallet,
            alreadyVerified: !!c.wallet_verified_at && c.verified_wallet?.toLowerCase() === c.wallet?.toLowerCase(),
            message: verificationMessage({
                name: c.name,
                company: client?.company_name ?? "your client",
                wallet: c.wallet,
                issuedAt: new Date(c.verify_token_at!).toISOString().slice(0, 10),
            }),
        });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

/** Public: here is my signature. */
export async function PUT(req: Request) {
    try {
        // Public and unauthenticated — the token is the only credential, so
        // IP is the identity we have. Each attempt costs an on-chain call
        // through verifyMessage, which is the reason for a ceiling.
        const over = await guard("verify", ipOf(req));
        if (over) return over;

        const { token, signature, address } = await req.json();
        if (!token || !signature || !address) {
            return NextResponse.json({ error: "Missing token, signature or address" }, { status: 400 });
        }
        if (!isAddress(address)) {
            return NextResponse.json({ error: "That isn't a valid wallet address" }, { status: 400 });
        }

        const supabase = getSupabase();
        const { data: c } = await supabase.from("contractors")
            .select("id, name, wallet, client_id, verify_token_at")
            .eq("verify_token", token).single();

        if (!c) return NextResponse.json({ error: "This link isn't valid" }, { status: 404 });
        if (expired(c.verify_token_at)) return NextResponse.json({ error: "This link has expired" }, { status: 410 });

        // The whole point. The signer must be the address we intend to pay —
        // signing from some *other* wallet they happen to own proves nothing
        // about the one on the payroll.
        if (address.toLowerCase() !== String(c.wallet).toLowerCase()) {
            return NextResponse.json({
                error: "That's a different wallet from the one on file. Switch to the account your client has listed, or ask them to update it first.",
            }, { status: 409 });
        }

        const { data: client } = await supabase.from("clients")
            .select("company_name").eq("id", c.client_id).single();

        const message = verificationMessage({
            name: c.name,
            company: client?.company_name ?? "your client",
            wallet: c.wallet,
            issuedAt: new Date(c.verify_token_at!).toISOString().slice(0, 10),
        });

        // verifyMessage rather than a bare ecrecover: it handles plain wallets,
        // deployed smart accounts (ERC-1271) and not-yet-deployed ones
        // (ERC-6492). A freelancer paid into a Safe would fail a naive check.
        const valid = await publicClient.verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        }).catch(() => false);

        if (!valid) {
            return NextResponse.json({
                error: "That signature didn't check out. Make sure you're signing from the wallet shown above.",
            }, { status: 400 });
        }

        const { error } = await supabase.from("contractors").update({
            wallet_verified_at: new Date().toISOString(),
            verified_wallet: c.wallet,
            verification_message: message,
            verification_sig: signature,
            // Single use: the proof is recorded, so the link is spent.
            verify_token: null,
            verify_token_at: null,
        }).eq("id", c.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ ok: true, name: c.name });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
