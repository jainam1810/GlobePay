"use client";
// Tax ledger: one entry per freelancer per payroll run, written automatically
// at execution. The API scopes rows by session (a client sees their own; a
// GlobePay admin sees all, with client names attached).
//
// Rebuilt around what people actually come here to find out, in order:
//
//   1. "How much did I withhold?"  → a summary band, before any rows. This is
//      the number that goes on a return, and it used to appear nowhere at all.
//   2. "Show me the year."         → grouped by tax year with subtotals, since
//      tax is annual and a flat list of every payment ever is not a filing.
//   3. "Explain this one line."    → expandable row. FX pin, tax ID, rule
//      source and the on-chain proof live in there, not in the row.
//
// The old version was a stack of cards where every value — labels, prose,
// dates, amounts — was uppercase monospace, so nothing outranked anything else,
// "cross-border" was stamped twice per card, and the same two-line legal
// paragraph repeated on every entry. Those decisions are reversed here:
//
//   · Monospace is for figures only. It exists so digits line up in a column;
//     spending it on words like "BOOKED AS" buys nothing and costs hierarchy.
//   · Money is right-aligned and tabular, so $999.99 and $1,111.11 compare by
//     eye without $1,111.11 looking shorter.
//   · The cross-border explanation is a footnote under the table, said once.
import { useEffect, useMemo, useState } from "react";
import {
    AlertCircle, ArrowUpRight, ChevronRight, Scale, Search, SlidersHorizontal,
} from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { getTaxRule, validateTaxId } from "@/lib/tax-rules";
import { flagFor } from "@/lib/contractor-types";
import { Skeleton, SkeletonRows, Empty } from "@/components/ui/kit";
import { Tooltip } from "@/components/ui/overlays";

const ALL = "__all__";

/** Money, always two decimals and tabular so columns line up. */
const usd = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The day this entry belongs to for tax purposes: when the money moved. */
const dayOf = (r: SavedRecord) => (r.paid_at ?? r.invoice_date ?? r.created_at).slice(0, 10);
const yearOf = (r: SavedRecord) => dayOf(r).slice(0, 4);

const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

export default function TaxLedger() {
    const [records, setRecords] = useState<SavedRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [year, setYear] = useState(ALL);
    const [country, setCountry] = useState(ALL);
    const [treatment, setTreatment] = useState(ALL);

    useEffect(() => {
        fetch("/api/records")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRecords(j.records || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }, []);

    const years = useMemo(
        () => [...new Set((records || []).map(yearOf))].sort().reverse(),
        [records],
    );
    const countries = useMemo(
        () => [...new Set((records || []).map((r) => r.tax_country).filter((c): c is string => !!c))].sort(),
        [records],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (records || []).filter((r) => {
            if (year !== ALL && yearOf(r) !== year) return false;
            if (country !== ALL && r.tax_country !== country) return false;
            if (treatment !== ALL && (r.tax_treatment ?? "unspecified") !== treatment) return false;
            if (!q) return true;
            return [r.payee_name, r.description, r.tax_country, r.client_name, r.tax_treatment]
                .some((v) => v?.toLowerCase().includes(q));
        }).sort((a, b) => (dayOf(a) < dayOf(b) ? 1 : -1));
    }, [records, query, year, country, treatment]);

    // Totals over what is on screen, not over everything — a filtered view
    // whose header still reports the whole dataset is how people file wrong
    // numbers.
    const totals = useMemo(() => {
        const t = { gross: 0, withheld: 0, net: 0, domestic: 0, cross: 0 };
        for (const r of filtered) {
            const g = Number(r.amount || 0);
            t.gross += g;
            t.withheld += Number(r.withheld_amount || 0);
            t.net += Number(r.net_amount ?? g);
            if (r.tax_treatment === "cross_border") t.cross++;
            else if (r.tax_treatment === "domestic") t.domestic++;
        }
        return t;
    }, [filtered]);

    // Grouped by tax year, newest first, each with its own subtotals.
    const groups = useMemo(() => {
        const m = new Map<string, SavedRecord[]>();
        for (const r of filtered) {
            const y = yearOf(r);
            m.set(y, [...(m.get(y) ?? []), r]);
        }
        return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    }, [filtered]);

    const anyCrossBorder = filtered.some((r) => r.tax_treatment === "cross_border");
    const filtersOn = year !== ALL || country !== ALL || treatment !== ALL || !!query.trim();

    if (error) {
        return (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                <AlertCircle size={15} /> {error}
            </div>
        );
    }

    if (records === null) return <LedgerSkeleton />;

    if (records.length === 0) {
        return (
            <div className="card mt-4">
                <Empty
                    icon={Scale}
                    title="Nothing to file yet"
                    body="When a payroll is confirmed, every freelancer paid gets an entry here automatically — treatment, withholding and FX rate, all frozen at pay time."
                />
            </div>
        );
    }

    return (
        <div className="mt-5 space-y-4">
            {/* ── the answer, before the evidence ── */}
            <div className="card overflow-hidden">
                <div className="grid gap-px bg-[var(--border)] sm:grid-cols-4">
                    <Figure
                        label="Withheld"
                        value={usd(totals.withheld)}
                        hint="Tax you deducted and owe to an authority"
                        tone={totals.withheld > 0 ? "warn" : "quiet"}
                        lead
                    />
                    <Figure label="Gross" value={usd(totals.gross)} hint="Total invoiced before any deduction" />
                    <Figure label="Net paid" value={usd(totals.net)} hint="What actually reached freelancers" />
                    <Figure
                        label="Entries"
                        value={String(filtered.length)}
                        hint="One per freelancer per payroll run"
                        sub={`${totals.domestic} domestic · ${totals.cross} cross-border`}
                        plain
                    />
                </div>
                {filtersOn && (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[11px] text-[var(--text-dim)]">
                        Totals cover the {filtered.length} filtered {filtered.length === 1 ? "entry" : "entries"}, not the full ledger.
                    </div>
                )}
            </div>

            {/* ── filters ── */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[190px] flex-1 sm:max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, country, client…"
                        aria-label="Search the ledger"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-9 pr-3 text-[13px] transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                    />
                </div>
                <Select value={year} onChange={setYear} label="Year"
                    options={[[ALL, "All years"], ...years.map((y) => [y, y] as [string, string])]} />
                <Select value={country} onChange={setCountry} label="Country"
                    options={[[ALL, "All countries"], ...countries.map((c) => [c, c] as [string, string])]} />
                <Select value={treatment} onChange={setTreatment} label="Treatment"
                    options={[[ALL, "All treatments"], ["domestic", "Domestic"], ["cross_border", "Cross-border"], ["unspecified", "Unspecified"]]} />
                {filtersOn && (
                    <button
                        onClick={() => { setYear(ALL); setCountry(ALL); setTreatment(ALL); setQuery(""); }}
                        className="rounded-lg px-2.5 py-2 text-[12px] text-[var(--text-dim)] transition hover:text-white"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* ── the rows ── */}
            {filtered.length === 0 ? (
                <div className="card">
                    <Empty
                        icon={SlidersHorizontal}
                        title="No entries match"
                        body="Nothing in the ledger fits those filters. Widen the year or country, or clear them."
                    />
                </div>
            ) : (
                groups.map(([y, rows]) => <YearGroup key={y} year={y} rows={rows} />)
            )}

            {/* Said once, under the table, instead of on every single row. */}
            {anyCrossBorder && (
                <p className="px-1 text-[12px] leading-relaxed text-[var(--text-faint)]">
                    <span className="text-[var(--text-dim)]">On cross-border entries:</span>{" "}the payer sits outside
                    the freelancer&rsquo;s country, so no local withholding applies. The freelancer reports the
                    income to their own authority, and the payment is booked as a deductible operating expense.
                </p>
            )}
        </div>
    );
}

/* ── a tax year ─────────────────────────────────────────────────────────── */

function YearGroup({ year, rows }: { year: string; rows: SavedRecord[] }) {
    const gross = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const withheld = rows.reduce((s, r) => s + Number(r.withheld_amount || 0), 0);

    return (
        <section className="card overflow-hidden">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
                <div className="flex items-baseline gap-2.5">
                    <h3 className="text-[14px] font-medium">{year}</h3>
                    <span className="text-[12px] text-[var(--text-faint)]">
                        {rows.length} {rows.length === 1 ? "entry" : "entries"}
                    </span>
                </div>
                <div className="flex items-baseline gap-4 text-[12px]">
                    <span className="text-[var(--text-faint)]">
                        Gross <span className="font-mono tabular-nums text-[var(--text-dim)]">${usd(gross)}</span>
                    </span>
                    <span className="text-[var(--text-faint)]">
                        Withheld{" "}
                        <span className={`font-mono tabular-nums ${withheld > 0 ? "text-[var(--warn)]" : "text-[var(--text-dim)]"}`}>
                            ${usd(withheld)}
                        </span>
                    </span>
                </div>
            </header>

            {/* Column headers, hidden on narrow screens where the row stacks. */}
            <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_84px_28px] items-center gap-3 border-b border-[var(--border)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-faint)] md:grid">
                <span>Freelancer</span>
                <span className="text-right">Gross</span>
                <span className="text-right">Withheld</span>
                <span className="text-right">Net</span>
                {/* Padded away from Net: the right-aligned amount ends flush
                    against this column, and "NET PAID" reads as one label. */}
                <span className="pl-3">Paid</span>
                <span />
            </div>

            <div className="divide-y divide-[var(--border)]">
                {rows.map((r) => <Row key={r.id} r={r} />)}
            </div>
        </section>
    );
}

/* ── one entry ──────────────────────────────────────────────────────────── */

function Row({ r }: { r: SavedRecord }) {
    const [open, setOpen] = useState(false);

    const gross = Number(r.amount || 0);
    const withheld = Number(r.withheld_amount || 0);
    const net = Number(r.net_amount ?? gross);
    const cross = r.tax_treatment === "cross_border";
    const rule = r.tax_country ? getTaxRule(r.tax_country) : null;
    const idValid = r.contractor_tax_id && r.tax_country
        ? validateTaxId(r.contractor_tax_id, r.tax_country)
        : null;

    return (
        <div>
            <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-[var(--surface-2)] md:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr_84px_28px]"
            >
                <div className="col-span-2 min-w-0 md:col-span-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{r.payee_name}</span>
                        {r.tax_country && (
                            <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
                                {flagFor(r.tax_country)} {r.tax_country}
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
                        {/* Treatment said once, as a word rather than a badge — a
                            row with three chips on it has no emphasis left. */}
                        <span className={cross ? "text-[var(--accent)]" : withheld > 0 ? "text-[var(--warn)]" : ""}>
                            {cross ? "Cross-border" : r.tax_treatment === "domestic" ? "Domestic" : "Unspecified"}
                        </span>
                        {r.client_name && <><span aria-hidden>·</span><span className="truncate">{r.client_name}</span></>}
                    </div>
                </div>

                <Money v={gross} className="text-[var(--text)]" />
                <Money
                    v={withheld}
                    prefix={withheld > 0 ? "−" : ""}
                    className={withheld > 0 ? "text-[var(--warn)]" : "text-[var(--text-faint)]"}
                    label="Withheld"
                />
                <Money v={net} className="font-medium text-[var(--text)]" label="Net" />

                <span className="hidden pl-3 text-[12px] text-[var(--text-faint)] md:block">
                    {shortDate(dayOf(r))}
                </span>
                <ChevronRight
                    size={15}
                    aria-hidden
                    className={`hidden shrink-0 text-[var(--text-faint)] transition-transform duration-200 md:block ${open ? "rotate-90" : ""}`}
                />
            </button>

            {open && (
                <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-4">
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail label="Treatment">
                            {cross ? (
                                <span className="flex items-center gap-1.5">
                                    {r.company_country && <>{flagFor(r.company_country)} {r.company_country}</>}
                                    <span className="text-[var(--text-faint)]">→</span>
                                    {r.tax_country && <>{flagFor(r.tax_country)} {r.tax_country}</>}
                                </span>
                            ) : withheld > 0 && r.withholding_rate != null ? (
                                `${(r.withholding_rate * 100).toFixed(0)}% withholding applied`
                            ) : "No withholding"}
                        </Detail>

                        <Detail label="Booked as">
                            {cross ? "Operating expense" : "Payroll cost"}
                        </Detail>

                        {r.local_amount != null && r.local_currency ? (
                            <Detail label={`Local value${r.fx_pinned_at ? ` · pinned ${shortDate(r.fx_pinned_at)}` : ""}`}>
                                <span className="font-mono tabular-nums">
                                    ≈ {usd(r.local_amount)} {r.local_currency}
                                </span>
                            </Detail>
                        ) : null}

                        {r.contractor_tax_id && rule ? (
                            <Detail label={rule.taxIdName}>
                                <span className="flex items-center gap-1.5">
                                    <span className="font-mono">{r.contractor_tax_id}</span>
                                    {idValid
                                        ? <span className="text-[11px] text-[var(--ok)]">checks out</span>
                                        : <Tooltip content={`Doesn't match the ${rule.taxIdName} format for ${r.tax_country}. Worth confirming before filing.`}>
                                            <span className="cursor-help text-[11px] text-[var(--warn)]">unrecognised format</span>
                                        </Tooltip>}
                                </span>
                            </Detail>
                        ) : null}

                        {r.description ? <Detail label="Description">{r.description}</Detail> : null}
                        {r.invoice_number ? <Detail label="Invoice">{r.invoice_number}</Detail> : null}
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                        <span className="text-[11px] text-[var(--text-faint)]">
                            {rule ? `${r.tax_country} · ${rule.source}` : "No tax rule recorded for this entry"}
                        </span>
                        {r.tx_hash ? (
                            <a
                                href={`https://sepolia.basescan.org/tx/${r.tx_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[12px] text-[var(--accent)] transition hover:underline"
                            >
                                Proof on Base <ArrowUpRight size={12} />
                            </a>
                        ) : (
                            <span className="text-[11px] text-[var(--text-faint)]">Invoice only — no payment recorded</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

/** Right-aligned and tabular so a column of amounts compares by eye. */
function Money({ v, prefix = "", className = "", label }: {
    v: number; prefix?: string; className?: string; label?: string;
}) {
    return (
        <span className="text-right font-mono text-[13px] tabular-nums">
            {label && <span className="mr-1 font-sans text-[10px] uppercase tracking-wider text-[var(--text-faint)] md:hidden">{label}</span>}
            <span className={className}>{prefix}${usd(v)}</span>
        </span>
    );
}

function Figure({ label, value, hint, sub, tone = "quiet", lead, plain }: {
    label: string; value: string; hint: string; sub?: string;
    tone?: "warn" | "quiet"; lead?: boolean; plain?: boolean;
}) {
    return (
        <div className="bg-[var(--surface)] px-4 py-4">
            <Tooltip content={hint}>
                <span className="cursor-help text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    {label}
                </span>
            </Tooltip>
            <div className={`mt-1.5 font-mono tabular-nums tracking-[-0.02em] ${lead ? "text-[26px]" : "text-[20px]"} ${tone === "warn" && lead ? "text-[var(--warn)]" : "text-[var(--text)]"}`}>
                {plain ? value : `$${value}`}
            </div>
            {sub && <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{sub}</div>}
        </div>
    );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-faint)]">{label}</dt>
            <dd className="mt-1 text-[13px] text-[var(--text-dim)]">{children}</dd>
        </div>
    );
}

function Select({ value, onChange, options, label }: {
    value: string; onChange: (v: string) => void; options: [string, string][]; label: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-dim)] transition hover:text-white focus:border-[var(--accent)] focus:outline-none"
        >
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}

/** Matches the real layout — summary band, filter row, then a grouped table. */
function LedgerSkeleton() {
    return (
        <div className="mt-5 space-y-4" role="status" aria-label="Loading the ledger">
            <div className="card overflow-hidden">
                <div className="grid gap-px bg-[var(--border)] sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-[var(--surface)] px-4 py-4">
                            <Skeleton className="h-2.5 w-16" />
                            <Skeleton className="mt-3 h-6 w-24" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
            <div className="card overflow-hidden">
                <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                    <Skeleton className="h-3 w-20" />
                </div>
                <SkeletonRows rows={5} cols={4} />
            </div>
        </div>
    );
}
