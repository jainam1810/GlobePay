"use client";
// The audit pack: every payment a company made, grouped by the freelancer's
// country, with the tax treatment and the FX rate that was frozen at pay time,
// and an on-chain hash anyone can verify independently.
//
// Deliberately printed rather than generated with a PDF library: the browser's
// own print engine handles pagination, fonts and page breaks better than we
// would by hand, and it keeps the bundle free of a ~350KB dependency. What you
// see is exactly what comes out.
import { useEffect, useMemo, useState } from "react";
import { Printer, AlertCircle, Loader2, FileText, ExternalLink } from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { getTaxRule } from "@/lib/tax-rules";
import { flagFor } from "@/lib/contractor-types";

const ALL = "__all__";

export default function AuditPack({ companyName }: { companyName?: string }) {
    const [records, setRecords] = useState<SavedRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [client, setClient] = useState<string>(ALL);

    useEffect(() => {
        fetch("/api/records")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRecords(j.records || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }, []);

    // Only GlobePay admins see rows from more than one client.
    const clientNames = useMemo(
        () => [...new Set((records || []).map((r) => r.client_name).filter((n): n is string => !!n))].sort(),
        [records],
    );
    const visible = useMemo(
        () => (records || []).filter((r) => client === ALL || r.client_name === client),
        [records, client],
    );

    // An audit pack is read country by country — that's how a tax authority or
    // an accountant asks for it.
    const byCountry = useMemo(() => {
        const m = new Map<string, SavedRecord[]>();
        visible.forEach((r) => {
            const k = r.tax_country || "Unspecified";
            m.set(k, [...(m.get(k) ?? []), r]);
        });
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }, [visible]);

    const totals = useMemo(() => ({
        gross: visible.reduce((s, r) => s + Number(r.amount || 0), 0),
        withheld: visible.reduce((s, r) => s + Number(r.withheld_amount || 0), 0),
        people: new Set(visible.map((r) => r.payee_name)).size,
    }), [visible]);

    const scope = client === ALL ? (companyName ?? "All clients") : client;
    const generated = new Date();

    if (error) {
        return (
            <div className="rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                <AlertCircle size={15} /> {error}
            </div>
        );
    }
    if (records === null) {
        return (
            <div className="card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                <Loader2 size={15} className="animate-spin" /> Building your audit pack…
            </div>
        );
    }
    if (records.length === 0) {
        return (
            <div className="card p-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4"><FileText size={20} /></div>
                <div className="font-display text-xl font-semibold">Nothing to export yet</div>
                <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                    Once a payroll is confirmed, every payment appears here as an audit-ready record — tax treatment, FX rate and on-chain proof included.
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Controls — hidden when printing, they aren't part of the document */}
            <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                    {clientNames.length > 1 && (
                        <>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mr-1">Client</span>
                            <Pill label="All clients" active={client === ALL} onClick={() => setClient(ALL)} />
                            {clientNames.map((n) => <Pill key={n} label={n} active={client === n} onClick={() => setClient(n)} />)}
                        </>
                    )}
                </div>
                <button onClick={() => window.print()} className="btn-primary text-sm">
                    <Printer size={15} /> Download PDF
                </button>
            </div>

            <div className="audit-doc card p-8 md:p-10">
                {/* Document header */}
                <div className="flex items-start justify-between gap-6 flex-wrap border-b border-[var(--border)] pb-6">
                    <div>
                        <div className="kicker">Audit pack</div>
                        <h2 className="font-display text-2xl font-semibold tracking-tight mt-1">{scope}</h2>
                        <p className="text-[var(--text-dim)] text-sm mt-1">
                            Every payment, with the tax treatment and exchange rate recorded at the moment it was paid.
                        </p>
                    </div>
                    <div className="text-right text-[11px] font-mono text-[var(--text-faint)] leading-relaxed">
                        <div>Generated {generated.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
                        <div>{visible.length} payment{visible.length === 1 ? "" : "s"} · {totals.people} freelancer{totals.people === 1 ? "" : "s"}</div>
                        <div>{byCountry.length} countr{byCountry.length === 1 ? "y" : "ies"}</div>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 py-6 border-b border-[var(--border)]">
                    <Total label="Total paid" value={`$${fmt(totals.gross)}`} accent />
                    <Total label="Tax withheld" value={`$${fmt(totals.withheld)}`} />
                    <Total label="Net to freelancers" value={`$${fmt(totals.gross - totals.withheld)}`} />
                </div>

                {byCountry.map(([country, rows]) => (
                    <CountrySection key={country} country={country} rows={rows} />
                ))}

                <div className="mt-8 pt-5 border-t border-[var(--border)] text-[10px] text-[var(--text-faint)] leading-relaxed">
                    Every payment listed here is anchored to a public blockchain transaction. The Proof reference is that
                    transaction&rsquo;s hash — anyone can verify the amount, the recipient and the timestamp independently on
                    Basescan, without trusting GlobePay or the payer. Exchange rates are the rates recorded on the day of
                    payment and are not recalculated. Withholding is shown where the payer and freelancer are in the same
                    country; cross-border payments are made in full, with the freelancer self-reporting locally.
                </div>
            </div>
        </div>
    );
}

function CountrySection({ country, rows }: { country: string; rows: SavedRecord[] }) {
    const rule = getTaxRule(country);
    const gross = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const withheld = rows.reduce((s, r) => s + Number(r.withheld_amount || 0), 0);

    return (
        <section className="audit-section pt-6">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                    <span>{flagFor(country)}</span> {country}
                </h3>
                <div className="font-mono text-xs text-[var(--text-dim)]">
                    {rows.length} payment{rows.length === 1 ? "" : "s"} · ${fmt(gross)} gross
                    {withheld > 0 && <> · ${fmt(withheld)} withheld</>}
                </div>
            </div>
            {rule && (
                <div className="text-[10px] text-[var(--text-faint)] mt-1 font-mono">
                    {rule.withholdingLabel} · {rule.source}
                </div>
            )}

            <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {rows.map((r) => <Row key={r.id} r={r} />)}
            </div>
        </section>
    );
}

function Row({ r }: { r: SavedRecord }) {
    const rule = r.tax_country ? getTaxRule(r.tax_country) : null;
    const paid = r.paid_at ? new Date(r.paid_at) : r.invoice_date ? new Date(r.invoice_date) : null;
    const hasTax = r.withholding_rate !== null && r.withheld_amount !== null;
    const crossBorder = r.tax_treatment === "cross_border";

    return (
        <div className="audit-row py-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div className="font-medium text-[15px]">{r.payee_name}</div>
                <div className="font-mono text-[15px] font-semibold">${fmt(r.amount)}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-3">
                <Field label="Paid on" value={paid ? paid.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"} />
                <Field label="Treatment" value={crossBorder ? "Cross-border" : hasTax ? "Domestic" : "—"} />
                {r.local_amount !== null && r.local_currency ? (
                    <Field
                        label={`Local value · rate ${r.fx_rate ? Number(r.fx_rate).toFixed(4) : "—"}`}
                        value={`${fmt(r.local_amount)} ${r.local_currency}`}
                    />
                ) : <Field label="Local value" value="—" />}
                {hasTax ? (
                    <Field label={`Withheld · ${((r.withholding_rate ?? 0) * 100).toFixed(0)}%`} value={`$${fmt(r.withheld_amount)}`} />
                ) : (
                    <Field label="Withheld" value={crossBorder ? "None — payer abroad" : "—"} />
                )}
            </div>

            {r.contractor_tax_id && rule && (
                <div className="mt-2 text-[10px] font-mono text-[var(--text-faint)]">
                    {rule.taxIdName} {r.contractor_tax_id}
                </div>
            )}

            {r.tx_hash && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-faint)] break-all">
                    <span className="uppercase tracking-wider shrink-0">Proof</span>
                    <a href={`https://sepolia.basescan.org/tx/${r.tx_hash}`} target="_blank" rel="noreferrer"
                        className="text-[var(--accent)] hover:underline underline-offset-2 inline-flex items-center gap-1">
                        {r.tx_hash}<ExternalLink size={9} className="no-print shrink-0" />
                    </a>
                </div>
            )}
        </div>
    );
}

const fmt = (n: number | null | undefined) =>
    Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className={`font-mono text-xl font-semibold ${accent ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-0.5">{label}</div>
            <div className="font-mono text-xs text-[var(--text)]">{value}</div>
        </div>
    );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${active
                ? "border-[var(--accent)] bg-[rgba(47,230,168,0.08)] text-[var(--accent)]"
                : "border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}>
            {label}
        </button>
    );
}
