"use client";
// Payment analytics.
//
// Form was chosen before colour, and the colour work mostly cancelled itself:
// every chart here is a SINGLE series, so there is no categorical palette to
// get wrong. Country and contractor bars all take one hue — colouring each bar
// darker-where-bigger would double-encode length as hue and burn the only free
// channel on information the bar already shows.
//
// The accent (#2B6BFF) was validated against the real card surface (#0F1219)
// rather than eyeballed: lightness band, chroma floor and ≥3:1 contrast all
// pass. The status trio was run through the same checker as a categorical set
// and FAILED — #66D555 and #EFBE54 sit ΔE 1.9 apart under protanopia, i.e.
// indistinguishable. That is survivable only because status in this product is
// always a dot *beside a word* ("Paid", "Awaiting signature"), never colour on
// its own. It is not survivable in a chart, which is the argument for one hue
// here rather than four.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Loader2, AlertCircle, BarChart3, Table2 } from "lucide-react";
import type { SavedRecord } from "@/lib/records";

import { format, parseISO } from "date-fns";
import { Select as UiSelect, toOptions } from "@/components/ui/select";

// Recharts needs a literal — it cannot resolve a CSS custom property here.
// Keep this in step with --accent in globals.css.
const ACCENT = "#2B6BFF";
const GRID = "var(--border)";
const INK_DIM = "var(--text-dim)";

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const money2 = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dayOf = (r: SavedRecord) => (r.paid_at ?? r.invoice_date ?? r.created_at).slice(0, 10);

export default function Analytics({ scopeLabel }: { scopeLabel?: string }) {
    const [records, setRecords] = useState<SavedRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [year, setYear] = useState("__all__");
    const [client, setClient] = useState("__all__");

    useEffect(() => {
        fetch("/api/records")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRecords(j.records || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }, []);

    const all = useMemo(() => records ?? [], [records]);
    const years = useMemo(
        () => [...new Set(all.map((r) => dayOf(r).slice(0, 4)))].sort((a, b) => b.localeCompare(a)), [all]);
    const clients = useMemo(
        () => [...new Set(all.map((r) => r.client_name).filter((c): c is string => !!c))].sort(), [all]);

    // One filter row scopes every chart below — never per-chart filters.
    const rows = useMemo(() => all.filter((r) => {
        if (year !== "__all__" && dayOf(r).slice(0, 4) !== year) return false;
        if (client !== "__all__" && r.client_name !== client) return false;
        return true;
    }), [all, year, client]);

    const stats = useMemo(() => ({
        total: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
        count: rows.length,
        people: new Set(rows.map((r) => r.payee_name)).size,
        countries: new Set(rows.map((r) => r.tax_country).filter(Boolean)).size,
    }), [rows]);

    const byMonth = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of rows) {
            const k = dayOf(r).slice(0, 7);          // YYYY-MM
            m.set(k, (m.get(k) ?? 0) + Number(r.amount || 0));
        }
        // The year is only on the label when it has to be. Filtered to a single
        // year it is the same four digits on every column — noise that crowds
        // the axis and makes months collide on a narrow screen. Across all time
        // it is load-bearing, because otherwise two different Augusts read as
        // one bar repeated.
        const fmt = year === "__all__" ? "MMM yy" : "MMM";
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => ({ key: k, label: format(parseISO(`${k}-01`), fmt), value: Math.round(v) }));
    }, [rows, year]);

    // Top-N by total. Memoised on `rows` alone — the key functions are pure and
    // constant, so listing them as deps would just churn on every render.
    const rank = useCallback((key: (r: SavedRecord) => string | null, limit = 6) => {
        const m = new Map<string, { sum: number; n: number }>();
        for (const r of rows) {
            const k = key(r);
            if (!k) continue;
            const g = m.get(k) ?? { sum: 0, n: 0 };
            g.sum += Number(r.amount || 0); g.n++;
            m.set(k, g);
        }
        return [...m.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, limit)
            .map(([k, g]) => ({ label: k, value: Math.round(g.sum), n: g.n }));
    }, [rows]);
    const byCountry = useMemo(() => rank((r) => r.tax_country), [rank]);
    const byPerson = useMemo(() => rank((r) => r.payee_name), [rank]);
    const byClient = useMemo(() => rank((r) => r.client_name ?? null), [rank]);

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
                <Loader2 size={15} className="animate-spin" /> Loading analytics…
            </div>
        );
    }
    if (all.length === 0) {
        return (
            <div className="card p-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-4"><BarChart3 size={20} /></div>
                <div className="text-xl font-medium tracking-[-0.02em]">Nothing to analyse yet</div>
                <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                    Once a payroll is confirmed, totals by month, country and contractor appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* One filter row above everything it scopes. */}
            <div className="fade-up card p-3 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] mr-1">Showing</span>
                <Select value={year} onChange={setYear} label="Year"
                    options={[["__all__", "All years"], ...years.map((y) => [y, y] as [string, string])]} />
                {clients.length > 1 && (
                    <Select value={client} onChange={setClient} label="Client"
                        options={[["__all__", "All clients"], ...clients.map((c) => [c, c] as [string, string])]} />
                )}
                <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                    {rows.length} of {all.length} payments
                </span>
            </div>

            {/* Hero + KPI row. These are numbers, not charts — a one-bar bar chart
                is the classic way to make a headline figure harder to read.
                Proportional figures on the hero: tabular-nums makes large digits
                look loose. */}
            <div className="fade-up delay-1 card p-6 md:p-7">
                <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                    Total paid{scopeLabel ? ` · ${scopeLabel}` : ""}
                </div>
                <div className="mt-1.5 text-[clamp(2.25rem,6vw,3.5rem)] font-medium leading-none tracking-[-0.03em] [font-variant-numeric:proportional-nums]">
                    {money2(stats.total)}
                </div>
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-lg overflow-hidden">
                    <Kpi label="Payments" value={String(stats.count)} />
                    <Kpi label="Contractors" value={String(stats.people)} />
                    <Kpi label="Countries" value={String(stats.countries)} />
                </div>
            </div>

            {byMonth.length > 1 && (
                <Panel
                    title="Paid per month"
                    note={`${byMonth.length} months · biggest was ${byMonth.reduce((a, b) => (b.value > a.value ? b : a)).label}. Hover a column for the exact figure.`}
                    delay="delay-2">
                    <ChartFrame
                        table={byMonth.map((d) => [d.label, money2(d.value)])}
                        headers={["Month", "Paid"]}
                    >
                        {/* Columns rather than an area: months are discrete buckets you
                            compare against each other, and an area implies a continuous
                            quantity flowing between them. Height carries the value, so
                            every column is the same hue — a value ramp here would encode
                            the same thing twice. */}
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={byMonth} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                                {/* Solid hairline grid, horizontal only — dashed reads as
                                    "threshold" when it is just a grid. */}
                                <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: INK_DIM, fontSize: 11 }}
                                    axisLine={{ stroke: GRID }} tickLine={false} />
                                <YAxis tickFormatter={(v) => money(Number(v))}
                                    tick={{ fill: INK_DIM, fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
                                {/* The hit area is the whole column band, not the bar —
                                    a thin column is a pinpoint target otherwise. */}
                                <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                                    {byMonth.map((d) => <Cell key={d.key} fill={ACCENT} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartFrame>
                </Panel>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                {byCountry.length > 0 && (
                    <Panel title="Paid by country" note="Same measure across categories — one colour, length carries it." delay="delay-3">
                        <ChartFrame
                            headers={["Country", "Paid", "Payments"]}
                            table={byCountry.map((d) => [d.label, money2(d.value), String(d.n)])}
                        >
                            <RankBars data={byCountry} />
                        </ChartFrame>
                    </Panel>
                )}
                {byPerson.length > 0 && (
                    <Panel title="Paid by contractor" note="Top 6 by total." delay="delay-4">
                        <ChartFrame
                            headers={["Contractor", "Paid", "Payments"]}
                            table={byPerson.map((d) => [d.label, money2(d.value), String(d.n)])}
                        >
                            <RankBars data={byPerson} />
                        </ChartFrame>
                    </Panel>
                )}
            </div>

            {byClient.length > 1 && (
                <Panel title="Paid by client" note="Across every client you run payroll for." delay="delay-5">
                    <ChartFrame
                        headers={["Client", "Paid", "Payments"]}
                        table={byClient.map((d) => [d.label, money2(d.value), String(d.n)])}
                    >
                        <RankBars data={byClient} />
                    </ChartFrame>
                </Panel>
            )}
        </div>
    );
}

/* ── pieces ──────────────────────────────────────────────────────────────── */

// Horizontal because category names are long and would otherwise be rotated.
// Every bar is the same hue: these are nominal categories, so a value ramp would
// encode length twice and say nothing new.
function RankBars({ data }: { data: { label: string; value: number; n: number }[] }) {
    return (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 42 + 24)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 4 }} barCategoryGap={8}>
                <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={128}
                    tick={{ fill: INK_DIM, fontSize: 12 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => {
                        const name = v.length > 16 ? v.slice(0, 15) + "…" : v;
                        return name;
                    }} />
                <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
                {/* 4px rounded data-end, anchored square to the baseline. */}
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}
                    label={{ position: "right", fill: "var(--text-dim)", fontSize: 11, formatter: (v: unknown) => money(Number(v)) }}>
                    {data.map((d) => <Cell key={d.label} fill={ACCENT} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 shadow-xl">
            <div className="text-[11px] text-[var(--text-dim)]">{label}</div>
            <div className="font-mono text-[13px] mt-0.5">{money2(Number(payload[0].value))}</div>
        </div>
    );
}

// Every chart has a table twin — the WCAG-clean equivalent, and the thing people
// copy into a deck.
function ChartFrame({ children, headers, table }: {
    children: React.ReactNode; headers: string[]; table: string[][];
}) {
    const [asTable, setAsTable] = useState(false);
    return (
        <>
            <div className="flex justify-end -mt-1 mb-1">
                <button onClick={() => setAsTable(!asTable)}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text)] transition"
                    aria-pressed={asTable}>
                    {asTable ? <><BarChart3 size={11} /> Chart</> : <><Table2 size={11} /> Table</>}
                </button>
            </div>
            {asTable ? (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                            {headers.map((h, i) => (
                                <th key={h} className={`py-1.5 font-normal border-b border-[var(--border)] ${i ? "text-right" : ""}`}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.map((r, i) => (
                            <tr key={i} className="border-b border-[var(--border)] last:border-0">
                                {r.map((c, j) => (
                                    <td key={j} className={`py-1.5 text-[12px] ${j ? "text-right font-mono" : ""}`}>{c}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : children}
        </>
    );
}

function Panel({ title, note, delay, children }: {
    title: string; note?: string; delay?: string; children: React.ReactNode;
}) {
    return (
        <div className={`fade-up ${delay ?? ""} card p-5`}>
            <div className="mb-3">
                <h2 className="text-[15px] font-medium">{title}</h2>
                {note && <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{note}</p>}
            </div>
            {children}
        </div>
    );
}

function Kpi({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-[var(--surface)] px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
            <div className="text-xl font-medium mt-0.5 [font-variant-numeric:proportional-nums]">{value}</div>
        </div>
    );
}

function Select({ value, onChange, options, label }: {
    value: string; onChange: (v: string) => void; options: [string, string][]; label: string;
}) {
    // Delegates to the shared dropdown so every filter in the product opens the
    // same panel. Kept as a local wrapper because the call sites already pass
    // [value, label] tuples.
    return <UiSelect value={value} onChange={onChange} options={toOptions(options)} label={label} className="py-1.5" />;
}
