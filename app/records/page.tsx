"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Database, AlertCircle, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { getTaxRule, validateTaxId } from "@/lib/tax-rules";
import { flagFor } from "@/lib/contractor-types";

export default function RecordsPage() {
    const [records, setRecords] = useState<SavedRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        fetch("/api/records")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRecords(j.records || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }, []);

    const filtered = useMemo(() => {
        if (!records) return [];
        const q = query.trim().toLowerCase();
        if (!q) return records;
        return records.filter((r) =>
            r.payee_name?.toLowerCase().includes(q) ||
            r.description?.toLowerCase().includes(q) ||
            r.currency?.toLowerCase().includes(q) ||
            r.invoice_number?.toLowerCase().includes(q)
        );
    }, [records, query]);

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="kicker">Audit trail</div>
                    <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Records</h1>
                    <p className="text-[var(--text-dim)] mt-2 max-w-md">Every confirmed invoice — searchable, persistent, audit-ready.</p>
                </div>
                {records && records.length > 0 && (
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search payee, description, currency…"
                            className="w-full md:w-80 pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                        />
                    </div>
                )}
            </div>

            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {records === null && !error && (
                <div className="fade-up mt-8 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading records…
                </div>
            )}

            {records && records.length === 0 && (
                <EmptyState />
            )}

            {records && records.length > 0 && (
                <>
                    <div className="fade-up delay-1 mt-6 text-xs text-[var(--text-faint)] font-mono">
                        {filtered.length} of {records.length} record{records.length === 1 ? "" : "s"}
                    </div>
                    <div className="fade-up delay-2 mt-3 space-y-3">
                        {filtered.map((r) => <RecordRow key={r.id} r={r} />)}
                        {filtered.length === 0 && (
                            <div className="card p-8 text-center text-sm text-[var(--text-dim)]">No records match &ldquo;{query}&rdquo;.</div>
                        )}
                    </div>
                    <FxFootnote />
                </>
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="fade-up mt-8 card p-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4">
                <Database size={20} />
            </div>
            <div className="font-display text-xl font-semibold">No records yet</div>
            <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                Save your first invoice and it&rsquo;ll appear here — fully searchable, year after year.
            </p>
            <Link href="/invoices" className="btn-primary mt-6 inline-flex"><Sparkles size={15} /> Extract an invoice</Link>
        </div>
    );
}
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function RecordRow({ r }: { r: SavedRecord }) {
    const created = new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const invDate = r.invoice_date ? new Date(r.invoice_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
    const fxDate = r.fx_pinned_at ? new Date(r.fx_pinned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : null;
    const rule = r.tax_country ? getTaxRule(r.tax_country) : null;
    const idValid = r.contractor_tax_id && rule ? validateTaxId(r.contractor_tax_id, r.tax_country!) : null;

    const hasTax = r.withholding_rate !== null && r.withheld_amount !== null && r.net_amount !== null;
    const crossBorder = r.tax_treatment === "cross_border";
    const hasFx = r.local_amount !== null && r.local_currency;

    return (
        <div className="card overflow-hidden">
            <div className="flex items-start gap-4 p-5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(47,230,168,0.08)] border border-[rgba(47,230,168,0.2)] text-[var(--accent)]">
                    <FileText size={17} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--text)] text-[15px]">{r.payee_name}</span>
                        {r.ai_confidence && <ConfidencePill level={r.ai_confidence} />}
                        {hasFx && <Tag color="accent">FX pinned</Tag>}
                        {hasTax && <Tag color="amber">Tax withheld</Tag>}
                        {crossBorder && <Tag color="accent">Cross-border</Tag>}
                        {r.payment && <PaidTag payment={r.payment} />}
                    </div>
                    {r.description && <div className="text-sm text-[var(--text-dim)] mt-1 line-clamp-1">{r.description}</div>}
                    <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-[var(--text-faint)] flex-wrap">
                        {invDate && <span>Invoice {invDate}</span>}
                        {r.invoice_number && <><span className="opacity-40">·</span><span>#{r.invoice_number}</span></>}
                        <span className="opacity-40">·</span><span>Saved {created}</span>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="font-mono text-xl font-semibold text-[var(--text)]">{fmt(r.amount)}</div>
                    <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono tracking-wider">{r.currency} gross</div>
                </div>
            </div>

            {r.ai_notes && (
                <div className="mx-5 mb-4 -mt-1 flex items-start gap-2 text-xs text-[#f5b14c] bg-[rgba(245,177,76,0.06)] border border-[rgba(245,177,76,0.18)] rounded-lg px-3 py-2">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" /> <span>{r.ai_notes}</span>
                </div>
            )}

            {(hasTax || crossBorder || hasFx) && (
                <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-5 py-4">
                    {hasTax ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                            <Metric label="Gross" value={`${fmt(r.amount)} ${r.currency}`} />
                            <Metric label={`Withholding · ${(r.withholding_rate! * 100).toFixed(0)}%`} value={`− ${fmt(r.withheld_amount!)}`} tone="amber" />
                            <Metric label="Net to contractor" value={`${fmt(r.net_amount!)} ${r.currency}`} tone="accent" emphasis />
                            {hasFx && <Metric label={`Local value · pinned ${fxDate}`} value={`≈ ${fmt(r.local_amount!)} ${r.local_currency}`} />}
                        </div>
                    ) : (
                        <CrossBorderStrip r={r} fxDate={fxDate} hasFx={!!hasFx} />
                    )}

                    <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3 border-t border-[var(--border)]">
                        {r.contractor_tax_id && rule ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-dim)]">
                                <span className="text-[var(--text-faint)] uppercase tracking-wider">{rule.taxIdName}</span>
                                <span>{r.contractor_tax_id}</span>
                                {idValid ? <CheckCircle2 size={12} className="text-[var(--accent)]" /> : <AlertCircle size={12} className="text-[#f5b14c]" />}
                            </div>
                        ) : <span />}
                        {rule && hasTax && <div className="text-[10px] font-mono text-[var(--text-faint)]">{r.tax_country} · {rule.source}</div>}
                    </div>
                </div>
            )}
        </div>
    );
}

function CrossBorderStrip({ r, fxDate, hasFx }: { r: SavedRecord; fxDate: string | null; hasFx: boolean }) {
    return (
        <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <span>{r.company_country ? flagFor(r.company_country) : "🌐"}</span>
                <span className="text-[var(--text-dim)]">{r.company_country ?? "Company"}</span>
                <span className="text-[var(--text-faint)]">→</span>
                <span>{r.tax_country ? flagFor(r.tax_country) : "🌐"}</span>
                <span className="text-[var(--text-dim)]">{r.tax_country ?? "Contractor"}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] border border-[rgba(47,230,168,0.25)] bg-[rgba(47,230,168,0.06)] rounded px-1.5 py-0.5 ml-1">cross-border</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                <Metric label="Paid in full (no withholding)" value={`${fmt(r.amount)} ${r.currency}`} tone="accent" emphasis />
                {hasFx && <Metric label={`Local value · pinned ${fxDate}`} value={`≈ ${fmt(r.local_amount!)} ${r.local_currency}`} />}
                <Metric label="Booked as" value="Operating expense" />
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-3 leading-relaxed">
                Payer is outside the contractor&rsquo;s country, so no local withholding applies — the contractor self-reports income to their own tax authority. Recorded as a deductible business expense for the company.
            </p>
        </div>
    );
}

function Metric({ label, value, tone = "default", emphasis }: { label: string; value: string; tone?: "default" | "accent" | "amber"; emphasis?: boolean }) {
    const valueColor = tone === "accent" ? "text-[var(--accent)]" : tone === "amber" ? "text-[#f5b14c]" : "text-[var(--text)]";
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className={`font-mono ${emphasis ? "text-base font-semibold" : "text-sm"} ${valueColor}`}>{value}</div>
        </div>
    );
}

function PaidTag({ payment }: { payment: { tx_hash: string; paid_at: string | null } }) {
    const date = payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
    return (
        <Link href="/payments"
            title={date ? `Paid on ${date} — view receipt` : "View receipt"}
            className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 text-[#04130d] bg-[var(--accent)] border-[var(--accent)] font-semibold hover:opacity-90 transition">
            <CheckCircle2 size={10} /> Paid
        </Link>
    );
}

function Tag({ children, color }: { children: React.ReactNode; color: "accent" | "amber" }) {
    const cls = color === "accent"
        ? "text-[var(--accent)] bg-[rgba(47,230,168,0.07)] border-[rgba(47,230,168,0.22)]"
        : "text-[#f5b14c] bg-[rgba(245,177,76,0.07)] border-[rgba(245,177,76,0.22)]";
    return <span className={`text-[9px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${cls}`}>{children}</span>;
}

function ConfidencePill({ level }: { level: string }) {
    const map: Record<string, string> = {
        high: "text-[var(--accent)] bg-[rgba(47,230,168,0.08)] border-[rgba(47,230,168,0.25)]",
        medium: "text-[#f5b14c] bg-[rgba(245,177,76,0.08)] border-[rgba(245,177,76,0.25)]",
        low: "text-[#ff6b6b] bg-[rgba(255,107,107,0.08)] border-[rgba(255,107,107,0.25)]",
    };
    const cls = map[level] || map.medium;
    return <span className={`text-[9px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${cls}`}>{level}</span>;
}

function FxFootnote() {
    return (
        <div className="fade-up mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40">
            <div className="flex items-start gap-2.5 text-[11px] text-[var(--text-faint)] leading-relaxed">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] shrink-0 mt-0.5">Note</div>
                <div>
                    FX rates from <span className="font-mono">fawazahmed0/currency-api</span> (open daily mid-market feed via jsDelivr CDN).
                    Records pin <span className="text-[var(--text-dim)]">1&nbsp;USDC&nbsp;=&nbsp;1&nbsp;USD </span>  at par -
                    accurate to ~5 basis points; production tracks the company&rsquo;s actual USDC acquisition rate per top-up.
                </div>
            </div>
        </div>
    );
}