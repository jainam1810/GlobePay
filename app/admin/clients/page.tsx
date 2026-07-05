"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Plus, AlertCircle } from "lucide-react";
import { COMPANY_COUNTRIES, flagFor, truncate } from "@/lib/contractor-types";
import type { DbClient } from "@/lib/clients";

export default function ClientsPage() {
    const [clients, setClients] = useState<DbClient[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    function load() {
        fetch("/api/clients")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setClients(j.clients || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }
    useEffect(load, []);

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="kicker">Client companies</div>
                    <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Clients</h1>
                    <p className="text-[var(--text-dim)] mt-2 max-w-md">Each client has their own freelancers, payrolls, and history — fully walled off from other clients.</p>
                </div>
                <button className="btn-primary self-start md:self-auto" onClick={() => setShowForm(!showForm)}>
                    <Plus size={16} /> New client
                </button>
            </div>

            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {showForm && <NewClientForm onCreated={() => { setShowForm(false); load(); }} />}

            {clients === null && !error && (
                <div className="fade-up mt-8 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading clients…
                </div>
            )}

            {clients && clients.length > 0 && (
                <div className="fade-up delay-1 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clients.map((c) => (
                        <Link key={c.id} href={`/admin/clients/${c.id}`} className="card p-5 hover:bg-[var(--surface-2)] transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(47,230,168,0.08)] border border-[rgba(47,230,168,0.2)] text-lg">
                                    {flagFor(c.home_country)}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-display font-semibold truncate">{c.company_name}</div>
                                    <div className="text-xs text-[var(--text-dim)]">{c.home_country}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-4 text-[11px] font-mono text-[var(--text-faint)]">
                                {c.wallet_address ? <span>{truncate(c.wallet_address)}</span> : <span className="text-[#f5b14c]">no wallet on file</span>}
                                {c.contact_email && <><span className="opacity-40">·</span><span className="truncate">{c.contact_email}</span></>}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {clients && clients.length === 0 && !showForm && (
                <div className="fade-up mt-8 card p-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4"><Building2 size={20} /></div>
                    <div className="font-display text-xl font-semibold">No clients yet</div>
                    <p className="text-[var(--text-dim)] text-sm mt-2">Add the first company you&rsquo;ll run payroll for.</p>
                    <button className="btn-primary mt-6 inline-flex" onClick={() => setShowForm(true)}><Plus size={16} /> New client</button>
                </div>
            )}
        </div>
    );
}

function NewClientForm({ onCreated }: { onCreated: () => void }) {
    const [form, setForm] = useState({ company_name: "", home_country: "United Kingdom", wallet_address: "", contact_email: "" });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            const r = await fetch("/api/clients", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Failed to create client");
            onCreated();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
        } finally { setBusy(false); }
    }

    const input = "w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition";
    return (
        <form onSubmit={submit} className="fade-up card p-5 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1.5">Company name</label>
                <input required className={input} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Acme GmbH" />
            </div>
            <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1.5">HQ country <span className="text-[var(--text-faint)]">(drives tax treatment)</span></label>
                <select className={input} value={form.home_country} onChange={(e) => setForm({ ...form, home_country: e.target.value })}>
                    {COMPANY_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1.5">Payroll wallet <span className="text-[var(--text-faint)]">(the address that signs)</span></label>
                <input className={`${input} font-mono`} value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} placeholder="0x…" />
            </div>
            <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1.5">Contact email</label>
                <input type="email" className={input} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="billing@acme.com" />
            </div>
            {err && <div className="md:col-span-2 text-xs text-[#ff6b6b] bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.25)] rounded-lg px-3 py-2">{err}</div>}
            <div className="md:col-span-2">
                <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
                    {busy ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : "Create client"}
                </button>
            </div>
        </form>
    );
}
