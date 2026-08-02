import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { toolDeclarations, SYSTEM_BRIEF } from "@/lib/ask-tools";

// Agentic assistant over the payment ledger.
//
// The loop is the standard one: declare tools → the model returns functionCall
// parts → we execute them → the results go back → the model writes the answer,
// or asks for more. It can call several tools in one turn, which is how a
// message containing two questions gets two answers.
//
// The model owns language, ambiguity, decomposition and the reply. Code owns
// every number. That split is not a limitation of the model — it is what makes
// the figures auditable, and it is what commercial systems do for exactly this
// reason.

// A chain, not a model, and overridable without a deploy.
//
// Google cut the free tier to 20 requests per day *per model* (gemini-2.5-flash,
// Dec 2025), and one tool-calling question spends two or three of them. The quota
// is counted per model, so falling down the list when one is exhausted is what
// keeps a demo alive on a free key. First entry is the one that answers normally:
// 3.5-flash is ~2s where 3.6-flash takes ~30s thinking, and both decompose a
// multi-part question correctly. On a paid key the chain simply never advances.
const MODELS = (process.env.GEMINI_MODEL || "gemini-3.5-flash,gemini-3.6-flash,gemini-3.1-flash-lite")
    .split(",").map((m) => m.trim()).filter(Boolean);
const MAX_ROUNDS = 5;          // a stuck agent stops rather than looping on the bill
const EVIDENCE_CAP = 50;

/** Seconds Google asks us to wait, from its RetryInfo. */
function retryAfter(body: string) {
    const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(body);
    return m ? Math.min(Number(m[1]), 12) : null;
}
/** A per-day exhaustion is worth saying plainly; a per-minute one is worth waiting out. */
const isDailyQuota = (body: string) => /PerDay/i.test(body);

type Row = Record<string, unknown> & {
    amount: number | null;
    payee_name: string | null;
    tax_country: string | null;
    client_name?: string | null;
    invoice_number?: string | null;
    tx_hash?: string | null;
    paid_at?: string | null;
    invoice_date: string | null;
    created_at: string;
};

const money = (n: number) => Number(n.toFixed(2));
const dayOf = (r: Row) => String(r.paid_at ?? r.invoice_date ?? r.created_at).slice(0, 10);
const loose = (a: string, b: string) => {
    const x = a.toLowerCase().replace(/[^a-z]/g, ""), y = b.toLowerCase().replace(/[^a-z]/g, "");
    return !!x && !!y && (x.includes(y) || y.includes(x));
};

/* ── the tools, executed in code ─────────────────────────────────────────── */

function describeData(rows: Row[]) {
    const days = rows.map(dayOf).sort();
    return {
        countries: [...new Set(rows.map((r) => r.tax_country).filter(Boolean))],
        contractors: [...new Set(rows.map((r) => r.payee_name).filter(Boolean))],
        clients: [...new Set(rows.map((r) => r.client_name).filter(Boolean))],
        earliest: days[0] ?? null,
        latest: days[days.length - 1] ?? null,
        totalPayments: rows.length,
    };
}

function queryPayments(rows: Row[], a: Record<string, unknown>) {
    const from = typeof a.from === "string" ? a.from.slice(0, 10) : null;
    const to = typeof a.to === "string" ? a.to.slice(0, 10) : null;
    const country = typeof a.country === "string" ? a.country : null;
    const contractor = typeof a.contractor === "string" ? a.contractor : null;
    const client = typeof a.client === "string" ? a.client : null;
    const groupBy = typeof a.groupBy === "string" ? a.groupBy : "none";

    // Calendar-day strings throughout — invoice_date is a DATE and mixing it
    // with local-midnight Date objects drops payments made on the 1st.
    const hit = rows.filter((r) => {
        const d = dayOf(r);
        if (from && d < from) return false;
        if (to && d > to) return false;
        if (country && (r.tax_country ?? "").toLowerCase() !== country.toLowerCase()) return false;
        if (contractor && !loose(r.payee_name ?? "", contractor)) return false;
        if (client && !loose(r.client_name ?? "", client)) return false;
        return true;
    });

    const total = hit.reduce((s, r) => s + Number(r.amount || 0), 0);
    const result: Record<string, unknown> = {
        label: a.label ?? "",
        total: money(total),
        payments: hit.length,
        contractors: new Set(hit.map((r) => r.payee_name)).size,
        countries: new Set(hit.map((r) => r.tax_country).filter(Boolean)).size,
        average: hit.length ? money(total / hit.length) : 0,
        filters: { from, to, country, contractor, client },
    };

    if (hit.length) {
        const largest = hit.reduce((x, y) => (Number(y.amount) > Number(x.amount) ? y : x));
        result.largest = { contractor: largest.payee_name, amount: money(Number(largest.amount)), date: dayOf(largest) };
    }

    if (groupBy !== "none") {
        const key = (r: Row) =>
            groupBy === "country" ? r.tax_country ?? "Unspecified"
                : groupBy === "contractor" ? r.payee_name ?? "Unknown"
                    : groupBy === "client" ? r.client_name ?? "Unassigned"
                        : dayOf(r).slice(0, 7);
        const m = new Map<string, { total: number; payments: number }>();
        for (const r of hit) {
            const k = key(r);
            const g = m.get(k) ?? { total: 0, payments: 0 };
            g.total += Number(r.amount || 0); g.payments++;
            m.set(k, g);
        }
        result.breakdown = [...m.entries()]
            .sort((x, y) => y[1].total - x[1].total)
            .map(([k, g]) => ({ key: k, total: money(g.total), payments: g.payments }));
    }

    return { result, matched: hit };
}

/* ── the agentic loop ────────────────────────────────────────────────────── */

type Part = Record<string, unknown>;
type Content = { role: "user" | "model"; parts: Part[] };

export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { question, history } = await req.json();
        if (!question?.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });

        // Scoped by session, exactly as everywhere else — a client's assistant
        // can only ever see that client's payments.
        const supabase = getSupabase();
        let sel = supabase.from("records").select("*");
        if (s.role !== "globepay_admin") sel = sel.eq("client_id", s.clientId!);
        const { data, error } = await sel;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const rows = (data || []) as Row[];

        // Prior turns give it context — "and Argentina only?" needs the question
        // before it. Trimmed to the last few so the window stays small.
        const opening: Content[] = [];
        for (const h of (Array.isArray(history) ? history : []).slice(-6)) {
            if (h?.q) opening.push({ role: "user", parts: [{ text: String(h.q) }] });
            if (h?.a) opening.push({ role: "model", parts: [{ text: String(h.a) }] });
        }
        opening.push({ role: "user", parts: [{ text: question }] });

        let evidence: Row[] = [];
        let calls: { name: string; args: Record<string, unknown> }[] = [];
        // The figures as computed, kept so the UI can render them from the numbers
        // themselves rather than re-reading them out of the model's prose.
        let figures: Record<string, unknown>[] = [];
        let answer = "";
        let fatal: NextResponse | null = null;

        // Each model gets the question from the top.
        //
        // A half-finished tool-calling conversation cannot be handed to a
        // different model: Gemini 3 requires the thought_signature it attached to
        // its own function calls, and rejects the request outright if one is
        // missing or foreign. So a switch means starting over, which costs a
        // couple of seconds and is why the chain only advances on failures that
        // will not clear on their own.
        for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
            const model = MODELS[modelIdx];
            const contents: Content[] = opening.map((c) => ({ ...c, parts: [...c.parts] }));
            evidence = []; calls = []; figures = []; answer = "";

            const payload = () => JSON.stringify({
                systemInstruction: {
                    parts: [{ text: `${SYSTEM_BRIEF}\n\nToday is ${new Date().toISOString().slice(0, 10)}. The account is ${s.role === "globepay_admin" ? "GlobePay staff, who can see every client" : "a client company, who can see only their own payments"}.` }],
                },
                contents,
                tools: [{ functionDeclarations: toolDeclarations }],
                generationConfig: { temperature: 0 },
            });

            let tryNextModel = false;

            for (let round = 0; round < MAX_ROUNDS; round++) {
                // One question costs several requests — that is what tool calling
                // is — so a burst can trip the per-minute quota mid-answer. Wait
                // that one out; a spent daily quota or an overloaded model won't
                // clear, so those fall through to the next model instead.
                let r: Response, body = "", waited = 0;
                for (;;) {
                    r = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: payload() },
                    );
                    if (r.ok) break;
                    body = await r.text();
                    if (r.status !== 429) break;
                    const wait = isDailyQuota(body) ? null : retryAfter(body);
                    if (wait === null || waited >= 1) break;
                    waited++;
                    await new Promise((res) => setTimeout(res, wait * 1000 + 500));
                }

                if (!r.ok) {
                    const exhausted = r.status === 429 && isDailyQuota(body);
                    const overloaded = r.status === 503 || r.status === 500;
                    if ((exhausted || overloaded) && modelIdx + 1 < MODELS.length) {
                        console.error(`[ask] ${model} HTTP ${r.status} — falling back to ${MODELS[modelIdx + 1]}`);
                        tryNextModel = true;
                        break;
                    }
                    if (r.status === 429) {
                        fatal = NextResponse.json({
                            error: isDailyQuota(body)
                                ? "The assistant has used up today's AI quota. Your payments and the audit pack are unaffected — every figure it quotes is in there too."
                                : "That was a lot of questions at once — give it a few seconds and ask again.",
                        }, { status: 429 });
                    } else {
                        // The user gets a calm sentence; the operator gets the reason.
                        console.error(`[ask] ${model} HTTP ${r.status}: ${body.slice(0, 400)}`);
                        fatal = NextResponse.json(
                            { error: "The assistant is unavailable right now. Your payment records are unaffected — the audit pack has the same figures." },
                            { status: 502 });
                    }
                    break;
                }

                const j = await r.json();
                const parts: Part[] = j?.candidates?.[0]?.content?.parts ?? [];
                const fnCalls = parts.filter((p) => p.functionCall) as { functionCall: { name: string; args: Record<string, unknown> } }[];

                if (fnCalls.length === 0) {
                    answer = parts.map((p) => (typeof p.text === "string" ? p.text : "")).join("").trim();
                    break;
            }

            // Several calls can come back at once — that's how two questions in
            // one message get answered in one round.
            contents.push({ role: "model", parts });
            const responses: Part[] = [];
            for (const { functionCall } of fnCalls) {
                const { name, args = {} } = functionCall;
                calls.push({ name, args });
                let payload: unknown;
                if (name === "describe_data") {
                    payload = describeData(rows);
                } else if (name === "query_payments") {
                    const { result, matched } = queryPayments(rows, args);
                    payload = result;
                    figures.push(result);
                    for (const m of matched) if (!evidence.includes(m)) evidence.push(m);
                } else {
                    payload = { error: `Unknown tool ${name}` };
                }
                responses.push({ functionResponse: { name, response: payload } });
            }
            contents.push({ role: "user", parts: responses });
            }

            if (fatal) return fatal;
            if (!tryNextModel) break;   // this model answered, or gave up on its own terms
        }

        if (!answer) {
            answer = "I couldn't work that one out — try asking it a different way.";
        }

        const shown = evidence
            .sort((a, b) => (dayOf(a) < dayOf(b) ? 1 : -1))
            .slice(0, EVIDENCE_CAP)
            .map((r) => ({
                name: r.payee_name, country: r.tax_country,
                amount: Number(r.amount || 0), date: dayOf(r),
                invoice: r.invoice_number ?? null, tx: r.tx_hash ?? null,
            }));

        return NextResponse.json({
            answer,
            evidence: shown,
            truncated: evidence.length > shown.length,
            rows: evidence.length,
            // What it actually did, so a surprising answer can be traced to the
            // query behind it rather than argued with.
            calls: calls.map((c) => ({ name: c.name, ...c.args })),
            figures,
        });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
