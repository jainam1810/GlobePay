// Reviewing one submitted invoice: correct it, accept it, or send it back.
//
// Accepting is the only thing here that changes the roster, and it is
// deliberately narrow. It puts the freelancer on the books and records which
// roster entry this invoice belongs to — it does not write the invoice's amount
// onto the freelancer, and it does not build a payroll run.
//
// Not writing the amount is the important half. A freelancer's pay varies by
// month, so "whatever they invoiced last" is a poor default; writing it into the
// roster would leave that figure echoing the most recent invoice, and the one
// thing it is genuinely useful for — noticing that somebody normally on $2,000
// has invoiced $12,000 — would be lost. The roster figure stays human-set, and
// the invoice's amount stays on the invoice, ready for the run that pays it.
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { matchInvoice } from "@/lib/invoice-submissions";

const FIELDS =
    "id, created_at, client_id, file_name, file_type, file_size, extracted, payee_name, payee_wallet, " +
    "amount, currency, invoice_number, invoice_date, description, status, review_note, contractor_id, reviewed_at, payroll_run_id";

const asDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") {
            return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });
        }
        const over = await guard("write", s.userId);
        if (over) return over;

        const { id } = await params;
        const body = await req.json();
        const action = String(body?.action ?? "");
        const supabase = getSupabase();

        const { data: sub } = await supabase
            .from("invoice_submissions").select("*").eq("id", id).single();
        if (!sub) return NextResponse.json({ error: "That invoice isn't here any more" }, { status: 404 });

        /* ── correct what the model read ─────────────────────────────────── */
        if (action === "save") {
            const patch: Record<string, unknown> = {};
            if ("payee_name" in body) patch.payee_name = String(body.payee_name ?? "").trim() || null;
            if ("payee_wallet" in body) {
                const w = String(body.payee_wallet ?? "").trim();
                if (w && !isAddress(w)) {
                    return NextResponse.json({ error: "That is not a valid wallet address" }, { status: 400 });
                }
                patch.payee_wallet = w || null;
            }
            if ("amount" in body) {
                const n = Number(body.amount);
                if (body.amount !== null && body.amount !== "" && !(n > 0)) {
                    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
                }
                patch.amount = n > 0 ? n : null;
            }
            if ("currency" in body) patch.currency = String(body.currency ?? "").trim().toUpperCase() || null;
            if ("invoice_number" in body) patch.invoice_number = String(body.invoice_number ?? "").trim() || null;
            if ("invoice_date" in body) patch.invoice_date = asDate(String(body.invoice_date ?? ""));
            if ("description" in body) patch.description = String(body.description ?? "").trim() || null;

            if (!Object.keys(patch).length) {
                return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
            }
            const { data, error } = await supabase
                .from("invoice_submissions").update(patch).eq("id", id).select(FIELDS).single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ submission: data });
        }

        /* ── undo an accept ──────────────────────────────────────────────── */
        if (action === "reopen") {
            if (sub.payroll_run_id) {
                // The run has claimed it. Reopening now would let the same
                // invoice be paid twice, and there is no reversal on chain.
                return NextResponse.json(
                    { error: "This invoice is already on a payroll run and can't be reopened." },
                    { status: 409 },
                );
            }
            const { data, error } = await supabase.from("invoice_submissions").update({
                status: "pending",
                contractor_id: null,
                review_note: null,
                reviewed_by: null,
                reviewed_at: null,
            }).eq("id", id).select(FIELDS).single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ submission: data });
        }

        /* ── send it back ────────────────────────────────────────────────── */
        if (action === "reject") {
            const note = String(body?.note ?? "").trim();
            if (!note) {
                // Without a reason the client's only move is to upload it again.
                return NextResponse.json({ error: "Say what needs fixing — the client sees this." }, { status: 400 });
            }
            const { data, error } = await supabase.from("invoice_submissions").update({
                status: "needs_attention",
                review_note: note.slice(0, 300),
                reviewed_by: s.userId,
                reviewed_at: new Date().toISOString(),
            }).eq("id", id).select(FIELDS).single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ submission: data });
        }

        /* ── accept ──────────────────────────────────────────────────────── */
        if (action === "accept") {
            if (sub.status === "accepted") {
                return NextResponse.json({ error: "That invoice is already accepted" }, { status: 409 });
            }
            if (!sub.payee_wallet || !isAddress(String(sub.payee_wallet))) {
                return NextResponse.json({ error: "A valid wallet address is needed before this can be accepted" }, { status: 400 });
            }
            if (!sub.payee_name?.trim()) {
                return NextResponse.json({ error: "A payee name is needed before this can be accepted" }, { status: 400 });
            }
            if (!(Number(sub.amount) > 0)) {
                return NextResponse.json({ error: "An amount is needed before this can be accepted" }, { status: 400 });
            }

            const [{ data: roster }, { data: accepted }] = await Promise.all([
                supabase.from("contractors").select("id, name, wallet, monthly_amount").eq("client_id", sub.client_id),
                supabase.from("invoice_submissions")
                    .select("payee_wallet, invoice_number")
                    .eq("client_id", sub.client_id).eq("status", "accepted").neq("id", id),
            ]);

            const m = matchInvoice(sub, roster ?? [], accepted ?? []);

            // Neither of these may be waved through. A conflict is what invoice
            // fraud looks like; a duplicate spends money twice with no reversal.
            if (m.verdict === "conflict" || m.verdict === "duplicate") {
                return NextResponse.json({ error: m.reason, verdict: m.verdict }, { status: 409 });
            }

            let contractorId = m.contractorId;

            if (m.verdict === "new") {
                // An invoice rarely states a country, and the roster requires
                // one, so the reviewer supplies it rather than us guessing.
                const country = String(body?.country ?? "").trim();
                if (!country) {
                    return NextResponse.json(
                        { error: "Pick a country for this freelancer before adding them", needsCountry: true },
                        { status: 400 },
                    );
                }
                const { data: created, error: cErr } = await supabase.from("contractors").insert({
                    client_id: sub.client_id,
                    name: sub.payee_name.trim(),
                    role: String(body?.role ?? "").trim() || null,
                    country,
                    currency: "USD",
                    wallet: String(sub.payee_wallet).trim(),
                    // 0 = not set. The figure that gets paid is this invoice's,
                    // carried on the run rather than baked into the roster.
                    monthly_amount: 0,
                }).select("id").single();
                if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
                contractorId = created.id;
            }

            const { data, error } = await supabase.from("invoice_submissions").update({
                status: "accepted",
                contractor_id: contractorId,
                review_note: null,
                reviewed_by: s.userId,
                reviewed_at: new Date().toISOString(),
            }).eq("id", id).select(FIELDS).single();
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ submission: data, verdict: m.verdict });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
