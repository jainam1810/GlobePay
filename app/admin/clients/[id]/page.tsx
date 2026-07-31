"use client";
import { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, AlertCircle, Send, Users, CheckCircle2, XCircle, Clock, ExternalLink, Sparkles, Pencil, Trash2, Copy, Check } from "lucide-react";
import { SUPPORTED_COUNTRIES, COMPANY_COUNTRIES, flagFor, avatarFor, truncate, formatUSD, type DbContractor } from "@/lib/contractor-types";
import type { DbClient, PayrollRun } from "@/lib/clients";
import ImportFreelancers from "@/components/import-freelancers";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [client, setClient] = useState<DbClient | null>(null);
    const [roster, setRoster] = useState<DbContractor[] | null>(null);
    const [runs, setRuns] = useState<PayrollRun[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    // Per-run amounts, keyed by contractor id. Seeded from each freelancer's
    // saved default when they're selected, but always overridable.
    const [amounts, setAmounts] = useState<Record<string, string>>({});
    const [note, setNote] = useState("");
    const [preparing, setPreparing] = useState(false);
    const [prepMsg, setPrepMsg] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editing, setEditing] = useState<string | null>(null);
    const [editClient, setEditClient] = useState(false);

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

    const amountFor = (c: DbContractor) => {
        const typed = amounts[c.id];
        if (typed !== undefined) return Number(typed) || 0;
        return c.monthly_amount || 0;
    };
    const selectedTotal = useMemo(
        () => (roster || []).filter((c) => selected.has(c.id)).reduce((s, c) => s + amountFor(c), 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [roster, selected, amounts],
    );

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
            const picked = (roster || []).filter((c) => selected.has(c.id));
            const amountMap = Object.fromEntries(picked.map((c) => [c.id, amountFor(c)]));
            const r = await fetch("/api/payroll-runs", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: id, contractorIds: [...selected], amounts: amountMap, note }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Failed to prepare payroll");
            setPrepMsg(`Payroll prepared — waiting for ${client?.company_name ?? "the client"} to confirm in their portal. (${j.notification?.detail ?? "no notification"})`);
            setSelected(new Set()); setAmounts({}); setNote("");
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

    async function removeFreelancer(cid: string, name: string) {
        if (!confirm(`Remove ${name} from this client's roster? Past payments and ledger entries are kept.`)) return;
        const r = await fetch(`/api/contractors/${cid}`, { method: "DELETE" });
        if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j?.error || "Failed to remove freelancer"); return; }
        load();
    }

    return (
        <div className="mx-auto max-w-5xl">
            <Link href="/admin/clients" className="fade-up inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">
                <ArrowLeft size={13} /> All clients
            </Link>
            <div className="fade-up flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-2xl">{client ? flagFor(client.home_country) : "🌐"}</span>
                <h1 className="font-display text-3xl font-semibold tracking-tight">{client?.company_name ?? "…"}</h1>
                {client && (
                    <button onClick={() => setEditClient(!editClient)}
                        className="text-xs inline-flex items-center gap-1 text-[var(--text-dim)] hover:text-[var(--accent)] transition border border-[var(--border-strong)] rounded-lg px-2.5 py-1">
                        <Pencil size={12} /> {editClient ? "Cancel" : "Edit details"}
                    </button>
                )}
            </div>
            {client && !editClient && (
                <div className="fade-up flex items-center gap-2 mt-2 text-[11px] font-mono text-[var(--text-faint)] flex-wrap">
                    <span>{client.home_country}</span>
                    {client.wallet_address && (
                        <>
                            <span className="opacity-40">·</span>
                            <span className="text-[var(--text-dim)]">Wallet address</span>
                            <span>{truncate(client.wallet_address)}</span>
                            <CopyButton value={client.wallet_address} title="Copy wallet address" />
                        </>
                    )}
                    {client.contact_email && <><span className="opacity-40">·</span><span>{client.contact_email}</span></>}
                </div>
            )}
            {client && editClient && (
                <EditClientForm client={client} onSaved={() => { setEditClient(false); load(); }} onCancel={() => setEditClient(false)} />
            )}

            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm flex items-center gap-2">
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
                        <button className="text-xs inline-flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition" onClick={() => { setShowImport(!showImport); setShowAdd(false); setEditing(null); }}>
                            <Sparkles size={13} /> Import list with AI
                        </button>
                        <button className="text-xs inline-flex items-center gap-1 text-[var(--accent)] hover:opacity-80 transition" onClick={() => { setShowAdd(!showAdd); setShowImport(false); setEditing(null); }}>
                            <Plus size={13} /> Add freelancer
                        </button>
                    </div>
                </div>

                {showImport && <ImportFreelancers clientId={id} onImported={load} />}
                {showAdd && <FreelancerForm clientId={id} onDone={() => { setShowAdd(false); load(); }} onCancel={() => setShowAdd(false)} />}

                {roster === null && <div className="p-8 flex items-center justify-center gap-2 text-sm text-[var(--text-dim)]"><Loader2 size={15} className="animate-spin" /> Loading…</div>}
                {roster && roster.length === 0 && !showAdd && !showImport && (
                    <div className="p-10 text-center text-sm text-[var(--text-dim)]">
                        <Users size={18} className="mx-auto mb-3 opacity-60" />
                        No freelancers yet — paste the client&rsquo;s list into <button className="text-[var(--accent)] underline underline-offset-2" onClick={() => setShowImport(true)}>Import list with AI</button>, or add them one by one.
                    </div>
                )}
                {roster && roster.length > 0 && (
                    <>
                        {/* Column headers — without these the row is just four unlabelled values. */}
                        <div className="flex items-center gap-4 px-5 md:px-6 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/40 text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                            <span className="w-4 shrink-0" />
                            <span className="w-9 shrink-0" />
                            <span className="min-w-0 flex-1">Freelancer</span>
                            <span className="hidden sm:block w-24">Country</span>
                            <span className="hidden lg:block w-36">Wallet address</span>
                            <span className="w-32 text-right">Amount to pay</span>
                            <span className="w-12 shrink-0" />
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                            {roster.map((c) => {
                                if (editing === c.id) {
                                    return <FreelancerForm key={c.id} clientId={id} existing={c}
                                        onDone={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;
                                }
                                const initials = c.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                                const [g1, g2] = avatarFor(c.name);
                                const on = selected.has(c.id);
                                return (
                                    <div key={c.id} className={`flex items-center gap-4 px-5 md:px-6 py-3.5 transition-colors ${on ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"}`}>
                                        <input type="checkbox" checked={on} onChange={() => toggle(c.id)}
                                            aria-label={`Select ${c.name} for this payroll`}
                                            className="h-4 w-4 accent-[var(--accent)] shrink-0 cursor-pointer" />
                                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-semibold text-xs text-[var(--accent-ink)]" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>{initials}</div>
                                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggle(c.id)}>
                                            <div className="font-medium truncate text-sm">{c.name}</div>
                                            <div className="text-xs text-[var(--text-dim)] truncate">{c.role || "—"}</div>
                                        </div>
                                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-dim)] w-24"><span>{flagFor(c.country)}</span>{c.country}</div>
                                        <div className="hidden lg:flex items-center gap-1.5 w-36">
                                            <span className="font-mono text-[10px] text-[var(--text-faint)]">{truncate(c.wallet)}</span>
                                            <CopyButton value={c.wallet} title={`Copy ${c.name}'s wallet address`} />
                                        </div>
                                        <AmountCell
                                            c={c}
                                            selected={on}
                                            runValue={amounts[c.id] ?? (c.monthly_amount ? String(c.monthly_amount) : "")}
                                            onRunChange={(v) => setAmounts({ ...amounts, [c.id]: v })}
                                            onSaved={load}
                                            onError={setError}
                                        />
                                        <div className="flex items-center gap-1 w-12 shrink-0 justify-end">
                                            <button onClick={() => { setEditing(c.id); setShowAdd(false); setShowImport(false); }}
                                                title={`Edit ${c.name}`} className="text-[var(--text-faint)] hover:text-[var(--accent)] transition">
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={() => removeFreelancer(c.id, c.name)}
                                                title={`Remove ${c.name}`} className="text-[var(--text-faint)] hover:text-[var(--danger)] transition">
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

                {roster && roster.length > 0 && (
                    <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-5 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm text-[var(--text-dim)]">
                            <span className="font-mono font-semibold text-[var(--text)]">{selected.size}</span> of {roster.length} selected
                            {selected.size > 0 && <> · <span className="font-mono font-semibold text-[var(--accent)]">{formatUSD(selectedTotal)}</span></>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
                                title="Leave blank and GlobePay writes one for you, e.g. “July 2026 payroll — $650 to 3 freelancers”"
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
                                    <button onClick={() => cancelRun(r.id)} className="text-[11px] text-[var(--text-faint)] hover:text-[var(--danger)] transition">Cancel</button>
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

// The amount cell does double duty, and the two meanings are deliberately
// distinct: when the row is TICKED it's this run's amount (not saved anywhere
// until you prepare payroll); when it's not ticked it shows the freelancer's
// saved default, which you can edit in place without opening the full form.
// Number inputs render browser spinner arrows that look wrong against a
// right-aligned mono figure — strip them in both Firefox and WebKit.
const noSpinner = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function AmountCell({ c, selected, runValue, onRunChange, onSaved, onError }: {
    c: DbContractor;
    selected: boolean;
    runValue: string;
    onRunChange: (v: string) => void;
    onSaved: () => void;
    onError: (msg: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    // Escape must not save. It blurs the field, so flag the cancel before the
    // blur handler runs — blur is the single save path, Enter just triggers it.
    const cancelled = useRef(false);

    async function commit() {
        if (cancelled.current) { cancelled.current = false; setEditing(false); return; }

        const next = draft.trim() === "" ? 0 : Number(draft);
        // Nothing typed, or the same figure — close without a pointless write.
        if (!Number.isFinite(next) || next < 0 || next === (c.monthly_amount ?? 0)) { setEditing(false); return; }

        setBusy(true);
        try {
            // PATCH validates name/country/wallet, so resend the row unchanged
            // with only the amount swapped.
            const r = await fetch(`/api/contractors/${c.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: c.name, role: c.role, country: c.country, wallet: c.wallet,
                    tax_id: c.tax_id, monthly_amount: next,
                }),
            });
            if (!r.ok) throw new Error((await r.json())?.error || "Failed to save amount");
            setEditing(false);
            onSaved();
        } catch (e) {
            onError(e instanceof Error ? e.message : "Failed to save amount");
            setEditing(false);
        } finally { setBusy(false); }
    }

    if (selected) {
        return (
            <div className="w-32 flex items-center justify-end gap-1">
                <span className="text-[var(--text-faint)] text-xs">$</span>
                <input type="number" min="1" step="any"
                    aria-label={`Amount to pay ${c.name} on this run`}
                    value={runValue} onChange={(e) => onRunChange(e.target.value)} placeholder="0"
                    title="Amount for this payroll run only — doesn't change the saved default"
                    className={`w-24 px-2 py-1 text-sm text-right font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition ${noSpinner}`} />
            </div>
        );
    }

    if (editing) {
        return (
            <div className="w-32 flex items-center justify-end gap-1.5">
                {busy && <Loader2 size={12} className="animate-spin text-[var(--accent)]" />}
                <span className="text-[var(--text-faint)] text-xs">$</span>
                <input type="number" min="0" step="any" autoFocus disabled={busy}
                    aria-label={`Saved default amount for ${c.name}`}
                    value={draft} onChange={(e) => setDraft(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                        if (e.key === "Escape") { cancelled.current = true; e.currentTarget.blur(); }
                    }}
                    placeholder="—"
                    title="Enter or click away to save · Esc to cancel"
                    className={`w-20 px-2 py-1 text-sm text-right font-mono bg-[var(--surface-2)] border border-[var(--accent)] rounded-lg focus:outline-none transition disabled:opacity-50 ${noSpinner}`} />
            </div>
        );
    }

    return (
        <div className="w-32 flex items-center justify-end">
            <button
                onClick={() => { setDraft(c.monthly_amount ? String(c.monthly_amount) : ""); setEditing(true); }}
                title="Click to change the amount"
                className="group font-mono text-sm text-[var(--text-dim)] hover:text-[var(--text)] transition inline-flex items-center gap-1.5 rounded px-1 -mr-1 hover:bg-[var(--surface-2)]">
                {c.monthly_amount ? formatUSD(c.monthly_amount) : "—"}
                <Pencil size={11} className="opacity-0 group-hover:opacity-100 transition text-[var(--accent)]" />
            </button>
        </div>
    );
}

function CopyButton({ value, title }: { value: string; title: string }) {
    const [copied, setCopied] = useState(false);
    function copy(e: React.MouseEvent) {
        e.stopPropagation();   // rows toggle selection on click — don't fire that
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    }
    return (
        <button onClick={copy} title={title} className="text-[var(--text-faint)] hover:text-[var(--text)] transition shrink-0">
            {copied ? <Check size={12} className="text-[var(--accent)]" /> : <Copy size={12} />}
        </button>
    );
}

function RunStatus({ status }: { status: PayrollRun["status"] }) {
    if (status === "executed") return <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded px-1.5 py-0.5 shrink-0"><CheckCircle2 size={10} /> Paid</span>;
    if (status === "pending_confirmation") return <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--warn)] bg-[var(--warn-soft)] border border-[var(--warn-line)] rounded px-1.5 py-0.5 shrink-0"><Clock size={10} /> Awaiting client</span>;
    if (status === "cancelled") return <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0"><XCircle size={10} /> Cancelled</span>;
    return <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-faint)] border border-[var(--border)] rounded px-1.5 py-0.5 shrink-0">Draft</span>;
}

const inputCls = "w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition";

// One form for both adding and editing — `existing` switches it to PATCH.
function FreelancerForm({ clientId, existing, onDone, onCancel }: {
    clientId: string; existing?: DbContractor; onDone: () => void; onCancel: () => void;
}) {
    const [form, setForm] = useState({
        name: existing?.name ?? "",
        role: existing?.role ?? "",
        country: existing?.country ?? "Nigeria",
        wallet: existing?.wallet ?? "",
        monthly_amount: existing?.monthly_amount ? String(existing.monthly_amount) : "",
        tax_id: existing?.tax_id ?? "",
    });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            const url = existing ? `/api/contractors/${existing.id}` : "/api/contractors";
            const r = await fetch(url, {
                method: existing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    client_id: clientId,
                    // Blank means "no default" — the amount is chosen per payroll run.
                    monthly_amount: form.monthly_amount.trim() === "" ? 0 : Number(form.monthly_amount),
                }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || `Failed to ${existing ? "save" : "add"} freelancer`);
            onDone();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
        } finally { setBusy(false); }
    }

    return (
        <form onSubmit={submit} className="px-5 md:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]/30 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3 text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                {existing ? `Editing ${existing.name}` : "New freelancer"}
            </div>
            <Field label="Full name">
                <input required className={inputCls} placeholder="Akil Shaikh" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Role (optional)">
                <input className={inputCls} placeholder="Designer" value={form.role ?? ""} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </Field>
            <Field label="Country">
                <select className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                    {SUPPORTED_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
            </Field>
            <div className="md:col-span-2">
                <Field label="Wallet address">
                    <input required className={`${inputCls} font-mono`} placeholder="0x…" value={form.wallet} onChange={(e) => setForm({ ...form, wallet: e.target.value })} />
                </Field>
            </div>
            <Field label="Default amount (optional)" hint="Only a starting figure — you set the real amount on each payroll run.">
                <input type="number" min="0" step="any" className={inputCls} placeholder="Leave blank" value={form.monthly_amount} onChange={(e) => setForm({ ...form, monthly_amount: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
                <Field label="Tax ID (optional)">
                    <input className={inputCls} placeholder="e.g. 12345678-1234" value={form.tax_id ?? ""} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
                </Field>
            </div>
            {err && <div className="md:col-span-3 text-xs text-[var(--danger)]">{err}</div>}
            <div className="md:col-span-3 flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                    {busy ? "Saving…" : existing ? "Save changes" : "Add"}
                </button>
                <button type="button" onClick={onCancel} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Cancel</button>
            </div>
        </form>
    );
}

function EditClientForm({ client, onSaved, onCancel }: { client: DbClient; onSaved: () => void; onCancel: () => void }) {
    const [form, setForm] = useState({
        company_name: client.company_name,
        home_country: client.home_country,
        wallet_address: client.wallet_address ?? "",
        contact_email: client.contact_email ?? "",
        // Not editable here, but carried through the PATCH untouched — the route
        // nulls any field it doesn't receive, so dropping it would wipe notes.
        notes: client.notes ?? "",
    });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            const r = await fetch(`/api/clients/${client.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Failed to save client");
            onSaved();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
        } finally { setBusy(false); }
    }

    return (
        <form onSubmit={submit} className="fade-up card mt-4 p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Company name">
                <input required className={inputCls} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </Field>
            <Field label="HQ country" hint="Drives domestic vs cross-border tax treatment.">
                <select className={inputCls} value={form.home_country} onChange={(e) => setForm({ ...form, home_country: e.target.value })}>
                    {COMPANY_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
            </Field>
            <Field label="Contact email">
                <input type="email" className={inputCls} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
                <Field label="Wallet address" hint="The wallet this client signs their payrolls from — if this doesn't match the wallet they connect, their Confirm &amp; pay button stays disabled.">
                    <input className={`${inputCls} font-mono`} placeholder="0x…" value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} />
                </Field>
            </div>
            {err && <div className="md:col-span-3 text-xs text-[var(--danger)]">{err}</div>}
            <div className="md:col-span-3 flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
                <button type="button" onClick={onCancel} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Cancel</button>
            </div>
        </form>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-[10px] text-[var(--text-faint)] mt-1">{hint}</span>}
        </label>
    );
}
