"use client";
// Shared tax/compliance ledger: one row per paid freelancer per payroll run,
// written automatically at execution. Domestic rows show gross → WHT → net;
// cross-border rows show the paid-in-full / self-reports panel. The API
// scopes rows by session (client: own; GlobePay admin: all + client names).
import { useEffect, useMemo, useState } from "react";
import { Search, Scale, AlertCircle, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { getTaxRule, validateTaxId } from "@/lib/tax-rules";
import { flagFor } from "@/lib/contractor-types";

export default function TaxLedger() {
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
            r.tax_country?.toLowerCase().includes(q) ||
            r.client_name?.toLowerCase().includes(q) ||
            r.tax_treatment?.toLowerCase().includes(q)
        );
    }, [records, query]);

    return (
        <div>
            {records && records.length > 0 && (
                <div className="fade-up relative max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, country, treatment…"
                        className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                    />
                </div>
            )}

            {error && (
                <div className="fade-up mt-4 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {records === null && !error && (
                <div className="fade-up mt-4 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading ledger…
                </div>
            )}

            {records && records.length === 0 && (
                <div className="fade-up mt-4 card p-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4">
                        <Scale size={20} />
                    </div>
                    <div className="font-display text-xl font-semibold">Ledger is empty</div>
                    <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                        When a payroll is confirmed, every freelancer paid gets a tax entry here automatically — treatment, withholding, FX rate, all pinned at pay time.
                    </p>
                </div>
            )}

            {records && records.length > 0 && (
                <>
                    <div className="fade-up mt-4 text-xs text-[var(--text-faint)] font-mono">
                        {filtered.length} of {records.length} entr{records.length === 1 ? "y" : "ies"}
                    </div>
                    <div className="fade-up mt-3 space-y-3">
                        {filtered.map((r) => <LedgerRow key={r.id} r={r} />)}
                        {filtered.length === 0 && (
                            <div className="card p-8 text-center text-sm text-[var(--text-dim)]">No entries match &ldquo;{query}&rdquo;.</div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

const fmt = (n: number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

function LedgerRow({ r }: { r: SavedRecord }) {
    const paidDate = r.invoice_date ? new Date(r.invoice_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
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
                    <Scale size={17} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--text)] text-[15px]">{r.payee_name}</span>
                        {r.client_name && <Tag color="neutral">{r.client_name}</Tag>}
                        {hasTax && <Tag color="amber">Tax withheld</Tag>}
                        {crossBorder && <Tag color="accent">Cross-border</Tag>}
                        {r.tx_hash && (
                            <a href={`https://sepolia.basescan.org/tx/${r.tx_hash}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#04130d] bg-[var(--accent)] border border-[var(--accent)] rounded px-1.5 py-0.5 font-semibold hover:opacity-90 transition">
                                <CheckCircle2 size={10} /> Paid <ExternalLink size={9} />
                            </a>
                        )}
                    </div>
                    {r.description && <div className="text-sm text-[var(--text-dim)] mt-1 line-clamp-1">{r.description}</div>}
                    <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-[var(--text-faint)] flex-wrap">
                        {paidDate && <span>Paid {paidDate}</span>}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="font-mono text-xl font-semibold text-[var(--text)]">{fmt(r.amount)}</div>
                    <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono tracking-wider">{r.currency} gross</div>
                </div>
            </div>

            {(hasTax || crossBorder || hasFx) && (
                <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-5 py-4">
                    {hasTax ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                            <Metric label="Gross" value={`${fmt(r.amount)} ${r.currency}`} />
                            <Metric label={`Withholding · ${(r.withholding_rate! * 100).toFixed(0)}%`} value={`− ${fmt(r.withheld_amount!)}`} tone="amber" />
                            <Metric label="Net to freelancer" value={`${fmt(r.net_amount!)} ${r.currency}`} tone="accent" emphasis />
                            {hasFx && <Metric label={`Local value · pinned ${fxDate}`} value={`≈ ${fmt(r.local_amount!)} ${r.local_currency}`} />}
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                                <span>{r.company_country ? flagFor(r.company_country) : "🌐"}</span>
                                <span className="text-[var(--text-dim)]">{r.company_country ?? "Company"}</span>
                                <span className="text-[var(--text-faint)]">→</span>
                                <span>{r.tax_country ? flagFor(r.tax_country) : "🌐"}</span>
                                <span className="text-[var(--text-dim)]">{r.tax_country ?? "Freelancer"}</span>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent)] border border-[rgba(47,230,168,0.25)] bg-[rgba(47,230,168,0.06)] rounded px-1.5 py-0.5 ml-1">cross-border</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                                <Metric label="Paid in full (no withholding)" value={`${fmt(r.amount)} ${r.currency}`} tone="accent" emphasis />
                                {hasFx && <Metric label={`Local value · pinned ${fxDate}`} value={`≈ ${fmt(r.local_amount!)} ${r.local_currency}`} />}
                                <Metric label="Booked as" value="Operating expense" />
                            </div>
                            <p className="text-[11px] text-[var(--text-dim)] mt-3 leading-relaxed">
                                Payer is outside the freelancer&rsquo;s country, so no local withholding applies — the freelancer self-reports income to their own tax authority. Recorded as a deductible business expense for the company.
                            </p>
                        </div>
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

function Metric({ label, value, tone = "default", emphasis }: { label: string; value: string; tone?: "default" | "accent" | "amber"; emphasis?: boolean }) {
    const valueColor = tone === "accent" ? "text-[var(--accent)]" : tone === "amber" ? "text-[#f5b14c]" : "text-[var(--text)]";
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className={`font-mono ${emphasis ? "text-base font-semibold" : "text-sm"} ${valueColor}`}>{value}</div>
        </div>
    );
}

function Tag({ children, color }: { children: React.ReactNode; color: "accent" | "amber" | "neutral" }) {
    const cls = color === "accent"
        ? "text-[var(--accent)] bg-[rgba(47,230,168,0.07)] border-[rgba(47,230,168,0.22)]"
        : color === "amber"
            ? "text-[#f5b14c] bg-[rgba(245,177,76,0.07)] border-[rgba(245,177,76,0.22)]"
            : "text-[var(--text-dim)] border-[var(--border-strong)]";
    return <span className={`text-[9px] font-mono uppercase tracking-wider border rounded px-1.5 py-0.5 ${cls}`}>{children}</span>;
}
