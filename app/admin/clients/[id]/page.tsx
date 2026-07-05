"use client";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, AlertCircle, Send, Users, CheckCircle2, XCircle, Clock, ExternalLink, Sparkles } from "lucide-react";
import { SUPPORTED_COUNTRIES, flagFor, avatarFor, truncate, formatUSD, type DbContractor } from "@/lib/contractor-types";
import type { DbClient, PayrollRun } from "@/lib/clients";
import ImportFreelancers from "@/components/import-freelancers";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [client, setClient] = useState<DbClient | null>(null);
    const [roster, setRoster] = useState<DbContractor[] | null>(null);
    const [runs, setRuns] = useState<PayrollRun[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [note, setNote] = useState("");
    const [preparing, setPreparing] = useState(false);
    const [prepMsg, setPrepMsg] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);

    function load() {
        fetch("/api/clients").then((r) => r.json())
            .then((j) => setClient((j.clients || []).find((c: DbClient) => c.id === id) ?? null))
            .catch(() => setError("Failed to load client"));
        fetch(`/api/contractors?client_id=${id}`).then((r) => r.json())
            .then((j) => setRoster(j.contractors || []))
            .catch(() => setError("Failed to load freelancers"));
        fetch(`/api/payroll-runs?client_id=${id}`).then((r) => r.json())
            .then((j) => setRuns(j.runs || []))
            .catch(() => setError("Failed to load payroll runs"));
    }
    useEffect(load, [id]);

    const selectedTotal = useMemo(() =>
        (roster || []).filter((c) => selected.has(c.id)).reduce((s, c) => s + c.monthly_amount, 0),
        [roster, selected]);

    function toggle(cid: string) {
        const next = new Set(selected);
        if (next.has(cid)) next.delete(cid); else next.add(cid);
        setSelected(next);
    }
    function toggleAll() {
        if (!roster) return;
        setSelected(selected.size === roster.length ? new Set() : new Set(roster.map((c) => c.id)));
    }

    async function preparePayroll() {
        setPreparing(true); setPrepMsg(null);
        try {
            const r = await fetch("/api/payroll-runs", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: id, contractorIds: [...selected], note }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Failed to prepare payroll");
            setPrepMsg(`Payroll prepared — waiting for ${client?.company_name ?? "the client"} to confirm in their portal. (${j.notification?.detail ?? "no notification"})`);
            setSelected(new Set()); setNote("");
            load();
        } catch (e) {
            setPrepMsg(e instanceof Error ? e.message : "Failed");
        } finally { setPreparing(false); }
    }

    async function cancelRun(runId: string) {
        await fetch(`/api/payroll-runs/${runId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancelled" }),
        });
        load();
    }

    return (
        <div className="mx-auto max-w-5xl">
            <Link href="/admin/clients" className="fade-up inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">
                <ArrowLeft size={13} /> All clients
            </Link>
            <div className="fade-up flex items-center gap-3 mt-3">
                <span className="text-2xl">{client ? flagFor(client.home_country) : "🌐"}</span>
                <h1 className="font-display text-3xl font-semibold tracking-tight">{client?.company_name ?? "…"}</h1>
            </div>
            {client && (
                <div className="fade-up flex items-center gap-2 mt-2 text-[11px] font-mono text-[var(--text-faint)] flex-wrap">
                    <span>{client.home_country}</span>
                    {client.wallet_address && <><span className="opacity-40">·</span><span>signs from {truncate(client.wallet_address)}</span></>}
                    {client.contact_email && <><span className="opacity-40">·</span><span>{client.contact_email}</span></>}
                </div>
            )}

            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {/* Roster with pay-selection */}
            <div className="fade-up delay-1 card mt-8 overflow-hidden">
                <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-[var(--border)] flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <h2 className="font-display text-lg font-semibold">Freelancers</h2>
                        {roster && roster.length > 0 && (
                            <button onClick={toggleAll} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">
                                {selected.size === roster.length ? "Clear selection" : "Select all"}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-xs inline-flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition" onClick={() => { setShowImport(!showImport); setShowAdd(false); }}>
                            <Sparkles size={13} /> Import list with AI
                        </button>
                        <button className="text-xs inline-flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition" onClick={() => { setShowAdd(!showAdd); setShowImport(false); }}>
                            <Plus size={13} /> Add freelancer
                        </button>
                    </div>
                </div>

                {showImport && <ImportFreelancers clientId={id} onImported={load} />}
                {showAdd && <AddFreelancerForm clientId={id} onAdded={() => { setShowAdd(false); load(); }} />}

                {roster === null && <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--text-dim)]"><Loader2 size={15} className="animate-spin" /> Loading…</div>}
                {roster && roster.length === 0 && !showAdd && !showImport && (
                    <div className="p-10 text-center text-sm text-[var(--text-dim)]">
                        <Users size={18} className="mx-auto mb-3 opacity-60" />
                        No freelancers yet — paste the client&rsquo;s list into <button className="text-[var(--accent)] underline underline-offset-2" onClick={() => setShowImport(true)}>Import list with AI</button>, or add them one by one.
                    </div>
                )}
                {roster && roster.length > 0 && (
                    <div className="divide-y divide-[var(--border)]">
                        {roster.map((c) => {
                            const initials = c.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                            const [g1, g2] = avatarFor(c.name);
                            const on = selected.has(c.id);
                            return (
                                <label key={c.id} className={`flex items-center gap-4 px-5 md:px-6 py-3.5 cursor-pointer transition-colors ${on ? "bg-[rgba(47,230,168,0.05)]" : "hover:bg-[var(--surface-2)]"}`}>
                                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)}
                                        className="h-4 w-4 accent-[var(--accent)] shrink-0" />
                                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-semibold text-xs text-[#04130d]" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>{initials}</div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium truncate text-sm">{c.name}</div>
                                        <div className="text-xs text-[var(--text-dim)] truncate">{c.role || "—"}</div>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-dim)] w-24"><span>{flagFor(c.country)}</span>{c.country}</div>
                                    <div className="hidden lg:block font-mono text-[10px] text-[var(--text-faint)] w-28">{truncate(c.wallet)}</div>
                                    <div className="w-24 text-right font-mono text-sm font-semibold">{formatUSD(c.monthly_amount)}</div>
                                </label>
                            );
                        })}
                    </div>
                )}

                {roster && roster.length > 0 && (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-5 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm text-[var(--text-dim)]">
                            <span className="font-mono font-semibold text-[var(--text)]">{selected.size}</span> of {roster.length} selected
                            {selected.size > 0 && <> · <span className="font-mono font-semibold text-[var(--accent)]">{formatUSD(selectedTotal)}</span></>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. July 2026 payroll"
                                className="px-3 py-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition w-48" />
                            <button onClick={preparePayroll} disabled={selected.size === 0 || preparing} className="btn-primary text-sm disabled:opacity-50">
                                {preparing ? <><Loader2 size={15} className="animate-spin" /> Preparing…</> : <><Send size={15} /> Prepare payroll ({selected.size})</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {prepMsg && <div className="fade-up mt-4 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)] px-4 py-3 text-sm">{prepMsg}</div>}

            {/* Payroll runs */}
            <div className="fade-up delay-2 card mt-8 overflow-hidden">
                <div className="px-5 md:px-6 py-4 border-b border-[var(--border)]">
                    <h2 className="font-display text-lg font-semibold">Payroll runs</h2>
                </div>
                {runs === null && <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--text-dim)]"><Loader2 size={15} className="animate-spin" /> Loading…</div>}
                {runs && runs.length === 0 && <div className="p-8 text-center text-sm text-[var(--text-dim)]">No payroll runs yet. Select freelancers above and prepare the first one.</div>}
                {runs && runs.length > 0 && (
                    <div className="divide-y divide-[var(--border)]">
                        {runs.map((r) => (
                            <div key={r.id} className="flex items-center gap-4 px-5 md:px-6 py-4">
                                <RunStatus status={r.status} />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium">{r.note || `${r.line_items.length} freelancer${r.line_items.length === 1 ? "" : "s"}`}</div>
                                    <div className="text-[11px] font-mono text-[var(--text-faint)] mt-0.5">
                                        {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                        {" · "}{r.line_items.map((li) => li.name.split(" ")[0]).join(", ")}
                                    </div>
                                </div>
                                <div className="font-mono text-sm font-semibold w-24 text-right">{formatUSD(Number(r.total_amount))}</div>
                                {r.status === "pending_confirmation" && (
                                    <button onClick={() => cancelRun(r.id)} className="text-[11px] text-[var(--text-faint)] hover:text-[#ff6b6b] transition">Cancel</button>
                                )}
                                {r.status === "executed" && r.tx_hash && (
                                    <a href={`https://sepolia.basescan.org/tx/${r.tx_hash}`} target="_blank" rel="noreferrer" className="text-[var(--text-faint)] hover:text-[var(--text)]"><ExternalLink size={13} /></a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function RunStatus({ status }: { status: PayrollRun["status"] }) {
    if (status === "executed") return <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] bg-[rgba(47,230,168,0.07)] border border-[rgba(47,230,168,0.22)] rounded px-1.5 py-0.5 shrink-0"><CheckCircle2 size={10} /> Paid</span>;
    if (status === "pending_confirmation") return <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#f5b14c] bg-[rgba(245,177,76,0.07)] border border-[rgba(245,177,76,0.22)] rounded px-1.5 py-0.5 shrink-0"><Clock size={10} /> Awaiting client</span>;
    if (status === "cancelled") return <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0"><XCircle size={10} /> Cancelled</span>;
    return <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0">Draft</span>;
}

function AddFreelancerForm({ clientId, onAdded }: { clientId: string; onAdded: () => void }) {
    const [form, setForm] = useState({ name: "", role: "", country: "Nigeria", wallet: "", monthly_amount: "", tax_id: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            const r = await fetch("/api/contractors", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, client_id: clientId, monthly_amount: Number(form.monthly_amount) }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Failed to add freelancer");
            onAdded();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
        } finally { setBusy(false); }
    }

    const input = "w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition";
    return (
        <form onSubmit={submit} className="px-5 md:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]/30 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required className={input} placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={input} placeholder="Role (optional)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            <select className={input} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                {SUPPORTED_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input required className={`${input} font-mono md:col-span-2`} placeholder="Wallet address 0x…" value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} />
            <input required type="number" min="1" className={input} placeholder="Monthly USD" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} />
            <input className={`${input} md:col-span-2`} placeholder="Tax ID (optional)" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            {err && <div className="md:col-span-3 text-xs text-[#ff6b6b]">{err}</div>}
            <div><button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">{busy ? "Adding…" : "Add"}</button></div>
        </form>
    );
}
