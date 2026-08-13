// The evidence behind a green tick, re-checked on the spot.
//
// Storing "verified: true" and showing a tick asks everyone to trust our
// database. What was actually kept is better than that: the exact sentence the
// freelancer signed and the signature they produced. From those two things the
// signer can be recovered by anyone, at any time, without us — so this endpoint
// re-runs the check live rather than reporting what we concluded months ago.
//
// That matters when it is disputed. "Our records say she confirmed it" is an
// assertion; "here is the sentence, here is the signature, and it still checks
// out against her address" is proof.
import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";

const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});

export type VerificationProof = {
    name: string;
    wallet: string;
    verifiedAt: string | null;
    message: string | null;
    signature: string | null;
    /** Re-run now, not read from a flag. */
    stillValid: boolean;
    /** Why it isn't provable, when it isn't. */
    note: string;
};

export async function GET(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const id = new URL(req.url).searchParams.get("contractorId");
        if (!id) return NextResponse.json({ error: "contractorId is required" }, { status: 400 });

        const { data: c } = await getSupabase().from("contractors")
            .select("id, name, wallet, client_id, verified_wallet, wallet_verified_at, verification_message, verification_sig")
            .eq("id", id).single();
        if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

        // Same rule as everywhere else: a client sees only their own people.
        if (s.role !== "globepay_admin" && c.client_id !== s.clientId) {
            return NextResponse.json({ error: "That freelancer belongs to another client" }, { status: 403 });
        }

        const proof: VerificationProof = {
            name: c.name,
            wallet: c.wallet,
            verifiedAt: c.wallet_verified_at,
            message: c.verification_message,
            signature: c.verification_sig,
            stillValid: false,
            note: "",
        };

        if (!c.wallet_verified_at || !c.verification_message || !c.verification_sig) {
            proof.note = "This wallet hasn't been confirmed yet.";
            return NextResponse.json({ proof });
        }

        // The signature covers one exact address. If the roster address was
        // edited afterwards, the proof no longer describes what we would pay —
        // which is the case a stored boolean would happily keep calling verified.
        if (!c.verified_wallet || c.verified_wallet.toLowerCase() !== String(c.wallet).toLowerCase()) {
            proof.note = "The wallet on the roster has changed since this was signed, so the proof no longer covers it.";
            return NextResponse.json({ proof });
        }

        if (!isAddress(c.wallet)) {
            proof.note = "The stored address isn't a valid wallet address.";
            return NextResponse.json({ proof });
        }

        try {
            proof.stillValid = await publicClient.verifyMessage({
                address: c.wallet as `0x${string}`,
                message: c.verification_message,
                signature: c.verification_sig as `0x${string}`,
            });
            proof.note = proof.stillValid
                ? ""
                : "The signature no longer checks out against this address.";
        } catch {
            // A smart-contract wallet is verified by asking the chain, so this
            // check needs the network. Say that rather than implying the proof
            // is bad when it is the connection that failed.
            proof.note = "Couldn't reach the network to re-check just now. The signature below is unchanged — try again in a moment.";
        }

        return NextResponse.json({ proof });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
