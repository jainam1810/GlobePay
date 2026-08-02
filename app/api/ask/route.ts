import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { askSchema, resolvePeriod, type AskQuery } from "@/lib/ask-schema";

const MODEL = "gemini-2.5-flash";

const PROMPT = `You turn a question about payment history into a filter. You do NOT answer it.

You will never be shown any amounts, and you must never write one. Your entire job
is to decide: what is being measured, over what period, for which country or person,
and whether a breakdown was asked for. Code does the counting.

Rules:
- period: use a symbolic value ("last_year", "this_quarter", …) whenever the question
  uses a relative phrase. Only use "custom" when an explicit date, month or year is
  named, and then fill from/to as YYYY-MM-DD.
- If no period is mentioned at all, use "all_time".
- country: only Nigeria, Argentina or the Philippines are possible. Map demonyms and
  adjectives ("Argentinian", "Filipino", "Nigerian devs") to the country name.
- groupBy: set it when the question implies a breakdown — "per country", "by month",
  "which contractor", "split by". Otherwise "none".
- metric: "total" for money, "count" for how many payments, "average", "largest".
  "How much did we send" is total. "How many payments" is count.
- unanswerable: fill this in ONLY if the question cannot be answered from records of
  payments already made — for example tax advice, forecasts, or anything about money
  that hasn't been paid yet. Leave it empty for anything answerable.`;

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { question, clientId: asked } = await req.json();
        if (!question?.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });

        // ── 1. the model turns the sentence into a filter ────────────────────
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
            {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${PROMPT}\n\nToday is ${new Date().toISOString().slice(0, 10)}.\n\nQuestion: ${question}` }] }],
                    generationConfig: { responseMimeType: "application/json", responseSchema: askSchema, temperature: 0 },
                }),
            },
        );
        if (!r.ok) return NextResponse.json({ error: "Couldn't understand that — try rephrasing it." }, { status: 502 });
        const j = await r.json();
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return NextResponse.json({ error: "Couldn't understand that — try rephrasing it." }, { status: 502 });

        const q = JSON.parse(text) as AskQuery;
        if (q.unanswerable?.trim()) {
            return NextResponse.json({ answer: q.unanswerable.trim(), query: q, rows: 0 });
        }

        // ── 2. code fetches and filters. Scoped by session, as everywhere. ───
        const supabase = getSupabase();
        let sel = supabase.from("records").select("*");
        if (s.role !== "globepay_admin") sel = sel.eq("client_id", s.clientId!);
        else if (asked) sel = sel.eq("client_id", asked);
        const { data, error } = await sel;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const { start, end, label } = resolvePeriod(q.period, q.from, q.to);
        const when = (rec: { paid_at?: string | null; invoice_date: string | null; created_at: string }) =>
            new Date(rec.paid_at ?? rec.invoice_date ?? rec.created_at);

        const rows = (data || []).filter((rec) => {
            const t = when(rec);
            if (start && t < start) return false;
            if (end && t > end) return false;
            if (q.country && (rec.tax_country ?? "").toLowerCase() !== q.country.toLowerCase()) return false;
            if (q.contractor) {
                const a = (rec.payee_name ?? "").toLowerCase().replace(/[^a-z]/g, "");
                const b = q.contractor.toLowerCase().replace(/[^a-z]/g, "");
                if (!a.includes(b) && !b.includes(a)) return false;
            }
            return true;
        });

        // ── 3. every figure below is computed here, never generated ──────────
        const total = rows.reduce((acc, rec) => acc + Number(rec.amount || 0), 0);
        const count = rows.length;
        const scope = [q.country, q.contractor].filter(Boolean).join(", ");
        const where = scope ? ` to ${scope}` : "";
        const over = label === "all time" ? " in total" : ` in ${label}`;

        let answer: string;
        if (count === 0) {
            answer = `No payments${where}${over}.`;
        } else if (q.groupBy !== "none") {
            const key = (rec: Record<string, unknown>) =>
                q.groupBy === "country" ? (rec.tax_country as string) || "Unspecified"
                    : q.groupBy === "contractor" ? (rec.payee_name as string) || "Unknown"
                        : when(rec as never).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

            const groups = new Map<string, { sum: number; n: number }>();
            for (const rec of rows) {
                const k = key(rec);
                const g = groups.get(k) ?? { sum: 0, n: 0 };
                g.sum += Number(rec.amount || 0); g.n++;
                groups.set(k, g);
            }
            const lines = [...groups.entries()]
                .sort((a, b) => b[1].sum - a[1].sum)
                .map(([k, g]) => `• ${k} — ${money(g.sum)} across ${plural(g.n, "payment")}`);
            answer = `${money(total)} across ${plural(count, "payment")}${where}${over}:\n${lines.join("\n")}`;
        } else if (q.metric === "count") {
            answer = `${plural(count, "payment")}${where}${over}, totalling ${money(total)}.`;
        } else if (q.metric === "average") {
            answer = `${money(total / count)} on average${where}${over}, across ${plural(count, "payment")}.`;
        } else if (q.metric === "largest") {
            const top = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
            answer = `The largest was ${money(Number(top.amount))} to ${top.payee_name}${top.tax_country ? ` in ${top.tax_country}` : ""}${over}.`;
        } else {
            const people = new Set(rows.map((rec) => rec.payee_name)).size;
            answer = `${money(total)}${where}${over}, across ${plural(count, "payment")} to ${plural(people, "contractor")}.`;
        }

        return NextResponse.json({ answer, query: q, rows: count, total, period: label });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
