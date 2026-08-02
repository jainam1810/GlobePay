"use client";
// Invoice → payment run.
//
// A contractor sends whatever they send — a PDF, a photo of a paper invoice, a
// screenshot. Gemini reads the fields; a human confirms them; the amount then
// lands on that contractor's line in the next payment run, which is what
// produces the tax entry and the audit row.
//
// The house rule holds: AI reads the messy input, code decides the money. The
// model never picks who gets paid and never sets the figure unchallenged — it
// proposes, and nothing moves until someone confirms.
import { useMemo, useRef, useState } from "react";
import {
    Upload, Loader2, AlertCircle, Sparkles, FileText, Check, X, ArrowRight,
} from "lucide-react";
import type { ExtractedInvoice } from "@/lib/invoice-schema";
import type { DbContractor } from "@/lib/contractor-types";
import { formatUSD } from "@/lib/contractor-types";

// Loose match: invoices spell names inconsistently ("Chidi Okatar Ltd",
// "okatar, chidi"). Compare on lowercased letters only and accept a containment
// either way — then show the human what we matched so they can override.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
function guessContractor(name: string, roster: DbContractor[]) {
    const n = norm(name);
    if (!n) return null;
    return roster.find((c) => norm(c.name) === n)
        ?? roster.find((c) => norm(c.name).includes(n) || n.includes(norm(c.name)))
        ?? null;
}

export default function InvoiceIntake({ roster, onAdd, onClose }: {
    roster: DbContractor[];
    onAdd: (contractorId: string, amountUsd: number) => void;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [data, setData] = useState<ExtractedInvoice | null>(null);
    const [contractorId, setContractorId] = useState("");
    const [amount, setAmount] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const notUsd = !!data && data.currency && data.currency.toUpperCase() !== "USD";
    const chosen = useMemo(() => roster.find((c) => c.id === contractorId) ?? null, [roster, contractorId]);

    async function read(file: File) {
        setBusy(true); setErr(null); setData(null); setFileName(file.name);
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
            setData(inv);

            const guess = guessContractor(inv.payeeName, roster);
            setContractorId(guess?.id ?? "");
            // Only prefill the figure when the invoice is already in USD. A
            // foreign-currency total is not the amount to pay and must not be
            // typed into a dollar field by us.
            setAmount(inv.currency?.toUpperCase() === "USD" && inv.amount > 0 ? String(inv.amount) : "");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Could not read that invoice");
            setFileName(null);
        } finally { setBusy(false); }
    }

    function add() {
        const n = Number(amount);
        if (!contractorId || !(n > 0)) return;
        onAdd(contractorId, n);
    }

    const input = "w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition";

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

            {!data && (
                <>
                    <button
                        onClick={() => inputRef.current?.click()}
                        disabled={busy}
                        className="w-full rounded-xl border border-dashed border-[var(--border-strong)] px-5 py-8 text-center transition hover:border-[var(--accent-line)] hover:bg-[var(--surface-2)] disabled:opacity-60"
                    >
                        {busy ? (
                            <span className="inline-flex items-center gap-2 text-sm text-[var(--text-dim)]">
                                <Loader2 size={15} className="animate-spin" /> Reading {fileName}…
                            </span>
                        ) : (
                            <>
                                <Upload size={18} className="mx-auto mb-2 text-[var(--text-faint)]" />
                                <div className="text-sm font-medium">Drop in a PDF, photo or screenshot</div>
                                <div className="text-[12px] text-[var(--text-dim)] mt-1">
                                    However the contractor sent it. We read the fields; you confirm them.
                                </div>
                            </>
                        )}
                    </button>
                    <input
                        ref={inputRef} type="file" className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ""; }}
                    />
                </>
            )}

            {err && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                    <AlertCircle size={14} /> {err}
                </div>
            )}

            {data && (
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    {/* what the model read */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--border)]">
                            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                <FileText size={12} /> {fileName}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                                <span className={`dot ${data.confidence === "high" ? "dot-ok" : data.confidence === "medium" ? "dot-pending" : "dot-failed"}`} />
                                {data.confidence} confidence
                            </span>
                        </div>
                        <dl className="divide-y divide-[var(--border)]">
                            {[
                                ["Billed by", data.payeeName || "—"],
                                ["Invoice", data.invoiceNumber || "—"],
                                ["Total", data.amount ? `${data.amount.toLocaleString("en-US")} ${data.currency || ""}`.trim() : "—"],
                                ["Date", data.date || "—"],
                                ["For", data.description || "—"],
                            ].map(([k, v]) => (
                                <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-2">
                                    <dt className="text-[12px] text-[var(--text-dim)] shrink-0">{k}</dt>
                                    <dd className="text-[12px] text-right truncate">{v}</dd>
                                </div>
                            ))}
                        </dl>
                        {data.notes && (
                            <div className="px-4 py-2.5 border-t border-[var(--border)] text-[11px] text-[var(--warn)] bg-[var(--warn-soft)]">
                                {data.notes}
                            </div>
                        )}
                    </div>

                    {/* what actually happens — the human decides */}
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                        <label className="block">
                            <span className="block text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Pay which contractor</span>
                            <select className={input} value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
                                <option value="">Select a contractor…</option>
                                {roster.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.country}</option>)}
                            </select>
                        </label>
                        {chosen && norm(chosen.name) !== norm(data.payeeName) && (
                            <p className="mt-1.5 text-[11px] text-[var(--warn)]">
                                Invoice says “{data.payeeName}” — check this is the same person.
                            </p>
                        )}

                        <label className="block mt-3">
                            <span className="block text-[11px] uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Amount to pay (USD)</span>
                            <input
                                type="number" min="0" step="any" className={input}
                                value={amount} onChange={(e) => setAmount(e.target.value)}
                                placeholder={notUsd ? `Invoice is in ${data.currency} — enter the USD figure` : "0.00"}
                            />
                        </label>
                        {notUsd && (
                            <p className="mt-1.5 text-[11px] text-[var(--warn)]">
                                This invoice is in {data.currency}. We don&rsquo;t convert it for you — enter what you&rsquo;re
                                paying in USD so the record matches what actually leaves your wallet.
                            </p>
                        )}

                        <div className="flex items-center gap-2 mt-4">
                            <button onClick={add} disabled={!contractorId || !(Number(amount) > 0)}
                                className="btn-primary text-sm py-2 px-4 disabled:opacity-40">
                                <Check size={15} /> Add to payment run
                            </button>
                            <button onClick={() => { setData(null); setFileName(null); setErr(null); }}
                                className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text)] transition">
                                Read another
                            </button>
                        </div>

                        {chosen && Number(amount) > 0 && (
                            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
                                <ArrowRight size={12} />
                                {chosen.name} will be selected for {formatUSD(Number(amount))} on this run
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
