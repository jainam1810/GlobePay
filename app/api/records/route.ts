import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";

// The tax/compliance ledger. Rows are written automatically when a payroll
// run executes (see /api/payroll-runs/[id]) — immutable snapshots with the
// tx hash as on-chain anchor. Clients see their own; GlobePay sees all.
export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const supabase = getSupabase();
        let q = supabase.from("records").select("*").order("created_at", { ascending: false });
        if (s.role !== "globepay_admin") q = q.eq("client_id", s.clientId!);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        let records = data || [];

        // Two things the ledger row doesn't carry itself, both of which an audit
        // pack needs:
        //   paid_at — invoice_date is a DATE with no time of day. The
        //             audit-defensible moment is when the money actually moved,
        //             i.e. the block timestamp on the linked payment.
        //   wallet  — which address actually received it. That lives on the
        //             payment's recipient list, matched back by name.
        if (records.length) {
            const hashes = records.map((r) => r.tx_hash).filter(Boolean);
            if (hashes.length) {
                const { data: paid } = await supabase
                    .from("payments").select("tx_hash, paid_at, recipients").in("tx_hash", hashes);

                const byHash = new Map((paid || []).map((p) => [p.tx_hash.toLowerCase(), p]));
                records = records.map((r) => {
                    const p = r.tx_hash ? byHash.get(r.tx_hash.toLowerCase()) : undefined;
                    const match = (p?.recipients || []).find(
                        (x: { name: string | null }) => x.name && r.payee_name &&
                            x.name.trim().toLowerCase() === r.payee_name.trim().toLowerCase(),
                    );
                    return {
                        ...r,
                        paid_at: p?.paid_at ?? null,
                        // Fall back to the sole recipient when a single-person run
                        // has no name on it; anything ambiguous stays null rather
                        // than guessing which address was paid.
                        payee_wallet: match?.wallet
                            ?? (p?.recipients?.length === 1 ? p.recipients[0].wallet : null)
                            ?? null,
                    };
                });
            }
        }

        if (s.role === "globepay_admin" && records.length) {
            const { data: clients } = await supabase.from("clients").select("id, company_name");
            const names = new Map((clients || []).map((c) => [c.id, c.company_name]));
            records = records.map((r) => ({ ...r, client_name: r.client_id ? names.get(r.client_id) ?? null : null }));
        }
        return NextResponse.json({ records });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
