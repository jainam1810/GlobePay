// Search across the things a client actually looks for by name.
//
// Pages are not here: they are a fixed list the client already knows and can
// rank without a round trip, so the palette matches those locally and shows
// them first. This route answers the part only the database knows — which
// freelancers exist, which payments were made, what was on an invoice.
//
// Everything is scoped by session. An admin searches every client; a client
// searches only their own rows, and there is no parameter that changes that.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";

/** Per group. Enough to find what you meant, few enough to scan. */
const LIMIT = 6;

export type SearchHit = {
    id: string;
    /** Which group it belongs to, and therefore where it ranks. */
    kind: "freelancer" | "payment" | "record";
    title: string;
    subtitle: string;
    href: string;
    country?: string | null;
};

/**
 * Escape a value for PostgREST's `or=` filter.
 *
 * The filter is parsed as a comma-separated list of conditions, so a comma or a
 * parenthesis in the search text would be read as syntax and either error or —
 * worse — silently widen the query. Percent signs would turn into wildcards.
 */
const safe = (q: string) => q.replace(/[,()%*\\]/g, " ").trim();

export async function GET(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        // Cheap per call, but three queries each — worth a ceiling so a
        // script cannot walk the roster one letter at a time.
        const over = await guard("search", s.userId);
        if (over) return over;

        const raw = new URL(req.url).searchParams.get("q") ?? "";
        const q = safe(raw);
        if (q.length < 2) return NextResponse.json({ hits: [] });

        const like = `%${q}%`;
        const admin = s.role === "globepay_admin";
        const base = admin ? "/admin" : "/portal";
        const supabase = getSupabase();

        // Three small queries in parallel rather than one clever join: each has
        // its own columns to match on, and a failure in one shouldn't empty the
        // others. The client_id filter is applied inline per query — a shared
        // generic helper for it sent tsc into an unbounded instantiation.
        let peopleQ = supabase.from("contractors").select("id, name, role, country, wallet")
            .or(`name.ilike.${like},role.ilike.${like},country.ilike.${like},wallet.ilike.${like}`)
            .limit(LIMIT);
        let recordsQ = supabase.from("records").select("id, payee_name, amount, invoice_number, tax_country, invoice_date, tx_hash")
            .or(`payee_name.ilike.${like},invoice_number.ilike.${like},tax_country.ilike.${like},description.ilike.${like}`)
            .order("invoice_date", { ascending: false })
            .limit(LIMIT);
        let paymentsQ = supabase.from("payments").select("id, tx_hash, total_amount, recipient_count, paid_at")
            .ilike("tx_hash", like)
            .order("paid_at", { ascending: false })
            .limit(LIMIT);

        if (!admin) {
            peopleQ = peopleQ.eq("client_id", s.clientId!);
            recordsQ = recordsQ.eq("client_id", s.clientId!);
            paymentsQ = paymentsQ.eq("client_id", s.clientId!);
        }

        const [people, records, payments] = await Promise.all([peopleQ, recordsQ, paymentsQ]);

        const money = (n: unknown) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const hits: SearchHit[] = [];

        for (const p of people.data ?? []) {
            hits.push({
                id: `c-${p.id}`,
                kind: "freelancer",
                title: p.name,
                subtitle: [p.role, p.country].filter(Boolean).join(" · "),
                country: p.country,
                // The roster is the operator's screen; a client meets their
                // freelancers through the payments they've made to them.
                href: admin
                    ? `/admin/clients`
                    : `${base}/audit-pack?q=${encodeURIComponent(p.name)}`,
            });
        }

        for (const r of records.data ?? []) {
            hits.push({
                id: `r-${r.id}`,
                kind: "record",
                title: r.payee_name ?? "Payment",
                subtitle: [money(r.amount), r.invoice_number, (r.invoice_date ?? "").slice(0, 10)].filter(Boolean).join(" · "),
                country: r.tax_country,
                // Land on the audit pack already filtered to this row, so the
                // click ends on the record rather than at the top of a list.
                href: `${base}/audit-pack?q=${encodeURIComponent(r.invoice_number || r.payee_name || "")}`,
            });
        }

        for (const p of payments.data ?? []) {
            hits.push({
                id: `p-${p.id}`,
                kind: "payment",
                title: `${p.recipient_count} paid · ${money(p.total_amount)}`,
                subtitle: p.tx_hash,
                // The payments page highlights by transaction hash.
                href: `${base}/payments?highlight=${encodeURIComponent(p.tx_hash)}`,
            });
        }

        return NextResponse.json({ hits });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
