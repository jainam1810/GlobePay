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
    "amount, currency, invoice_number, invoice_date, description, status, review_note, contractor_id, reviewed_at, payroll_run_id, corrections";

const asDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null);

/** The fields a reviewer may correct, and what to call each one to a client. */
const EDITABLE: Record<string, string> = {
    payee_name: "Freelancer",
    payee_wallet: "Wallet",
    amount: "Amount",
    currency: "Currency",
    invoice_number: "Invoice number",
    invoice_date: "Invoice date",
    description: "Description",
};

/**
 * Turn whatever fields were sent into a patch, plus a note of what changed.
 *
 * The note is the point. A model reads the invoice and a person corrects it, and
 * without a record the client sees only the final figures — no way to tell that
 * an amount or a wallet was altered after they sent it. On something that
 * decides who gets paid what, that is theirs to see.
 */
function collectEdits(body: Record<string, unknown>, sub: Record<string, unknown>) {
    const patch: Record<string, unknown> = {};
    const changes: { field: string; label: string; from: string; to: string }[] = [];

    for (const key of Object.keys(EDITABLE)) {
        if (!(key in body)) continue;

        let next: unknown;
        if (key === "amount") {
            const n = Number(body.amount);
            next = n > 0 ? n : null;
        } else if (key === "invoice_date") {
            next = asDate(String(body.invoice_date ?? ""));
        } else if (key === "currency") {
            next = String(body.currency ?? "").trim().toUpperCase() || null;
        } else {
            next = String(body[key] ?? "").trim() || null;
        }

        const prev = sub[key] ?? null;
        // Compared as text so 3 and "3" don't read as a change nobody made.
        if (String(prev ?? "") === String(next ?? "")) continue;

        patch[key] = next;
        changes.push({
            field: key,
            label: EDITABLE[key],
            from: prev === null || prev === "" ? "—" : String(prev),
            to: next === null || next === "" ? "—" : String(next),
        });
    }
    return { patch, changes };
}

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
        // Captured out here: the closure below outlives the narrowing above.
        const reviewer = s.email ?? "GlobePay";

        // Shared by "save" and by "accept", so accepting an edited row saves the
        // edits in the same step. Two buttons for one decision left Accept
        // disabled with no clue that Save had to come first.
        async function applyEdits() {
            const { patch, changes } = collectEdits(body, sub);
            if (!changes.length) return { ok: true as const, changed: false };

            if (typeof patch.payee_wallet === "string" && !isAddress(patch.payee_wallet)) {
                return {
                    ok: false as const,
                    res: NextResponse.json({
                        error: "That wallet address doesn't pass its checksum — usually one misread character. Check it against the invoice.",
                    }, { status: 400 }),
                };
            }
            if ("amount" in patch && !(Number(patch.amount) > 0)) {
                return {
                    ok: false as const,
                    res: NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 }),
                };
            }

            const stamped = changes.map((c) => ({
                ...c,
                at: new Date().toISOString(),
                by: reviewer,
            }));
            const { error } = await supabase.from("invoice_submissions")
                .update({ ...patch, corrections: [...(sub.corrections ?? []), ...stamped] })
                .eq("id", id);
            if (error) {
                return { ok: false as const, res: NextResponse.json({ error: error.message }, { status: 500 }) };
            }
            // Keep the in-memory copy in step — accept reads it straight after.
            Object.assign(sub, patch);
            return { ok: true as const, changed: true };
        }

        if (action === "save") {
            const r = await applyEdits();
            if (!r.ok) return r.res;
            if (!r.changed) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
            const { data } = await supabase.from("invoice_submissions").select(FIELDS).eq("id", id).single();
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
            // Corrections travelling with the click are saved before the checks
            // run, so the verdict is judged on what the reviewer can see.
            const edited = await applyEdits();
            if (!edited.ok) return edited.res;

            if (sub.status === "accepted") {
                return NextResponse.json({ error: "That invoice is already accepted" }, { status: 409 });
            }
            if (!sub.payee_wallet || !isAddress(String(sub.payee_wallet))) {
                return NextResponse.json({
                    error: "This wallet address doesn't pass its checksum, so a character was probably misread. Open the invoice, check it against the page, and correct it here.",
                }, { status: 400 });
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
