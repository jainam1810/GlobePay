"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Database, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import type { SavedRecord } from "@/lib/records";

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

function RecordRow({ r }: { r: SavedRecord }) {
    const created = new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const invDate = r.invoice_date ? new Date(r.invoice_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

    return (
        <div className="card p-5 hover:bg-[var(--surface-2)] transition-colors">
            <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[rgba(47,230,168,0.08)] border border-[rgba(47,230,168,0.2)] text-[var(--accent)]">
                    <FileText size={16} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{r.payee_name}</span>
                        {r.ai_confidence && <ConfidencePill level={r.ai_confidence} />}
                    </div>
                    {r.description && <div className="text-sm text-[var(--text-dim)] mt-0.5 truncate">{r.description}</div>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-[var(--text-faint)] flex-wrap">
                        {invDate && <span>Invoice: {invDate}</span>}
                        {r.invoice_number && <span>#{r.invoice_number}</span>}
                        <span>Saved {created}</span>
                    </div>
                    {r.ai_notes && (
                        <div className="mt-2 text-xs text-[#f5b14c] flex items-start gap-1.5">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" /> {r.ai_notes}
                        </div>
                    )}
                </div>

                <div className="text-right shrink-0 md:ml-4">
                    <div className="font-mono text-lg font-semibold">{r.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono">{r.currency}</div>
                </div>
            </div>
        </div>
    );
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