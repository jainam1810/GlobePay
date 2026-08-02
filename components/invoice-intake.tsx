"use client";
// Invoice → payment run.
//
// A contractor sends whatever they send — a PDF, a photo of a paper invoice, a
// screenshot. Gemini reads the fields; a human corrects and confirms them; the
// amount then lands on that contractor's line in the next payment run, which is
// what produces the tax entry and the audit row.
//
// The house rule holds: AI reads the messy input, code decides the money. Every
// extracted field is editable, because the model is a first draft and the
// operator is the author. Nothing moves until someone confirms.
import { useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import {
    Upload, Loader2, AlertCircle, Sparkles, FileText, Check, X, ArrowRight, UserPlus,
} from "lucide-react";
import type { ExtractedInvoice } from "@/lib/invoice-schema";
import { SUPPORTED_COUNTRIES, formatUSD, type DbContractor } from "@/lib/contractor-types";
import { getTaxRule, validateTaxId } from "@/lib/tax-rules";

// Loose match: invoices spell names inconsistently ("Chidi Okatar Ltd",
// "okatar, chidi"). Compare on lowercased letters only and accept containment
// either way — then show the human what we matched so they can override.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
function guessContractor(name: string, roster: DbContractor[]) {
    const n = norm(name);
    if (!n) return null;
    return roster.find((c) => norm(c.name) === n)
        ?? roster.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)))
        ?? null;
}

const NEW = "__new__";

export type InvoiceMeta = { number?: string; date?: string; description?: string };

export default function InvoiceIntake({ clientId, roster, onAdd, onRosterChange, onClose }: {
    clientId: string;
    roster: DbContractor[];
    onAdd: (contractorId: string, amountUsd: number, invoice: InvoiceMeta) => void;
    onRosterChange: () => void;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [raw, setRaw] = useState<ExtractedInvoice | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Everything the model read, now owned by the operator.
    const [form, setForm] = useState({
        payeeName: "", invoiceNumber: "", date: "", description: "",
        currency: "USD", amountUsd: "",
    });
    // Who gets paid: an existing contractor, or one we're about to create.
    const [target, setTarget] = useState("");
    const [nu, setNu] = useState({ name: "", role: "", country: "Nigeria", wallet: "", tax_id: "" });

    const chosen = useMemo(() => roster.find((c) => c.id === target) ?? null, [roster, target]);
    const notUsd = form.currency.toUpperCase() !== "USD";
    // Invoice fraud is normally a real invoice with the attacker's address
    // swapped in, so a quoted wallet that differs from the one on file is worth
    // stopping on.
    const walletMismatch = !!(chosen && raw?.payeeWallet
        && raw.payeeWallet.trim().toLowerCase() !== chosen.wallet.trim().toLowerCase());

    const walletOk = !nu.wallet.trim() || isAddress(nu.wallet.trim());
    const rule = getTaxRule(nu.country);
    const taxIdOk = !nu.tax_id.trim() || !rule || validateTaxId(nu.tax_id.trim(), nu.country);
    const newReady = !!nu.name.trim() && isAddress(nu.wallet.trim()) && taxIdOk;

    async function read(file: File) {
        setBusy(true); setErr(null); setRaw(null); setFileName(file.name);
        try {
            const dataUrl: string = await new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => res(String(fr.result));
                fr.onerror = () => rej(new Error("Could not read that file"));
                fr.readAsDataURL(file);
            });
            const r = await fetch("/api/extract", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl, mimeType: file.type }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Could not read that invoice");
            const inv = j.extracted as ExtractedInvoice;
            if (!inv) throw new Error("Nothing readable came back from that file");
            setRaw(inv);

            const isUsd = (inv.currency || "USD").toUpperCase() === "USD";
            setForm({
                payeeName: inv.payeeName ?? "",
                invoiceNumber: inv.invoiceNumber ?? "",
                date: inv.date ?? "",
                description: inv.description ?? "",
                currency: inv.currency || "USD",
                // Only prefill the figure when the invoice is already in USD. A
                // foreign-currency total is not the amount to pay and must not be
                // typed into a dollar field by us.
                amountUsd: isUsd && inv.amount > 0 ? String(inv.amount) : "",
            });

            const guess = guessContractor(inv.payeeName ?? "", roster);
            setTarget(guess?.id ?? (roster.length ? "" : NEW));
            // Seed the new-contractor form from the invoice, wallet included —
            // that's usually the only place it's written down.
            setNu((p) => ({
                ...p,
                name: inv.payeeName ?? "",
                wallet: inv.payeeWallet ?? "",
            }));
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not read that invoice");
            setFileName(null);
        } finally { setBusy(false); }
    }

    async function submit() {
        const n = Number(form.amountUsd);
        if (!(n > 0)) return;
        const meta: InvoiceMeta = {
            number: form.invoiceNumber.trim() || undefined,
            date: form.date || undefined,
            description: form.description.trim() || undefined,
        };

        if (target !== NEW) {
            if (!target) return;
            onAdd(target, n, meta);
            return;
        }

        // Create the contractor first, then put them on the run.
        setSaving(true); setErr(null);
        try {
            const r = await fetch("/api/contractors", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    client_id: clientId,
                    name: nu.name.trim(),
                    role: nu.role.trim() || null,
                    country: nu.country,
                    wallet: nu.wallet.trim(),
                    tax_id: nu.tax_id.trim() || null,
                    monthly_amount: 0,   // this invoice sets the amount for this run only
                }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Could not add that contractor");
            onRosterChange();
            onAdd(j.contractor.id, n, meta);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not add that contractor");
        } finally { setSaving(false); }
    }

    const input = "w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition";
    const canSubmit = Number(form.amountUsd) > 0 && (target === NEW ? newReady : !!target);

    return (
        <div className="px-5 md:px-6 py-5 border-b border-[var(--border)] bg-[var(--surface-2)]/40">
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                    <Sparkles size={14} className="text-[var(--accent)]" /> Add from an invoice
                </div>
                <button onClick={onClose} aria-label="Close" className="text-[var(--text-faint)] hover:text-[var(--text)] transition">
                    <X size={15} />
                </button>
            </div>

            {!raw && (
                <>
                    <button onClick={() => inputRef.current?.click()} disabled={busy}
                        className="w-full rounded-xl border border-dashed border-[var(--border-strong)] px-5 py-8 text-center transition hover:border-[var(--accent-line)] hover:bg-[var(--surface-2)] disabled:opacity-60">
                        {busy ? (
                            <span className="inline-flex items-center gap-2 text-sm text-[var(--text-dim)]">
                                <Loader2 size={15} className="animate-spin" /> Reading {fileName}…
                            </span>
                        ) : (
                            <>
                                <Upload size={18} className="mx-auto mb-2 text-[var(--text-faint)]" />
                                <div className="text-sm font-medium">Drop in a PDF, photo or screenshot</div>
                                <div className="text-[12px] text-[var(--text-dim)] mt-1">
                                    However the contractor sent it. We read the fields; you correct anything we got wrong.
                                </div>
                            </>
                        )}
                    </button>
                    <input ref={inputRef} type="file" className="hidden" accept="image/*,application/pdf"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }} />
                </>
            )}

            {err && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                    <AlertCircle size={14} /> {err}
                </div>
            )}

            {raw && (
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* what the model read — every field editable */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--border)]">
                            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                <FileText size={12} /> {fileName}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                                <span className={`dot ${raw.confidence === "high" ? "dot-ok" : raw.confidence === "medium" ? "dot-pending" : "dot-failed"}`} />
                                {raw.confidence} confidence
                            </span>
                        </div>

                        <div className="p-4 grid gap-3 sm:grid-cols-2">
                            <Field label="Billed by" className="sm:col-span-2">
                                <input className={input} value={form.payeeName}
                                    onChange={(e) => setForm({ ...form, payeeName: e.target.value })} />
                            </Field>
                            <Field label="Invoice number">
                                <input className={input} value={form.invoiceNumber} placeholder="—"
                                    onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
                            </Field>
                            <Field label="Invoice date">
                                <input type="date" className={input} value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                            </Field>
                            <Field label="Currency on invoice">
                                <input className={`${input} uppercase`} value={form.currency} maxLength={3}
                                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                            </Field>
                            <Field label="Invoice total (as written)">
                                <div className="px-3 py-2 text-sm rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] font-mono">
                                    {raw.amount ? raw.amount.toLocaleString("en-US") : "—"} {raw.currency}
                                </div>
                            </Field>
                            <Field label="For" className="sm:col-span-2">
                                <input className={input} value={form.description} placeholder="—"
                                    onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </Field>
                        </div>

                        {raw.notes && (
                            <div className="px-4 py-2.5 border-t border-[var(--border)] text-[11px] text-[var(--warn)] bg-[var(--warn-soft)]">
                                {raw.notes}
                            </div>
                        )}
                    </div>

                    {/* who gets paid, and how much */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <Field label="Pay which contractor">
                            <select className={input} value={target} onChange={(e) => setTarget(e.target.value)}>
                                <option value="">Select a contractor…</option>
                                {roster.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.country}</option>)}
                                <option value={NEW}>+ Add as a new contractor</option>
                            </select>
                        </Field>

                        {chosen && norm(chosen.name) !== norm(form.payeeName) && (
                            <p className="mt-1.5 text-[11px] text-[var(--warn)]">
                                Invoice says “{form.payeeName}” — check this is the same person.
                            </p>
                        )}

                        {/* Where the money will actually go, next to where the
                            invoice asked it to go. An invoice quoting a different
                            address than the one on file is the classic redirect
                            scam, so it is called out rather than merely shown —
                            but we never overwrite a saved wallet from a document. */}
                        {chosen && (
                            <div className={`mt-3 rounded-lg border p-3 ${walletMismatch
                                ? "border-[var(--danger-line)] bg-[var(--danger-soft)]"
                                : "border-[var(--border)] bg-[var(--surface-2)]"}`}>
                                <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">
                                    Will be paid to
                                </div>
                                <div className="font-mono text-[11px] break-all">{chosen.wallet}</div>

                                {raw.payeeWallet && (
                                    <div className="mt-2 pt-2 border-t border-[var(--border)]">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">
                                            Wallet written on the invoice
                                        </div>
                                        <div className={`font-mono text-[11px] break-all ${walletMismatch ? "text-[var(--danger)]" : "text-[var(--ok)]"}`}>
                                            {raw.payeeWallet}
                                        </div>
                                    </div>
                                )}

                                {walletMismatch ? (
                                    <p className="mt-2 text-[11px] text-[var(--danger)] leading-relaxed">
                                        <strong>These do not match.</strong> Payment goes to the address on file, not the one
                                        on the invoice. If the contractor has genuinely changed wallets, confirm it with them
                                        directly — by a channel other than this invoice — and update it on their profile.
                                    </p>
                                ) : raw.payeeWallet ? (
                                    <p className="mt-2 text-[11px] text-[var(--ok)]">Matches the address on file.</p>
                                ) : (
                                    <p className="mt-2 text-[11px] text-[var(--text-faint)]">
                                        No wallet on the invoice — paying the address already on file.
                                    </p>
                                )}
                            </div>
                        )}

                        {target === NEW && (
                            <div className="mt-3 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3">
                                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--accent)] mb-2.5">
                                    <UserPlus size={12} /> New contractor
                                </div>
                                <div className="grid gap-2.5 sm:grid-cols-2">
                                    <Field label="Full name" className="sm:col-span-2">
                                        <input className={input} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
                                    </Field>
                                    <Field label="Role (optional)">
                                        <input className={input} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} placeholder="Developer" />
                                    </Field>
                                    <Field label="Country">
                                        <select className={input} value={nu.country} onChange={(e) => setNu({ ...nu, country: e.target.value })}>
                                            {SUPPORTED_COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Wallet address" className="sm:col-span-2"
                                        hint={raw.payeeWallet ? "Read from the invoice — check it character for character." : "Not on the invoice; ask the contractor."}>
                                        <input className={`${input} font-mono ${nu.wallet && !walletOk ? "border-[var(--danger)]" : ""}`}
                                            placeholder="0x…" value={nu.wallet}
                                            onChange={(e) => setNu({ ...nu, wallet: e.target.value })} />
                                    </Field>
                                    <Field label={`Tax ID (optional)`} className="sm:col-span-2"
                                        hint={rule ? `${rule.taxIdName}, e.g. ${rule.taxIdPlaceholder}` : undefined}>
                                        <input className={`${input} ${nu.tax_id && !taxIdOk ? "border-[var(--danger)]" : ""}`}
                                            value={nu.tax_id} onChange={(e) => setNu({ ...nu, tax_id: e.target.value })} />
                                    </Field>
                                </div>
                                {nu.wallet && !walletOk && (
                                    <p className="mt-2 text-[11px] text-[var(--danger)]">That isn&rsquo;t a valid Ethereum address — check every character.</p>
                                )}
                                {nu.tax_id && !taxIdOk && rule && (
                                    <p className="mt-2 text-[11px] text-[var(--danger)]">Doesn&rsquo;t match the {nu.country} {rule.taxIdName} format.</p>
                                )}
                            </div>
                        )}

                        <Field label="Amount to pay (USD)" className="mt-3">
                            <input type="number" min="0" step="any" className={input}
                                value={form.amountUsd} onChange={(e) => setForm({ ...form, amountUsd: e.target.value })}
                                placeholder={notUsd ? `Invoice is in ${form.currency} — enter the USD figure` : "0.00"} />
                        </Field>
                        {notUsd && (
                            <p className="mt-1.5 text-[11px] text-[var(--warn)]">
                                This invoice is in {form.currency}. We don&rsquo;t convert it for you — enter what you&rsquo;re
                                paying in USD so the record matches what actually leaves the wallet.
                            </p>
                        )}

                        <div className="flex items-center gap-2 mt-4 flex-wrap">
                            <button onClick={submit} disabled={!canSubmit || saving}
                                className="btn-primary text-sm py-2 px-4 disabled:opacity-40">
                                {saving ? <><Loader2 size={15} className="animate-spin" /> Adding…</> : <><Check size={15} /> Add to payment run</>}
                            </button>
                            <button onClick={() => { setRaw(null); setFileName(null); setErr(null); }}
                                className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text)] transition">
                                Read another
                            </button>
                        </div>

                        {canSubmit && (
                            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
                                <ArrowRight size={12} />
                                {(target === NEW ? nu.name : chosen?.name)} will be selected for {formatUSD(Number(form.amountUsd))} on this run
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, hint, className = "", children }: {
    label: string; hint?: string; className?: string; children: React.ReactNode;
}) {
    return (
        <label className={`block ${className}`}>
            <span className="block text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-[10px] text-[var(--text-faint)] mt-1">{hint}</span>}
        </label>
    );
}
