"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users, Loader2, AlertCircle, CheckCircle2, X, Wallet } from "lucide-react";
import { isAddress } from "viem";
import { type DbContractor, SUPPORTED_COUNTRIES, truncate, formatUSD, flagFor, avatarFor } from "@/lib/contractor-types";
import { getTaxRule, validateTaxId } from "@/lib/tax-rules";

type Draft = { name: string; role: string; country: string; wallet: string; monthly_amount: string; tax_id: string };
const EMPTY: Draft = { name: "", role: "", country: "Nigeria", wallet: "", monthly_amount: "", tax_id: "" };

export default function ContractorsPage() {
    const [list, setList] = useState<DbContractor[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<DbContractor | null>(null);

    async function load() {
        try {
            const res = await fetch("/api/contractors");
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Failed to load");
            setList(j.contractors);
        } catch (e) { setError(e instanceof Error ? e.message : "Network error"); }
    }
    useEffect(() => { load(); }, []);

    function openAdd() { setEditing(null); setModalOpen(true); }
    function openEdit(c: DbContractor) { setEditing(c); setModalOpen(true); }

    async function remove(c: DbContractor) {
        if (!confirm(`Remove ${c.name} from payroll?`)) return;
        await fetch(`/api/contractors/${c.id}`, { method: "DELETE" });
        load();
    }

    const total = list?.reduce((s, c) => s + c.monthly_amount, 0) ?? 0;

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="kicker">Roster</div>
                    <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Contractors</h1>
                    <p className="text-[var(--text-dim)] mt-2 max-w-md">Add a contractor once — they flow straight into payroll. Edit anytime; changes apply everywhere.</p>
                </div>
                <button className="btn-primary self-start md:self-auto" onClick={openAdd}><Plus size={18} /> Add contractor</button>
            </div>

            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {list === null && !error && (
                <div className="fade-up mt-8 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm"><Loader2 size={15} className="animate-spin" /> Loading…</div>
            )}

            {list && list.length === 0 && (
                <div className="fade-up mt-8 card p-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4"><Users size={20} /></div>
                    <div className="font-display text-xl font-semibold">No contractors yet</div>
                    <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">Add your first contractor — they&rsquo;ll appear here and in payroll instantly.</p>
                    <button className="btn-primary mt-6 inline-flex" onClick={openAdd}><Plus size={16} /> Add contractor</button>
                </div>
            )}

            {list && list.length > 0 && (
                <>
                    <div className="fade-up delay-1 mt-6 flex items-center justify-between text-xs font-mono text-[var(--text-faint)]">
                        <span>{list.length} contractor{list.length === 1 ? "" : "s"}</span>
                        <span>Monthly total {formatUSD(total)}</span>
                    </div>
                    <div className="fade-up delay-2 mt-3 space-y-3">
                        {list.map((c) => <ContractorRow key={c.id} c={c} onEdit={() => openEdit(c)} onDelete={() => remove(c)} />)}
                    </div>
                </>
            )}

            {modalOpen && (
                <ContractorModal
                    editing={editing}
                    onClose={() => setModalOpen(false)}
                    onSaved={() => { setModalOpen(false); load(); }}
                />
            )}
        </div>
    );
}

function ContractorRow({ c, onEdit, onDelete }: { c: DbContractor; onEdit: () => void; onDelete: () => void }) {
    const initials = c.name.split(" ").map((n: any) => n[0]).join("").slice(0, 2);
    const [g1, g2] = avatarFor(c.name);
    const rule = getTaxRule(c.country);
    const idValid = c.tax_id && rule ? validateTaxId(c.tax_id, c.country) : null;

    return (
        <div className="card p-5 flex items-center gap-4 hover:bg-[var(--surface-2)] transition-colors">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-semibold text-sm text-[#04130d]" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>{initials}</div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-sm text-[var(--text-dim)]">{flagFor(c.country)} {c.country}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)]">{c.role || "—"}</div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-[var(--text-faint)] flex-wrap">
                    <span className="inline-flex items-center gap-1"><Wallet size={11} /> {truncate(c.wallet)}</span>
                    {c.tax_id && rule && (
                        <span className="inline-flex items-center gap-1">
                            {rule.taxIdName} {c.tax_id}
                            {idValid ? <CheckCircle2 size={11} className="text-[var(--accent)]" /> : <AlertCircle size={11} className="text-[#f5b14c]" />}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right shrink-0">
                <div className="font-mono font-semibold">{formatUSD(c.monthly_amount)}</div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono">{c.currency}/mo</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button onClick={onEdit} className="p-2 rounded-lg hover:bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)] transition" title="Edit"><Pencil size={15} /></button>
                <button onClick={onDelete} className="p-2 rounded-lg hover:bg-[rgba(255,107,107,0.1)] text-[var(--text-dim)] hover:text-[#ff6b6b] transition" title="Remove"><Trash2 size={15} /></button>
            </div>
        </div>
    );
}

function ContractorModal({ editing, onClose, onSaved }: { editing: DbContractor | null; onClose: () => void; onSaved: () => void }) {
    const [draft, setDraft] = useState<Draft>(
        editing
            ? { name: editing.name, role: editing.role ?? "", country: editing.country, wallet: editing.wallet, monthly_amount: String(editing.monthly_amount), tax_id: editing.tax_id ?? "" }
            : EMPTY
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

    const rule = getTaxRule(draft.country);
    const walletOk = draft.wallet === "" ? null : isAddress(draft.wallet);
    const taxOk = !draft.tax_id || !rule ? null : validateTaxId(draft.tax_id, draft.country);

    async function save() {
        setSaving(true); setError(null);
        try {
            const payload = { ...draft, monthly_amount: Number(draft.monthly_amount) };
            const res = await fetch(editing ? `/api/contractors/${editing.id}` : "/api/contractors", {
                method: editing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Save failed");
            onSaved();
        } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); setSaving(false); }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text)]"><X size={18} /></button>
                <div className="kicker">{editing ? "Edit" : "New"}</div>
                <h2 className="font-display text-2xl font-semibold tracking-tight mt-1 mb-5">{editing ? "Edit contractor" : "Add contractor"}</h2>

                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <FormField label="Full name" className="col-span-2" value={draft.name} onChange={(v) => set("name", v)} placeholder="Chidi Okafor" />
                    <FormField label="Role" className="col-span-2" value={draft.role} onChange={(v) => set("role", v)} placeholder="Senior Developer" />
                    <div>
                        <FieldLabel>Country</FieldLabel>
                        <select value={draft.country} onChange={(e) => set("country", e.target.value)}
                            className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition">
                            {SUPPORTED_COUNTRIES.map((c: any) => <option key={c} value={c}>{flagFor(c)} {c}</option>)}
                        </select>
                    </div>
                    <FormField label="Monthly amount (USD)" mono value={draft.monthly_amount} onChange={(v) => set("monthly_amount", v.replace(/[^0-9.]/g, ""))} placeholder="1000" />
                    <div className="col-span-2">
                        <FieldLabel>Wallet address</FieldLabel>
                        <input value={draft.wallet} onChange={(e) => set("wallet", e.target.value)} placeholder="0x…"
                            className={`w-full bg-[var(--surface-2)] border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 transition ${walletOk === false ? "border-[#ff6b6b] focus:ring-[#ff6b6b]" : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]"}`} />
                        {walletOk === false && <p className="text-[11px] text-[#ff6b6b] mt-1 flex items-center gap-1"><AlertCircle size={11} /> Not a valid Ethereum address</p>}
                        {walletOk === true && <p className="text-[11px] text-[var(--accent)] mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> Valid address</p>}
                    </div>
                    <div className="col-span-2">
                        <FieldLabel>{rule ? `${rule.taxIdName} (${draft.country})` : "Tax ID"}</FieldLabel>
                        <input value={draft.tax_id} onChange={(e) => set("tax_id", e.target.value)} placeholder={rule?.taxIdPlaceholder ?? "—"}
                            className={`w-full bg-[var(--surface-2)] border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 transition ${taxOk === false ? "border-[#f5b14c] focus:ring-[#f5b14c]" : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]"}`} />
                        {taxOk === false && <p className="text-[11px] text-[#f5b14c] mt-1 flex items-center gap-1"><AlertCircle size={11} /> Doesn&rsquo;t match {draft.country} {rule?.taxIdName} format</p>}
                    </div>
                </div>

                {error && <div className="mt-4 text-sm text-[#ff6b6b] flex items-center gap-1.5"><AlertCircle size={14} /> {error}</div>}

                <div className="mt-6 flex items-center gap-3">
                    <button onClick={save} disabled={saving || walletOk === false} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={16} /> {editing ? "Save changes" : "Add contractor"}</>}
                    </button>
                    <button onClick={onClose} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)]">Cancel</button>
                </div>
            </div>
        </div>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <div className="text-[0.65rem] text-[var(--text-faint)] uppercase tracking-wider font-mono mb-1.5">{children}</div>;
}
function FormField({ label, value, onChange, placeholder, mono, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; className?: string }) {
    return (
        <div className={className}>
            <FieldLabel>{label}</FieldLabel>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition ${mono ? "font-mono" : ""}`} />
        </div>
    );
}