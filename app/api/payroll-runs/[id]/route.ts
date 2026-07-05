import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { buildPaymentRow } from "@/lib/chain";
import { computeWithholding } from "@/lib/tax-rules";
import { getFxRate } from "@/lib/fx";
import type { PayrollLineItem } from "@/lib/clients";
import type { DbContractor } from "@/lib/contractor-types";

// Every executed payroll line becomes a tax-ledger record: treatment decided
// by payer vs payee country, withholding computed in CODE, FX pinned at pay
// time, tx hash as on-chain anchor. Immutable snapshot, same as before.
async function writeLedgerRecords(runClientId: string, lineItems: PayrollLineItem[], txHash: string, note: string | null) {
    const supabase = getSupabase();

    // Idempotency: if this tx already has ledger rows, don't double-write.
    const { data: existing } = await supabase.from("records").select("id").eq("tx_hash", txHash).limit(1);
    if (existing?.length) return;

    const [{ data: client }, { data: contractors }] = await Promise.all([
        supabase.from("clients").select("*").eq("id", runClientId).single(),
        supabase.from("contractors").select("*").eq("client_id", runClientId),
    ]);
    if (!client) return;
    const byId = new Map(((contractors as DbContractor[]) || []).map((c) => [c.id, c]));
    const today = new Date().toISOString().slice(0, 10);

    const rows = [];
    for (const li of lineItems) {
        const contractor = byId.get(li.contractor_id);
        const sameCountry = client.home_country.toLowerCase() === li.country.toLowerCase();

        let tax_treatment = "cross_border", withholding_rate = null, withheld_amount = null, net_amount = null;
        if (sameCountry) {
            const wh = computeWithholding(li.amount, li.country);
            if (wh) {
                tax_treatment = "domestic";
                withholding_rate = wh.withholdingRate;
                withheld_amount = wh.withheldAmount;
                net_amount = wh.netAmount;
            }
        }

        let local_amount = null, local_currency = null, fx_rate = null, fx_pinned_at = null;
        if (contractor && contractor.currency !== "USD") {
            const rate = await getFxRate("USD", contractor.currency, "latest").catch(() => null);
            if (rate !== null) {
                fx_rate = rate;
                local_currency = contractor.currency;
                local_amount = Math.round(li.amount * rate * 100) / 100;
                fx_pinned_at = today;
            }
        }

        rows.push({
            client_id: runClientId,
            payee_name: li.name,
            amount: li.amount, currency: "USD",
            invoice_date: today,
            description: note || "Payroll",
            tx_hash: txHash,
            local_amount, local_currency, fx_rate, fx_pinned_at,
            tax_country: li.country, withholding_rate, withheld_amount, net_amount,
            contractor_tax_id: contractor?.tax_id ?? null,
            tax_treatment, company_country: client.home_country,
        });
    }
    if (rows.length) await supabase.from("records").insert(rows);
}

// PATCH { action: "executed", txHash }  — client confirmed; tx already on-chain.
// PATCH { action: "cancelled" }         — GlobePay withdraws a pending run.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const supabase = getSupabase();
        const { data: run, error: rErr } = await supabase.from("payroll_runs").select("*").eq("id", id).single();
        if (rErr || !run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });

        const body = await req.json();

        if (body.action === "cancelled") {
            if (s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });
            if (run.status !== "pending_confirmation") return NextResponse.json({ error: `Can't cancel a ${run.status} run` }, { status: 400 });
            const { data, error } = await supabase.from("payroll_runs")
                .update({ status: "cancelled" }).eq("id", id).select().single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ run: data });
        }

        if (body.action === "executed") {
            // Only the run's own client (or an admin) can mark it executed.
            if (s.role === "client" && s.clientId !== run.client_id) {
                return NextResponse.json({ error: "This payroll belongs to another client" }, { status: 403 });
            }
            if (run.status !== "pending_confirmation") {
                return NextResponse.json({ error: `This run is already ${run.status}` }, { status: 400 });
            }
            const txHash: string | undefined = body.txHash;
            if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
                return NextResponse.json({ error: "txHash must be a 66-character transaction hash" }, { status: 400 });
            }

            // Rebuild the payment from the chain (proves it really happened),
            // stamp it with this run's client, then close out the run.
            const paymentRow = await buildPaymentRow(txHash as `0x${string}`);
            const { error: pErr } = await supabase.from("payments")
                .upsert({ ...paymentRow, client_id: run.client_id }, { onConflict: "tx_hash" });
            if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

            const { data, error } = await supabase.from("payroll_runs")
                .update({ status: "executed", confirmed_at: new Date().toISOString(), tx_hash: txHash })
                .eq("id", id).select().single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            // Tax ledger entries — never let a ledger hiccup fail a confirmed payment.
            try { await writeLedgerRecords(run.client_id, run.line_items, txHash, run.note); } catch { }

            return NextResponse.json({ run: data });
        }

        return NextResponse.json({ error: "action must be 'executed' or 'cancelled'" }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
