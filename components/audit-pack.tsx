"use client";
// The audit pack. Two jobs that pull in opposite directions:
//
//   on screen  — find one payment among thousands
//   on paper    — a complete, ordered record someone can rely on
//
// So the page is a filterable table, and the export is whatever the filters
// currently select, with the scope stated in the document itself. That last part
// matters: a filtered table that doesn't say it's filtered reads as the complete
// record, and exporting one as an audit document misrepresents it.
//
// An audit pack belongs to one company, so GlobePay admins pick a client first
// rather than scrolling a merged list of everyone's payments. With 100 clients a
// dropdown is the wrong control; a searchable index is not.
import { useEffect, useMemo, useState } from "react";
import {
    Printer, AlertCircle, Loader2, FileText, Search, ChevronRight, X,
    ArrowLeft, Sheet, Building2, Copy, Check,
} from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { getTaxRule } from "@/lib/tax-rules";
import { flagFor } from "@/lib/contractor-types";
import { toCsv, downloadCsv, exportName } from "@/lib/csv";

const ALL = "__all__";
type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "name_asc";

const money = (n: number | null | undefined) =>
    Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whenOf = (r: SavedRecord) => r.paid_at ?? r.invoice_date ?? r.created_at;
const shortAddr = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

export default function AuditPack() {
    const [records, setRecords] = useState<SavedRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // null = the client index (admins only). A name = that client's pack.
    const [openClient, setOpenClient] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/records")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRecords(j.records || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }, []);

    const all = useMemo(() => records ?? [], [records]);
    // The API only labels rows with a client name for admins, so this doubles as
    // the role check: a client portal sees no names and goes straight to its pack.
    const isAdmin = useMemo(() => all.some((r) => !!r.client_name), [all]);

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
    if (all.length === 0) return <Empty />;

    if (isAdmin && openClient === null) {
        return <ClientIndex records={all} onOpen={setOpenClient} />;
    }

    return (
        <Pack
            records={isAdmin && openClient !== ALL ? all.filter((r) => r.client_name === openClient) : all}
            scope={isAdmin ? (openClient === ALL ? "All clients" : openClient!) : undefined}
            onBack={isAdmin ? () => setOpenClient(null) : undefined}
        />
    );
}

function Empty() {
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

/* ── admin: pick a company first ─────────────────────────────────────────── */

function ClientIndex({ records, onOpen }: { records: SavedRecord[]; onOpen: (c: string) => void }) {
    const [q, setQ] = useState("");

    const clients = useMemo(() => {
        const m = new Map<string, { name: string; count: number; gross: number; last: string; countries: Set<string> }>();
        for (const r of records) {
            const name = r.client_name ?? "Unassigned";
            const e = m.get(name) ?? { name, count: 0, gross: 0, last: whenOf(r), countries: new Set<string>() };
            e.count++;
            e.gross += Number(r.amount || 0);
            if (+new Date(whenOf(r)) > +new Date(e.last)) e.last = whenOf(r);
            if (r.tax_country) e.countries.add(r.tax_country);
            m.set(name, e);
        }
        const needle = q.trim().toLowerCase();
        return [...m.values()]
            .filter((c) => !needle || c.name.toLowerCase().includes(needle))
            .sort((a, b) => b.gross - a.gross);
    }, [records, q]);

    const totalGross = records.reduce((s, r) => s + Number(r.amount || 0), 0);

    return (
        <div>
            <div className="card p-3 md:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                            value={q} onChange={(e) => setQ(e.target.value)}
                            placeholder="Search clients"
                            aria-label="Search clients"
                            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                        />
                    </div>
                    <button onClick={() => onOpen(ALL)}
                        className="text-sm px-4 py-2 rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent-line)] transition whitespace-nowrap">
                        Open combined pack
                    </button>
                </div>
            </div>

            <div className="card mt-4 overflow-hidden">
                <div className="flex items-baseline justify-between gap-4 px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-medium">Clients</h2>
                    <span className="font-mono text-[12px] text-[var(--text-faint)]">
                        {clients.length} · ${money(totalGross)} paid in total
                    </span>
                </div>

                {clients.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[var(--text-dim)]">No client matches “{q}”.</div>
                ) : (
                    <div className="divide-y divide-[var(--border)]">
                        {clients.map((c) => (
                            <button key={c.name} onClick={() => onOpen(c.name)}
                                className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition-colors">
                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                                    <Building2 size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[14px] font-medium truncate">{c.name}</div>
                                    <div className="text-[12px] text-[var(--text-faint)]">
                                        {c.count} payment{c.count === 1 ? "" : "s"} · {c.countries.size} countr{c.countries.size === 1 ? "y" : "ies"}
                                    </div>
                                </div>
                                <div className="hidden sm:block text-right">
                                    <div className="font-mono text-[14px]">${money(c.gross)}</div>
                                    <div className="text-[11px] text-[var(--text-faint)]">
                                        last {new Date(c.last).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                                    </div>
                                </div>
                                <ChevronRight size={16} className="shrink-0 text-[var(--text-faint)]" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── one company's pack ──────────────────────────────────────────────────── */

function Pack({ records, scope, onBack }: { records: SavedRecord[]; scope?: string; onBack?: () => void }) {
    const [q, setQ] = useState("");
    const [country, setCountry] = useState(ALL);
    const [treatment, setTreatment] = useState(ALL);
    const [year, setYear] = useState(ALL);
    const [sort, setSort] = useState<SortKey>("date_desc");

    const countries = useMemo(
        () => [...new Set(records.map((r) => r.tax_country).filter((c): c is string => !!c))].sort(), [records]);
    const years = useMemo(
        () => [...new Set(records.map((r) => new Date(whenOf(r)).getFullYear()))].sort((a, b) => b - a), [records]);

    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const out = records.filter((r) => {
            if (country !== ALL && r.tax_country !== country) return false;
            if (treatment !== ALL && (r.tax_treatment ?? "") !== treatment) return false;
            if (year !== ALL && String(new Date(whenOf(r)).getFullYear()) !== year) return false;
            if (!needle) return true;
            // Searchable by whatever someone has to hand: a name, a tax ID from a
            // letter, an invoice number, a wallet or a hash off a receipt.
            return [r.payee_name, r.contractor_tax_id, r.invoice_number, r.tx_hash, r.payee_wallet, r.tax_country, r.description]
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
    }, [records, q, country, treatment, year, sort]);

    const totals = useMemo(() => ({
        gross: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
        withheld: rows.reduce((s, r) => s + Number(r.withheld_amount || 0), 0),
        people: new Set(rows.map((r) => r.payee_name)).size,
        countries: new Set(rows.map((r) => r.tax_country).filter(Boolean)).size,
    }), [rows]);

    const active = [
        country !== ALL && { k: "country", label: country, clear: () => setCountry(ALL) },
        treatment !== ALL && { k: "treatment", label: treatment === "cross_border" ? "Cross-border" : "Domestic", clear: () => setTreatment(ALL) },
        year !== ALL && { k: "year", label: year, clear: () => setYear(ALL) },
        q.trim() && { k: "q", label: `“${q.trim()}”`, clear: () => setQ("") },
    ].filter(Boolean) as { k: string; label: string; clear: () => void }[];
    const filtered = active.length > 0;
    const clearAll = () => { setQ(""); setCountry(ALL); setTreatment(ALL); setYear(ALL); };

    const title = scope ?? "Audit pack";

    function exportCsv() {
        // Every column, including the ones the screen folds away — a spreadsheet
        // has no width limit and this is the file people reconcile against.
        const csv = toCsv(
            ["Date paid", "Contractor", "Country", "Wallet address", "Tax ID", "Treatment",
                "Gross (USD)", "Withholding rate", "Withheld (USD)", "Net (USD)",
                "Local amount", "Local currency", "FX rate", "FX pinned", "Invoice", "Description",
                "Transaction hash", "Paid from"],
            rows.map((r) => {
                const hasTax = r.withholding_rate !== null && r.withheld_amount !== null;
                return [
                    new Date(whenOf(r)).toISOString().slice(0, 10),
                    r.payee_name, r.tax_country, r.payee_wallet, r.contractor_tax_id,
                    r.tax_treatment === "cross_border" ? "Cross-border" : hasTax ? "Domestic" : "",
                    Number(r.amount ?? 0).toFixed(2),
                    hasTax ? `${((r.withholding_rate ?? 0) * 100).toFixed(2)}%` : "",
                    hasTax ? Number(r.withheld_amount ?? 0).toFixed(2) : "0.00",
                    Number(hasTax ? r.net_amount ?? 0 : r.amount ?? 0).toFixed(2),
                    r.local_amount !== null ? Number(r.local_amount).toFixed(2) : "",
                    r.local_currency, r.fx_rate ?? "", r.fx_pinned_at ?? "",
                    r.invoice_number, r.description, r.tx_hash, r.company_country,
                ];
            }),
        );
        downloadCsv(exportName(title, "csv"), csv);
    }

    return (
        <div>
            {/* ── toolbar: screen only ─────────────────────────────────────── */}
            <div className="no-print card p-3 md:p-4">
                {onBack && (
                    <button onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-dim)] hover:text-[var(--text)] transition mb-3">
                        <ArrowLeft size={14} /> All clients
                    </button>
                )}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="relative flex-1 min-w-0">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                            value={q} onChange={(e) => setQ(e.target.value)}
                            placeholder="Search name, tax ID, invoice, wallet or transaction hash"
                            aria-label="Search payments"
                            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Select value={year} onChange={setYear} label="Year"
                            options={[[ALL, "All years"], ...years.map((y) => [String(y), String(y)] as [string, string])]} />
                        <Select value={country} onChange={setCountry} label="Country"
                            options={[[ALL, "All countries"], ...countries.map((c) => [c, c] as [string, string])]} />
                        <Select value={treatment} onChange={setTreatment} label="Treatment"
                            options={[[ALL, "All treatments"], ["domestic", "Domestic"], ["cross_border", "Cross-border"]]} />
                        <Select value={sort} onChange={(v) => setSort(v as SortKey)} label="Sort"
                            options={[["date_desc", "Newest first"], ["date_asc", "Oldest first"], ["amount_desc", "Largest first"], ["amount_asc", "Smallest first"], ["name_asc", "Name A–Z"]]} />
                        <button onClick={exportCsv} disabled={rows.length === 0}
                            className="inline-flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent-line)] transition disabled:opacity-40">
                            <Sheet size={15} /> Excel
                        </button>
                        <button onClick={() => window.print()} disabled={rows.length === 0}
                            className="btn-primary text-sm py-2 px-4 disabled:opacity-40">
                            <Printer size={15} /> PDF
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
                        <button onClick={clearAll}
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
                            <h2 className="text-2xl font-medium tracking-[-0.02em] mt-1">{title}</h2>
                        </div>
                        <div className="text-right text-[11px] font-mono text-[var(--text-faint)] leading-relaxed">
                            <div>Generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
                            <div>{rows.length} of {records.length} payment{records.length === 1 ? "" : "s"}</div>
                        </div>
                    </div>

                    {/* Scope. Prints with the document — the reader must know what
                        this covers and, just as importantly, what it leaves out. */}
                    <div className={`mt-4 rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed border ${filtered
                        ? "border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)]"}`}>
                        {filtered ? (
                            <><span className="font-medium">Partial record.</span>{" "}
                                Showing {rows.length} of {records.length} payments, filtered by {active.map((f) => f.label).join(" · ")}.</>
                        ) : (
                            <>Complete record — all {records.length} payment{records.length === 1 ? "" : "s"} on file, no filters applied.</>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)] border-b border-[var(--border)]">
                    <Stat label="Gross paid" value={`$${money(totals.gross)}`} accent />
                    <Stat label="Tax withheld" value={`$${money(totals.withheld)}`} />
                    <Stat label="Net to contractors" value={`$${money(totals.gross - totals.withheld)}`} />
                    <Stat label="Contractors" value={`${totals.people}`} sub={`${totals.countries} countr${totals.countries === 1 ? "y" : "ies"}`} />
                </div>

                {/* Withholding only exists when payer and contractor share a
                    country, so a book of purely cross-border payments has none —
                    and then Gross, Withheld and Net are three columns saying the
                    same number. Show the split only when it splits. */}
                {rows.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-[15px] font-medium">No payments match these filters</div>
                        <p className="text-[var(--text-dim)] text-sm mt-1.5">Try a different year or country, or clear the filters to see everything.</p>
                        <button onClick={clearAll} className="no-print mt-4 text-sm text-[var(--accent)] underline underline-offset-2">Clear all filters</button>
                    </div>
                ) : (
                    <Table rows={rows} showTax={totals.withheld > 0} />
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
// Column budget, widest first: the table must fit its container without
// sideways scrolling, so secondary columns fold away as width runs out and the
// drill-down carries them instead. Nothing is ever only available by scrolling.

function Table({ rows, showTax }: { rows: SavedRecord[]; showTax: boolean }) {
    return (
        <table className="w-full table-fixed border-collapse text-left">
            <thead className="audit-thead sticky top-0 z-10 bg-[var(--surface-2)]">
                <tr className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                    <Th className="w-[84px]">Date</Th>
                    <Th>Contractor</Th>
                    <Th className="hidden md:table-cell w-[124px]">Invoice</Th>
                    <Th className="hidden xl:table-cell w-[136px]">Wallet</Th>
                    <Th className="hidden lg:table-cell w-[110px]">Treatment</Th>
                    <Th className="w-[100px] text-right">{showTax ? "Gross" : "Amount"}</Th>
                    {showTax && <Th className="hidden sm:table-cell w-[96px] text-right">Withheld</Th>}
                    {showTax && <Th className="w-[96px] text-right">Net</Th>}
                    <Th className="hidden sm:table-cell w-[100px]">Proof</Th>
                    <Th className="w-[34px] no-print" />
                </tr>
            </thead>
            <tbody>
                {rows.map((r) => <Row key={r.id} r={r} showTax={showTax} />)}
            </tbody>
        </table>
    );
}

function CopyButton({ value, title }: { value: string; title: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                });
            }}
            title={title}
            className="no-print shrink-0 text-[var(--text-faint)] hover:text-[var(--text)] transition"
        >
            {copied ? <Check size={11} className="text-[var(--accent)]" /> : <Copy size={11} />}
        </button>
    );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
    return <th scope="col" className={`px-3 py-2.5 font-normal border-b border-[var(--border)] ${className}`}>{children}</th>;
}

function Row({ r, showTax }: { r: SavedRecord; showTax: boolean }) {
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
                    <div className="text-[11px] text-[var(--text-faint)] truncate">
                        <span className="mr-1">{flagFor(r.tax_country ?? "")}</span>{r.tax_country ?? "—"}
                        {r.contractor_tax_id && <span className="font-mono"> · {r.contractor_tax_id}</span>}
                    </div>
                    {/* Wallet rides under the name below xl, and prints there too,
                        so it is never lost when the column folds away. */}
                    <div className="audit-wallet xl:hidden flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-[var(--text-faint)] truncate">{shortAddr(r.payee_wallet)}</span>
                        {r.payee_wallet && <CopyButton value={r.payee_wallet} title="Copy full wallet address" />}
                    </div>
                </Td>
                <Td className="hidden md:table-cell font-mono text-[11px] text-[var(--text-dim)] truncate">
                    {r.invoice_number || <span className="text-[var(--text-faint)]">—</span>}
                </Td>
                <Td className="hidden xl:table-cell">
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-[var(--text-dim)] truncate">{shortAddr(r.payee_wallet)}</span>
                        {r.payee_wallet && <CopyButton value={r.payee_wallet} title="Copy full wallet address" />}
                    </div>
                </Td>
                <Td className="hidden lg:table-cell text-[12px] text-[var(--text-dim)] whitespace-nowrap">
                    <span className={`dot ${crossBorder ? "dot-ok" : hasTax ? "dot-pending" : "dot-failed"} mr-1.5`} />
                    {crossBorder ? "Cross-border" : hasTax ? "Domestic" : "—"}
                </Td>
                <Td className={`font-mono text-[13px] text-right whitespace-nowrap ${showTax ? "" : "font-medium"}`}>
                    ${money(r.amount)}
                </Td>
                {showTax && (
                    <Td className="hidden sm:table-cell font-mono text-[13px] text-right whitespace-nowrap text-[var(--text-dim)]">
                        {hasTax ? `−$${money(r.withheld_amount)}` : "—"}
                    </Td>
                )}
                {showTax && (
                    <Td className="font-mono text-[13px] text-right whitespace-nowrap font-medium">${money(net)}</Td>
                )}
                <Td className="hidden sm:table-cell whitespace-nowrap">
                    {r.tx_hash ? (
                        <a href={`https://sepolia.basescan.org/tx/${r.tx_hash}`} target="_blank" rel="noreferrer"
                            className="font-mono text-[11px] text-[var(--accent)] hover:underline underline-offset-2">
                            {r.tx_hash.slice(0, 8)}…
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
                    <td colSpan={showTax ? 10 : 8} className="px-3 md:px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">Wallet paid</div>
                                <div className="flex items-start gap-1.5">
                                    <span className="font-mono text-[12px] text-[var(--text)] break-all">{r.payee_wallet ?? "—"}</span>
                                    {r.payee_wallet && <CopyButton value={r.payee_wallet} title="Copy full wallet address" />}
                                </div>
                            </div>
                            <Detail label="Local value"
                                value={r.local_amount !== null && r.local_currency ? `${money(r.local_amount)} ${r.local_currency}` : "—"}
                                sub={r.fx_rate ? `rate ${Number(r.fx_rate).toFixed(4)}, pinned ${r.fx_pinned_at ?? "at pay time"}` : undefined} />
                            <Detail label="Withholding"
                                value={hasTax ? `${((r.withholding_rate ?? 0) * 100).toFixed(0)}% · $${money(r.withheld_amount)}` : "None"}
                                sub={crossBorder ? "Payer outside the contractor's country" : rule?.withholdingLabel} />
                            <Detail label="Invoice" value={r.invoice_number || "—"} sub={r.description || undefined} />
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
    return <td className={`px-3 py-3 align-top ${className}`}>{children}</td>;
}

function Detail({ label, value, sub, mono, breakAll }: {
    label: string; value: string; sub?: string; mono?: boolean; breakAll?: boolean;
}) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className={`text-[12px] text-[var(--text)] ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : ""}`}>{value}</div>
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
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
            className="text-[13px] px-2.5 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition">
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}
