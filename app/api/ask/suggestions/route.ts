import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { format, startOfYear, subYears } from "date-fns";

// Starter questions, built from what this client has actually paid.
//
// Two rules, in order:
//
//  1. Never suggest a question whose answer is "no payments". A dead suggestion
//     is worse than none — it makes the assistant look broken on first contact,
//     which is the one impression that decides whether it gets used again.
//     Every candidate below is checked against real rows before it ships.
//
//  2. Between the survivors, spread across question *shapes* — a total, a
//     country, a person, a breakdown — rather than four variations of one. The
//     empty state is where someone learns what this thing can be asked, so the
//     suggestions double as the manual.
//
// Generated in code from the records, not by a model: the point is that they're
// guaranteed to be answerable, and a model can't guarantee that.
export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const supabase = getSupabase();
        // Real columns only. paid_at is not stored on records — /api/records
        // attaches it from the linked payment — so asking for it here is a hard
        // error rather than a null.
        let q = supabase.from("records").select("amount, tax_country, payee_name, invoice_date, created_at");
        if (s.role !== "globepay_admin") q = q.eq("client_id", s.clientId!);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const rows = data || [];
        if (rows.length === 0) return NextResponse.json({ suggestions: [] });

        const when = (r: typeof rows[number]) => new Date(r.invoice_date ?? r.created_at);
        const now = new Date();
        // Calendar-day strings, same reasoning as resolvePeriod: invoice_date is
        // a DATE parsed as UTC midnight, startOfYear() is local midnight, and
        // comparing them misfiles anything dated 1 January west of Greenwich.
        const thisYearStart = format(startOfYear(now), "yyyy-MM-dd");
        const lastYearStart = format(startOfYear(subYears(now, 1)), "yyyy-MM-dd");
        const day = (r: typeof rows[number]) => (r.invoice_date ?? r.created_at).slice(0, 10);

        const sumBy = (key: (r: typeof rows[number]) => string | null) => {
            const m = new Map<string, number>();
            for (const r of rows) {
                const k = key(r);
                if (!k) continue;
                m.set(k, (m.get(k) ?? 0) + Number(r.amount || 0));
            }
            return [...m.entries()].sort((a, b) => b[1] - a[1]);
        };

        const countries = sumBy((r) => r.tax_country);
        const people = sumBy((r) => r.payee_name);
        const inThisYear = rows.filter((r) => day(r) >= thisYearStart);
        const inLastYear = rows.filter((r) => day(r) >= lastYearStart && day(r) < thisYearStart);
        const latest = rows.reduce((a, b) => (when(a) > when(b) ? a : b));
        const latestMonth = when(latest);

        // Candidates in priority order. Each carries the condition that makes it
        // answerable, so nothing dead can reach the UI.
        const candidates: { text: string; ok: boolean; shape: string }[] = [
            {
                // Lead with the client's biggest corridor — that's the number they
                // care about and the one a stakeholder asks about first.
                text: countries[0] ? `How much went to ${countries[0][0]} ${inThisYear.length ? "this year" : "in total"}?` : "",
                ok: !!countries[0] && (inThisYear.length > 0 || rows.length > 0),
                shape: "country",
            },
            {
                text: `How much did we pay in ${format(latestMonth, "MMMM yyyy")}?`,
                ok: true,
                shape: "period",
            },
            {
                text: "Payments per country",
                ok: countries.length > 1,
                shape: "breakdown",
            },
            {
                text: people[0] ? `How much have we paid ${people[0][0].split(" ").slice(0, 2).join(" ")}?` : "",
                ok: !!people[0] && people.length > 1,
                shape: "person",
            },
            {
                text: "How much did we pay last year?",
                ok: inLastYear.length > 0,
                shape: "period",
            },
            {
                text: "What was our largest payment?",
                ok: rows.length > 1,
                shape: "extreme",
            },
            {
                text: "How many payments have we made in total?",
                ok: true,
                shape: "count",
            },
        ];

        // One per shape, so four suggestions teach four different things.
        const seen = new Set<string>();
        const suggestions: string[] = [];
        for (const c of candidates) {
            if (!c.ok || !c.text || seen.has(c.shape)) continue;
            seen.add(c.shape);
            suggestions.push(c.text);
            if (suggestions.length === 4) break;
        }
        // Backfill from whatever's left if the shape rule left us short.
        if (suggestions.length < 4) {
            for (const c of candidates) {
                if (!c.ok || !c.text || suggestions.includes(c.text)) continue;
                suggestions.push(c.text);
                if (suggestions.length === 4) break;
            }
        }

        return NextResponse.json({ suggestions });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
