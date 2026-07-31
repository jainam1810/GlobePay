"use client";
// The audit pack. Two jobs that pull in opposite directions:
//
//   on screen  — find one payment among thousands
//   on paper   — a complete, ordered record someone can rely on
//
// So the page is a filterable table, and the printed output is whatever the
// filters currently select, with the scope stated in the document itself. That
// last part matters: a filtered table that doesn't say it's filtered reads as
// the complete record, and exporting one as an audit document misrepresents it.
import { useEffect, useMemo, useState } from "react";
import {
    Printer, AlertCircle, Loader2, FileText, Search, ChevronRight, X,
} from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { getTaxRule } from "@/lib/tax-rules";
import { flagFor } from "@/lib/contractor-types";

const ALL = "__all__";
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "name_asc";

const money = (n: number | null | undefined) =>
    Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const whenOf = (r: SavedRecord) => r.paid_at ?? r.invoice_date ?? r.created_at;

export default function AuditPack() {
    const [records, setRecords] = useState<SavedRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [q, setQ] = useState("");
    const [client, setClient] = useState(ALL);
    const [country, setCountry] = useState(ALL);
    const [treatment, setTreatment] = useState(ALL);
    const [year, setYear] = useState(ALL);
    const [sort, setSort] = useState<SortKey>("date_desc");

    useEffect(() => {
        fetch("/api/records")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRecords(j.records || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }, []);

    // Memoised: `records ?? []` would be a fresh array on every render, which
    // silently defeats every useMemo below — the filter and sort would re-run
    // on each keystroke over the whole set.
    const all = useMemo(() => records ?? [], [records]);
    const clientNames = useMemo(
        () => [...new Set(all.map((r) => r.client_name).filter((n): n is string => !!n))].sort(), [all]);
    const countries = useMemo(
        () => [...new Set(all.map((r) => r.tax_country).filter((c): c is string => !!c))].sort(), [all]);
    const years = useMemo(
        () => [...new Set(all.map((r) => new Date(whenOf(r)).getFullYear()))].sort((a, b) => b - a), [all]);

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const out = all.filter((r) => {
            if (client !== ALL && r.client_name !== client) return false;
            if (country !== ALL && r.tax_country !== country) return false;
            if (treatment !== ALL && (r.tax_treatment ?? "") !== treatment) return false;
            if (year !== ALL && String(new Date(whenOf(r)).getFullYear()) !== year) return false;
            if (!needle) return true;
            // Searchable by the things someone actually has to hand: a name, a
            // tax ID from a letter, an invoice number, or a hash from a receipt.
            return [r.payee_name, r.contractor_tax_id, r.invoice_number, r.tx_hash, r.tax_country, r.description]
                .some((v) => v?.toLowerCase().includes(needle));
        });
        const by: Record<SortKey, (a: SavedRecord, b: SavedRecord) => number> = {
            date_desc: (a, b) => +new Date(whenOf(b)) - +new Date(whenOf(a)),
            date_asc: (a, b) => +new Date(whenOf(a)) - +new Date(whenOf(b)),
            amount_desc: (a, b) => Number(b.amount) - Number(a.amount),
            amount_asc: (a, b) => Number(a.amount) - Number(b.amount),
            name_asc: (a, b) => (a.payee_name ?? "").localeCompare(b.payee_name ?? ""),
        };
        return [...out].sort(by[sort]);
    }, [all, q, client, country, treatment, year, sort]);

    const totals = useMemo(() => ({
        gross: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
        withheld: rows.reduce((s, r) => s + Number(r.withheld_amount || 0), 0),
        people: new Set(rows.map((r) => r.payee_name)).size,
        countries: new Set(rows.map((r) => r.tax_country).filter(Boolean)).size,
    }), [rows]);

    const active = [
        client !== ALL && { k: "client", label: client, clear: () => setClient(ALL) },
        country !== ALL && { k: "country", label: country, clear: () => setCountry(ALL) },
        treatment !== ALL && { k: "treatment", label: treatment === "cross_border" ? "Cross-border" : "Domestic", clear: () => setTreatment(ALL) },
        year !== ALL && { k: "year", label: year, clear: () => setYear(ALL) },
        q.trim() && { k: "q", label: `“${q.trim()}”`, clear: () => setQ("") },
    ].filter(Boolean) as { k: string; label: string; clear: () => void }[];

    const filtered = active.length > 0;

    if (error) {
        return (
            <div className="rounded-[var(--radius)] border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm flex items-center gap-2">
                <AlertCircle size={15} /> {error}
            </div>
        );
    }
    if (records === null) {
        return (
            <div className="card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                <Loader2 size={15} className="animate-spin" /> Loading records…
            </div>
        );
    }
    if (all.length === 0) {
        return (
            <div className="card p-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-4"><FileText size={20} /></div>
                <div className="text-xl font-medium tracking-[-0.02em]">Nothing to export yet</div>
                <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                    Confirm a payment run and every payment lands here — tax treatment, exchange rate and on-chain proof included.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* ── toolbar: screen only, not part of the document ───────────── */}
            <div className="no-print card p-3 md:p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search name, tax ID, invoice number or transaction hash"
                            aria-label="Search payments"
                            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {clientNames.length > 1 && (
                            <Select value={client} onChange={setClient} label="Client"
                                options={[[ALL, "All clients"], ...clientNames.map((c) => [c, c] as [string, string])]} />
                        )}
                        <Select value={year} onChange={setYear} label="Year"
                            options={[[ALL, "All years"], ...years.map((y) => [String(y), String(y)] as [string, string])]} />
                        <Select value={country} onChange={setCountry} label="Country"
                            options={[[ALL, "All countries"], ...countries.map((c) => [c, c] as [string, string])]} />
                        <Select value={treatment} onChange={setTreatment} label="Treatment"
                            options={[[ALL, "All treatments"], ["domestic", "Domestic"], ["cross_border", "Cross-border"]]} />
                        <Select value={sort} onChange={(v) => setSort(v as SortKey)} label="Sort"
                            options={[["date_desc", "Newest first"], ["date_asc", "Oldest first"], ["amount_desc", "Largest first"], ["amount_asc", "Smallest first"], ["name_asc", "Name A–Z"]]} />
                        <button onClick={() => window.print()} className="btn-primary text-sm py-2 px-4">
                            <Printer size={15} /> Export PDF
                        </button>
                    </div>
                </div>

                {/* Active filters, always visible. Without these a filtered table
                    looks like the whole record. */}
                {filtered && (
                    <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-[var(--border)]">
                        <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Filtered by</span>
                        {active.map((f) => (
                            <button key={f.k} onClick={f.clear}
                                className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)] transition hover:brightness-110">
                                {f.label}<X size={11} />
                            </button>
                        ))}
                        <button
                            onClick={() => { setQ(""); setClient(ALL); setCountry(ALL); setTreatment(ALL); setYear(ALL); }}
                            className="text-[12px] text-[var(--text-dim)] underline underline-offset-2 hover:text-[var(--text)] transition ml-1">
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* ── the document ─────────────────────────────────────────────── */}
            <div className="audit-doc card mt-4 overflow-hidden">
                <div className="px-5 md:px-7 pt-6 pb-5 border-b border-[var(--border)]">
                    <div className="flex items-start justify-between gap-6 flex-wrap">
                        <div>
                            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">Audit pack</div>
                            <h2 className="text-2xl font-medium tracking-[-0.02em] mt-1">
                                {client !== ALL ? client : "All payments"}
                            </h2>
                        </div>
                        <div className="text-right text-[11px] font-mono text-[var(--text-faint)] leading-relaxed">
                            <div>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
                            <div>{rows.length} of {all.length} payment{all.length === 1 ? "" : "s"}</div>
                        </div>
                    </div>

                    {/* Scope. Prints with the document — the reader must know what
                        this covers and, just as importantly, what it leaves out. */}
                    <div className={`mt-4 rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed border ${filtered
                        ? "border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)]"}`}>
                        {filtered ? (
                            <>
                                <span className="font-medium">Partial record.</span>{" "}
                                Showing {rows.length} of {all.length} payments, filtered by {active.map((f) => f.label).join(" · ")}.
                            </>
                        ) : (
                            <>Complete record — all {all.length} payment{all.length === 1 ? "" : "s"} on file, no filters applied.</>
                        )}
                    </div>
                </div>

                {/* Totals reflect the filters, not the whole table. */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)] border-b border-[var(--border)]">
                    <Stat label="Gross paid" value={`$${money(totals.gross)}`} accent />
                    <Stat label="Tax withheld" value={`$${money(totals.withheld)}`} />
                    <Stat label="Net to contractors" value={`$${money(totals.gross - totals.withheld)}`} />
                    <Stat label="Contractors" value={`${totals.people}`} sub={`${totals.countries} countr${totals.countries === 1 ? "y" : "ies"}`} />
                </div>

                {rows.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-[15px] font-medium">No payments match these filters</div>
                        <p className="text-[var(--text-dim)] text-sm mt-1.5">Try a different year or country, or clear the filters to see everything.</p>
                        <button onClick={() => { setQ(""); setClient(ALL); setCountry(ALL); setTreatment(ALL); setYear(ALL); }}
                            className="no-print mt-4 text-sm text-[var(--accent)] underline underline-offset-2">Clear all filters</button>
                    </div>
                ) : (
                    <Table rows={rows} />
                )}

                <div className="px-5 md:px-7 py-4 border-t border-[var(--border)] text-[11px] text-[var(--text-faint)] leading-relaxed">
                    Each payment is anchored to a public blockchain transaction; the proof reference is that transaction&rsquo;s
                    hash, verifiable by anyone on Basescan without trusting GlobePay or the payer. Exchange rates are those
                    recorded on the day of payment and are never recalculated. Withholding applies where payer and contractor
                    are in the same country; cross-border payments are made in full and the contractor reports locally.
                </div>
            </div>
        </div>
    );
}

/* ── table ───────────────────────────────────────────────────────────────── */

function Table({ rows }: { rows: SavedRecord[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
                {/* Sticky so the column meaning survives a long scroll. */}
                <thead className="audit-thead sticky top-0 z-10 bg-[var(--surface-2)]">
                    <tr className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                        <Th className="w-[104px]">Date</Th>
                        <Th>Contractor</Th>
                        <Th className="w-[132px]">Country</Th>
                        <Th className="w-[124px]">Treatment</Th>
                        <Th className="w-[112px] text-right">Gross</Th>
                        <Th className="w-[112px] text-right">Withheld</Th>
                        <Th className="w-[112px] text-right">Net</Th>
                        <Th className="w-[128px]">Proof</Th>
                        <Th className="w-[36px] no-print" />
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r) => <Row key={r.id} r={r} />)}
                </tbody>
            </table>
        </div>
    );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
    return <th scope="col" className={`px-3 md:px-4 py-2.5 font-normal border-b border-[var(--border)] ${className}`}>{children}</th>;
}

function Row({ r }: { r: SavedRecord }) {
    const [open, setOpen] = useState(false);
    const when = new Date(whenOf(r));
    const hasTax = r.withholding_rate !== null && r.withheld_amount !== null;
    const crossBorder = r.tax_treatment === "cross_border";
    const net = hasTax ? Number(r.net_amount ?? 0) : Number(r.amount ?? 0);
    const rule = r.tax_country ? getTaxRule(r.tax_country) : null;

    return (
        <>
            <tr className="audit-row border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                <Td className="font-mono text-[12px] text-[var(--text-dim)] whitespace-nowrap">
                    {when.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                </Td>
                <Td>
                    <div className="text-[13px] font-medium truncate">{r.payee_name}</div>
                    {r.contractor_tax_id && (
                        <div className="font-mono text-[11px] text-[var(--text-faint)] truncate">{rule?.taxIdName} {r.contractor_tax_id}</div>
                    )}
                </Td>
                <Td className="text-[12px] text-[var(--text-dim)] whitespace-nowrap">
                    <span className="mr-1.5">{flagFor(r.tax_country ?? "")}</span>{r.tax_country ?? "—"}
                </Td>
                <Td className="text-[12px] text-[var(--text-dim)] whitespace-nowrap">
                    <span className={`dot ${crossBorder ? "dot-ok" : hasTax ? "dot-pending" : "dot-failed"} mr-1.5`} />
                    {crossBorder ? "Cross-border" : hasTax ? "Domestic" : "—"}
                </Td>
                <Td className="font-mono text-[13px] text-right whitespace-nowrap">${money(r.amount)}</Td>
                <Td className="font-mono text-[13px] text-right whitespace-nowrap text-[var(--text-dim)]">
                    {hasTax ? `−$${money(r.withheld_amount)}` : "—"}
                </Td>
                <Td className="font-mono text-[13px] text-right whitespace-nowrap font-medium">${money(net)}</Td>
                <Td className="whitespace-nowrap">
                    {r.tx_hash ? (
                        <a href={`https://sepolia.basescan.org/tx/${r.tx_hash}`} target="_blank" rel="noreferrer"
                            className="font-mono text-[11px] text-[var(--accent)] hover:underline underline-offset-2">
                            {r.tx_hash.slice(0, 10)}…
                        </a>
                    ) : <span className="text-[11px] text-[var(--text-faint)]">—</span>}
                </Td>
                <Td className="no-print">
                    <button onClick={() => setOpen(!open)} aria-expanded={open}
                        aria-label={`Details for ${r.payee_name}`}
                        className="text-[var(--text-faint)] hover:text-[var(--text)] transition">
                        <ChevronRight size={15} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                    </button>
                </Td>
            </tr>

            {/* Drill-down: the supporting detail an auditor asks for second, once
                they've found the row they care about. */}
            {open && (
                <tr className="audit-detail bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <td colSpan={9} className="px-3 md:px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Detail label="Local value"
                                value={r.local_amount !== null && r.local_currency ? `${money(r.local_amount)} ${r.local_currency}` : "—"}
                                sub={r.fx_rate ? `rate ${Number(r.fx_rate).toFixed(4)}, pinned ${r.fx_pinned_at ?? "at pay time"}` : undefined} />
                            <Detail label="Withholding"
                                value={hasTax ? `${((r.withholding_rate ?? 0) * 100).toFixed(0)}% · $${money(r.withheld_amount)}` : "None"}
                                sub={crossBorder ? "Payer outside the contractor's country" : rule?.withholdingLabel} />
                            <Detail label="Invoice" value={r.invoice_number || "—"} sub={r.description || undefined} />
                            <Detail label="Paid from" value={r.company_country || "—"} sub={rule?.source} />
                        </div>
                        {r.tx_hash && (
                            <div className="mt-3 pt-3 border-t border-[var(--border)] font-mono text-[11px] text-[var(--text-faint)] break-all">
                                <span className="uppercase tracking-wider mr-2">Transaction</span>{r.tx_hash}
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
    return <td className={`px-3 md:px-4 py-3 align-top ${className}`}>{children}</td>;
}

function Detail({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className="font-mono text-[12px] text-[var(--text)]">{value}</div>
            {sub && <div className="text-[11px] text-[var(--text-faint)] mt-0.5 leading-snug">{sub}</div>}
        </div>
    );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
    return (
        <div className="bg-[var(--surface)] px-5 py-4">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className={`font-mono text-lg font-medium tracking-[-0.02em] ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</div>
            {sub && <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{sub}</div>}
        </div>
    );
}

function Select({ value, onChange, options, label }: {
    value: string; onChange: (v: string) => void; options: [string, string][]; label: string;
}) {
    return (
        <select
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-[13px] px-2.5 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition"
        >
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}
