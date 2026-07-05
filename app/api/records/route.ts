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
