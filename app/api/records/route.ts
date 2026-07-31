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

        // invoice_date is a DATE — no time of day in it. The audit-defensible
        // moment is when the money actually moved, which is the block timestamp
        // on the linked payment, so attach that for display.
        if (records.length) {
            const hashes = records.map((r) => r.tx_hash).filter(Boolean);
            if (hashes.length) {
                const { data: paid } = await supabase.from("payments").select("tx_hash, paid_at").in("tx_hash", hashes);
                const paidAt = new Map((paid || []).map((p) => [p.tx_hash.toLowerCase(), p.paid_at]));
                records = records.map((r) => ({
                    ...r,
                    paid_at: r.tx_hash ? paidAt.get(r.tx_hash.toLowerCase()) ?? null : null,
                }));
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
