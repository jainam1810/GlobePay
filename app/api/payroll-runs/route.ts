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

// A run's note is what the client sees in their portal and in the email, so an
// empty one is a usability problem, not just a blank field. Build a default
// that answers "how much, to how many, for when" at a glance.
function defaultNote(total: number, count: number, when: Date): string {
    const month = when.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const money = `$${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    return `${month} payroll — ${money} to ${count} freelancer${count === 1 ? "" : "s"}`;
}

// POST { clientId, contractorIds: string[], amounts?: Record<id, number>, note? }
// GlobePay prepares a run for a hand-picked subset of the client's freelancers.
// `amounts` overrides the roster default per freelancer, so the same person can
// be paid a different figure each run.
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const body = await req.json();
        const { clientId, contractorIds, amounts, note } = body || {};
        if (!clientId) return NextResponse.json({ error: "clientId is required" }, { status: 400 });
        if (!Array.isArray(contractorIds) || contractorIds.length === 0) {
            return NextResponse.json({ error: "Select at least one freelancer to pay" }, { status: 400 });
        }
        const overrides: Record<string, number> = amounts && typeof amounts === "object" ? amounts : {};

        const supabase = getSupabase();
        const { data: contractors, error: cErr } = await supabase
            .from("contractors").select("*").eq("client_id", clientId).in("id", contractorIds);
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        if (!contractors || contractors.length !== contractorIds.length) {
            return NextResponse.json({ error: "Some selected freelancers don't belong to this client" }, { status: 400 });
        }

        // Per-run amount wins; the roster's monthly_amount is only a default.
        const line_items: PayrollLineItem[] = (contractors as DbContractor[]).map((c) => {
            const override = overrides[c.id];
            const amount = typeof override === "number" && override > 0 ? override : c.monthly_amount;
            return { contractor_id: c.id, name: c.name, wallet: c.wallet, country: c.country, amount };
        });

        const zeroed = line_items.filter((li) => !(li.amount > 0)).map((li) => li.name);
        if (zeroed.length) {
            return NextResponse.json(
                { error: `Set an amount for ${zeroed.join(", ")} — no default is saved for them.` },
                { status: 400 },
            );
        }

        const total_amount = line_items.reduce((sum, li) => sum + li.amount, 0);

        const { data, error } = await supabase.from("payroll_runs").insert({
            client_id: clientId,
            status: "pending_confirmation",
            line_items,
            total_amount,
            note: note?.trim() || defaultNote(total_amount, line_items.length, new Date()),
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
