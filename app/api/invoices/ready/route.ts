// What is accepted and still owed, grouped by client.
//
// This is the pile a run gets built from: invoices that were checked and passed,
// and that no run has claimed yet. Once a run claims them they drop out of here,
// which is what stops the same $2,500 being pulled into next month as well.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";

export type OwedLine = {
    id: string;
    contractor_id: string | null;
    payee_name: string | null;
    amount: number | null;
    invoice_number: string | null;
    invoice_date: string | null;
    description: string | null;
};

export type OwedClient = {
    client_id: string;
    client_name: string;
    lines: OwedLine[];
    total: number;
};

export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") {
            return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("invoice_submissions")
            .select("id, client_id, contractor_id, payee_name, amount, invoice_number, invoice_date, description")
            .eq("status", "accepted")
            .is("payroll_run_id", null)
            .order("invoice_date", { ascending: true });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const rows = (data ?? []) as unknown as OwedLine[] & { client_id: string }[];
        if (!rows.length) return NextResponse.json({ clients: [] });

        const { data: cs } = await supabase.from("clients").select("id, company_name");
        const names = new Map((cs ?? []).map((c) => [c.id, c.company_name]));

        const byClient = new Map<string, OwedClient>();
        for (const r of rows as (OwedLine & { client_id: string })[]) {
            // An invoice with no roster entry can't be paid — accepting always
            // sets one, so this only catches a freelancer deleted afterwards.
            if (!r.contractor_id) continue;
            const g: OwedClient = byClient.get(r.client_id) ?? {
                client_id: r.client_id,
                client_name: names.get(r.client_id) ?? "Unknown client",
                lines: [],
                total: 0,
            };
            g.lines.push(r);
            g.total += Number(r.amount ?? 0);
            byClient.set(r.client_id, g);
        }

        return NextResponse.json({ clients: [...byClient.values()] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
