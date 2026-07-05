import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { notifyPayrollPrepared } from "@/lib/notify";
import type { DbContractor } from "@/lib/contractor-types";
import type { PayrollLineItem } from "@/lib/clients";

export async function GET(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const url = new URL(req.url);
        let q = getSupabase().from("payroll_runs").select("*").order("created_at", { ascending: false });
        if (s.role === "globepay_admin") {
            const clientId = url.searchParams.get("client_id");
            if (clientId) q = q.eq("client_id", clientId);
        } else {
            q = q.eq("client_id", s.clientId!);
        }
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ runs: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

// POST { clientId, contractorIds: string[], note? } — GlobePay prepares a run
// for a hand-picked subset of the client's freelancers. Amounts snapshot from
// the roster at prepare time.
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const body = await req.json();
        const { clientId, contractorIds, note } = body || {};
        if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
        if (!Array.isArray(contractorIds) || contractorIds.length === 0) {
            return NextResponse.json({ error: "Select at least one freelancer to pay" }, { status: 400 });
        }

        const supabase = getSupabase();
        const { data: contractors, error: cErr } = await supabase
            .from("contractors").select("*").eq("client_id", clientId).in("id", contractorIds);
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        if (!contractors || contractors.length !== contractorIds.length) {
            return NextResponse.json({ error: "Some selected freelancers don't belong to this client" }, { status: 400 });
        }

        const line_items: PayrollLineItem[] = (contractors as DbContractor[]).map((c) => ({
            contractor_id: c.id, name: c.name, wallet: c.wallet, country: c.country, amount: c.monthly_amount,
        }));
        const total_amount = line_items.reduce((sum, li) => sum + li.amount, 0);

        const { data, error } = await supabase.from("payroll_runs").insert({
            client_id: clientId,
            status: "pending_confirmation",
            line_items,
            total_amount,
            note: note?.trim() || null,
            prepared_by: s.userId,
        }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Tell the client their payroll is waiting (no-op without RESEND_API_KEY).
        const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
        const appUrl = new URL(req.url).origin;
        const notification = client ? await notifyPayrollPrepared(client, data, appUrl) : { sent: false, detail: "client not found" };

        return NextResponse.json({ run: data, notification }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
