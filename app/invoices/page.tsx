"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, XCircle, RotateCw, Sparkles } from "lucide-react";
import type { ExtractedInvoice, Confidence } from "@/lib/invoice-schema";

type State =
    | { kind: "idle" }
    | { kind: "extracting"; filename: string; preview: string; isPdf: boolean }
    | { kind: "ready"; filename: string; preview: string; isPdf: boolean; data: ExtractedInvoice }
    | { kind: "error"; filename: string; preview: string; isPdf: boolean; message: string };

export default function InvoicesPage() {
    const [state, setState] = useState<State>({ kind: "idle" });
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleFile(file: File) {
        const isPdf = file.type === "application/pdf";
        const dataUrl = await fileToDataUrl(file);
        setState({ kind: "extracting", filename: file.name, preview: dataUrl, isPdf });

        try {
            const res = await fetch("/api/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl, mimeType: file.type }),
            });
            const json = await res.json();
            if (!res.ok) {
                setState({ kind: "error", filename: file.name, preview: dataUrl, isPdf, message: json?.error || "Extraction failed" });
                return;
            }
            setState({ kind: "ready", filename: file.name, preview: dataUrl, isPdf, data: json.extracted });
        } catch (e) {
            setState({ kind: "error", filename: file.name, preview: dataUrl, isPdf, message: e instanceof Error ? e.message : "Network error" });
        }
    }

    function reset() {
        setState({ kind: "idle" });
        if (inputRef.current) inputRef.current.value = "";
    }

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up flex items-center gap-3">
                <div className="kicker">Invoices · AI extraction</div>
                <span className="badge-testnet"><Sparkles size={10} /> Gemini 2.5</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2 fade-up">Read a messy invoice</h1>
            <p className="text-[var(--text-dim)] mt-2 max-w-xl fade-up">Drop in any invoice — image or PDF. AI pulls out the fields. You confirm. Saved to Records.</p>

            {state.kind === "idle" ? (
                <Dropzone onFile={handleFile} inputRef={inputRef} />
            ) : (
                <div className="fade-up mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Preview state={state} />
                    <ExtractedPanel state={state} onReset={reset} />
                </div>
            )}
        </div>
    );
}

function Dropzone({ onFile, inputRef }: { onFile: (f: File) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
    const [drag, setDrag] = useState(false);
    return (
        <label
            className={`fade-up mt-8 block card cursor-pointer transition-all duration-200 ${drag ? "ring-2 ring-[var(--accent)] bg-[rgba(47,230,168,0.04)]" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        >
            <div className="p-12 md:p-16 flex flex-col items-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(47,230,168,0.08)] border border-[rgba(47,230,168,0.2)] text-[var(--accent)] mb-5">
                    <Upload size={22} />
                </div>
                <div className="font-display text-xl font-semibold">Drop an invoice here</div>
                <p className="text-[var(--text-dim)] text-sm mt-1.5">or click to browse — PDF, PNG, JPG, WEBP</p>
                <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                <div className="mt-7 flex items-center gap-2 text-xs text-[var(--text-faint)]">
                    <Sparkles size={12} /> Powered by Gemini 2.5 Flash · you confirm every field
                </div>
            </div>
        </label>
    );
}

function Preview({ state }: { state: Exclude<State, { kind: "idle" }> }) {
    return (
        <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2 text-sm min-w-0">
                    <FileText size={14} className="text-[var(--text-dim)] shrink-0" />
                    <span className="truncate font-mono text-xs">{state.filename}</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] font-mono">source</span>
            </div>
            <div className="bg-[var(--bg)] p-3 min-h-[420px] flex items-center justify-center">
                {state.isPdf ? (
                    <object data={state.preview} type="application/pdf" className="w-full h-[480px] rounded-lg">
                        <div className="text-center text-[var(--text-dim)] text-sm p-8">
                            <FileText size={28} className="mx-auto mb-2" /> PDF preview unavailable — extraction still runs on the file.
                        </div>
                    </object>
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={state.preview} alt={state.filename} className="max-w-full max-h-[480px] rounded-lg object-contain" />
                )}
            </div>
        </div>
    );
}

function ExtractedPanel({ state, onReset }: { state: Exclude<State, { kind: "idle" }>; onReset: () => void }) {
    if (state.kind === "extracting") {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-2 text-sm text-[var(--accent)]">
                    <Loader2 size={15} className="animate-spin" /> Reading the invoice…
                </div>
                <div className="mt-5 space-y-4">
                    {["Payee", "Amount", "Currency", "Date", "Description"].map((k) => (
                        <div key={k}>
                            <div className="text-[0.65rem] text-[var(--text-faint)] uppercase tracking-wider font-mono mb-1.5">{k}</div>
                            <div className="h-9 rounded-lg bg-[var(--surface-2)] animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (state.kind === "error") {
        return (
            <div className="card p-6">
                <div className="flex items-center gap-2 text-[#ff6b6b]">
                    <XCircle size={16} /> <span className="font-medium text-sm">Extraction failed</span>
                </div>
                <p className="text-sm text-[var(--text-dim)] mt-2 break-words">{state.message}</p>
                <button onClick={onReset} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-sm hover:bg-[var(--surface-2)] transition">
                    <RotateCw size={14} /> Try another invoice
                </button>
            </div>
        );
    }

    return <ConfirmForm initial={state.data} onReset={onReset} />;
}

function ConfirmForm({ initial, onReset }: { initial: ExtractedInvoice; onReset: () => void }) {
    const [data, setData] = useState<ExtractedInvoice>(initial);
    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof ExtractedInvoice>(k: K, v: ExtractedInvoice[K]) => setData((d) => ({ ...d, [k]: v }));

    async function handleSave() {
        setSaving(true); setError(null);
        try {
            const res = await fetch("/api/records", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || "Save failed");
            setSavedId(j.record.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-[var(--accent)] text-sm">
                    <CheckCircle2 size={15} /> Extracted — review &amp; confirm
                </div>
                <ConfidenceBadge level={data.confidence} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Field label="Payee" value={data.payeeName} onChange={(v) => set("payeeName", v)} className="col-span-2" />
                <Field label="Amount" value={String(data.amount)} mono onChange={(v) => set("amount", Number(v) || 0)} />
                <Field label="Currency" value={data.currency} mono onChange={(v) => set("currency", v.toUpperCase())} />
                <Field label="Date" value={data.date} mono onChange={(v) => set("date", v)} />
                <Field label="Invoice #" value={data.invoiceNumber} mono onChange={(v) => set("invoiceNumber", v)} />
                <Field label="Description" value={data.description} onChange={(v) => set("description", v)} className="col-span-2" />
                {data.notes && (
                    <div className="col-span-2 flex gap-2 items-start text-xs text-[#f5b14c] bg-[rgba(245,177,76,0.06)] border border-[rgba(245,177,76,0.2)] rounded-lg px-3 py-2">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span><span className="font-medium">AI noted: </span>{data.notes}</span>
                    </div>
                )}
            </div>

            <div className="mt-6 flex items-center gap-3 flex-wrap">
                {!savedId ? (
                    <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={16} /> Confirm &amp; save record</>}
                    </button>
                ) : (
                    <div className="notice rounded-xl px-4 py-2.5 text-sm flex items-center gap-2">
                        <CheckCircle2 size={15} /> Saved — <Link href="/records" className="underline underline-offset-2 ml-1">view in Records</Link>
                    </div>
                )}
                <button onClick={onReset} className="text-sm text-[var(--text-dim)] hover:text-[var(--text)] inline-flex items-center gap-1.5">
                    <RotateCw size={13} /> Try another
                </button>
                {error && <div className="basis-full text-sm text-[#ff6b6b]">{error}</div>}
            </div>
        </div>
    );
}

function Field({ label, value, onChange, mono, className }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; className?: string }) {
    const isEmpty = value === "" || value === "0";
    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-1.5">
                <div className="text-[0.65rem] text-[var(--text-faint)] uppercase tracking-wider font-mono">{label}</div>
                {isEmpty && (
                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#f5b14c] bg-[rgba(245,177,76,0.08)] border border-[rgba(245,177,76,0.22)] rounded px-1.5 py-0.5">
                        Not on invoice
                    </span>
                )}
            </div>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={isEmpty ? "— add manually —" : ""}
                className={`w-full bg-[var(--surface-2)] border ${isEmpty ? "border-[rgba(245,177,76,0.25)]" : "border-[var(--border)]"} rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition placeholder:text-[var(--text-faint)] ${mono ? "font-mono" : ""}`}
            />
        </div>
    );
}

function ConfidenceBadge({ level }: { level: Confidence }) {
    const map: Record<Confidence, { label: string; cls: string }> = {
        high: { label: "High confidence", cls: "text-[var(--accent)] border-[rgba(47,230,168,0.3)] bg-[rgba(47,230,168,0.08)]" },
        medium: { label: "Medium confidence", cls: "text-[#f5b14c]       border-[rgba(245,177,76,0.3)] bg-[rgba(245,177,76,0.08)]" },
        low: { label: "Low confidence", cls: "text-[#ff6b6b]       border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)]" },
    };
    const v = map[level];
    return <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-md px-2 py-1 ${v.cls}`}>{v.label}</span>;
}

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}