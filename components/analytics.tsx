"use client";
// Payment analytics.
//
// Form was chosen before colour, and the colour work mostly cancelled itself:
// every chart here is a SINGLE series, so there is no categorical palette to
// get wrong. Country and contractor bars all take one hue — colouring each bar
// darker-where-bigger would double-encode length as hue and burn the only free
// channel on information the bar already shows.
//
// The accent (#4C50EA) was validated against the dark surface rather than eyeballed:
// lightness band, chroma floor and ≥3:1 contrast all pass. The brand's other
// colours were checked as a categorical set and FAILED — #2446F6 sits ΔE 5.2 from
// the accent (indistinguishable), and the green/yellow pair collapses under
// protanopia — which is the argument for one hue, not four.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ResponsiveContainer, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Loader2, AlertCircle, BarChart3, Table2, LineChart } from "lucide-react";
import type { SavedRecord } from "@/lib/records";
import { flagFor } from "@/lib/contractor-types";
import { format, parseISO } from "date-fns";

const ACCENT = "#4C50EA";
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
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => ({ key: k, label: format(parseISO(`${k}-01`), "MMM yy"), value: Math.round(v) }));
    }, [rows]);

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
                    options={[["__all__", "All time"], ...years.map((y) => [y, y] as [string, string])]} />
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
                <Panel title="Paid per month" note="One series — the axis and tooltip carry the values." delay="delay-2">
                    <ChartFrame
                        table={byMonth.map((d) => [d.label, money2(d.value)])}
                        headers={["Month", "Paid"]}
                    >
                        <ResponsiveContainer width="100%" height={230}>
                            <AreaChart data={byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                {/* Solid hairline grid, horizontal only — dashed reads as
                                    "threshold" when it is just a grid. */}
                                <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: INK_DIM, fontSize: 11 }}
                                    axisLine={{ stroke: GRID }} tickLine={false} />
                                <YAxis tickFormatter={(v) => money(Number(v))}
                                    tick={{ fill: INK_DIM, fontSize: 11 }} axisLine={false} tickLine={false} width={62} />
                                <Tooltip content={<Tip />} cursor={{ stroke: ACCENT, strokeWidth: 1 }} />
                                <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2}
                                    fill="url(#gArea)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} />
                            </AreaChart>
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
                            <RankBars data={byCountry} flags />
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
function RankBars({ data, flags = false }: { data: { label: string; value: number; n: number }[]; flags?: boolean }) {
    return (
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 42 + 24)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 4 }} barCategoryGap={8}>
                <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={128}
                    tick={{ fill: INK_DIM, fontSize: 12 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => {
                        const name = v.length > 16 ? v.slice(0, 15) + "…" : v;
                        return flags ? `${flagFor(v)} ${name}` : name;
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
                    {asTable ? <><LineChart size={11} /> Chart</> : <><Table2 size={11} /> Table</>}
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
    return (
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
            className="text-[13px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition">
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}
