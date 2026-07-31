import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildPaymentRow } from "@/lib/chain";
import { getSessionInfo } from "@/lib/auth";

// POST { txHash } — the caller only sends the hash; everything stored is
// rebuilt from the chain server-side (receipt + USDC Transfer events).
// Admin-only: the live portal files receipts through PATCH /api/payroll-runs/[id]
// instead, so this is a manual/ops ingest path and must not be open to anyone.
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
        if (s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const body = await req.json();
        const txHash: string | undefined = body?.txHash;
        if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
            return NextResponse.json({ error: "txHash must be a 66-character transaction hash" }, { status: 400 });
        }

        const row = await buildPaymentRow(txHash as `0x${string}`);
        const { data, error } = await getSupabase()
            .from("payments")
            .upsert(row, { onConflict: "tx_hash" })
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ payment: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const supabase = getSupabase();
        let q = supabase.from("payments").select("*").order("paid_at", { ascending: false });
        if (s.role !== "globepay_admin") q = q.eq("client_id", s.clientId!);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        let payments = data || [];

        // On testnet every recipient gets a flat 1 USDC, so the on-chain amount
        // is not the figure anyone was actually owed. The payroll run holds the
        // real USD per person — attach it by tx_hash so receipts can show it.
        // Payments with no run behind them (e.g. imported from the chain before
        // runs existed) simply keep their on-chain amount.
        if (payments.length) {
            const hashes = payments.map((p) => p.tx_hash).filter(Boolean);
            const { data: runs } = await supabase
                .from("payroll_runs").select("tx_hash, line_items, total_amount, note").in("tx_hash", hashes);

            const byHash = new Map(
                (runs || []).filter((r) => r.tx_hash).map((r) => [r.tx_hash.toLowerCase(), r]),
            );
            payments = payments.map((p) => {
                const run = p.tx_hash ? byHash.get(p.tx_hash.toLowerCase()) : undefined;
                if (!run) return p;
                const intendedByWallet = new Map<string, number>(
                    (run.line_items || []).map((li: { wallet: string; amount: number }) => [li.wallet.toLowerCase(), li.amount]),
                );
                return {
                    ...p,
                    intended_total: Number(run.total_amount),
                    run_note: run.note ?? null,
                    recipients: (p.recipients || []).map((r: { wallet: string }) => ({
                        ...r,
                        intended_amount: intendedByWallet.get(r.wallet.toLowerCase()) ?? null,
                    })),
                };
            });
        }

        // Attach the paying client's HQ country for everyone (it drives which
        // fiat the network fee is shown in), but only label rows with the
        // client's *name* for admins — in a client's own portal that's noise.
        if (payments.length) {
            const { data: clients } = await supabase.from("clients").select("id, company_name, home_country");
            const byId = new Map((clients || []).map((c) => [c.id, c]));
            payments = payments.map((p) => {
                const c = p.client_id ? byId.get(p.client_id) : undefined;
                return {
                    ...p,
                    client_name: s.role === "globepay_admin" ? c?.company_name ?? null : null,
                    client_country: c?.home_country ?? null,
                };
            });
        }
        return NextResponse.json({ payments });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
