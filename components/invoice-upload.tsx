"use client";
// The client's side of the invoice queue: drop files in, watch what happens.
//
// Replaces messaging invoices one at a time and waiting. A month's worth goes in
// at once, each is read as it lands, and every one carries a status the client
// can see — because an invoice that vanished into somebody's inbox is an invoice
// they will send again next week.
//
// Uploads run one at a time on purpose. Each spends a Gemini call, and firing
// forty in parallel would hit the rate limit and fail most of them; sequential
// means the fortieth is slower but the whole batch lands.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, FileText, Loader2, RefreshCw, TriangleAlert, Upload } from "lucide-react";
import { ALLOWED_TYPES, MAX_ATTACHMENT_BYTES, prettyBytes } from "@/lib/messages";
import { STATUS_COPY, type InvoiceSubmission } from "@/lib/invoice-submissions";
import { SkeletonRows, Empty } from "@/components/ui/kit";

const money = (n: number | null, ccy: string | null) =>
    n === null ? "—" : `${ccy && ccy !== "USD" ? ccy + " " : "$"}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Queued = { name: string; state: "waiting" | "reading" | "done" | "failed"; error?: string };

export default function InvoiceUpload() {
    const [rows, setRows] = useState<InvoiceSubmission[] | null>(null);
    const [queue, setQueue] = useState<Queued[]>([]);
    const [drag, setDrag] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/invoices");
            const j = await r.json();
            setRows(r.ok ? (j.submissions ?? []) : []);
        } catch { setRows([]); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function send(files: File[]) {
        setErr(null);
        const usable = files.filter((f) => {
            if (!ALLOWED_TYPES.includes(f.type)) return false;
            if (f.size > MAX_ATTACHMENT_BYTES) return false;
            return true;
        });
        if (usable.length !== files.length) {
            setErr("Some files were skipped — send PDFs or images under 10 MB.");
        }
        if (!usable.length) return;

        setQueue(usable.map((f) => ({ name: f.name, state: "waiting" as const })));

        for (let i = 0; i < usable.length; i++) {
            const f = usable[i];
            setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: "reading" } : x)));
            try {
                const dataUrl: string = await new Promise((res, rej) => {
                    const fr = new FileReader();
                    fr.onload = () => res(String(fr.result));
                    fr.onerror = () => rej(new Error("unreadable"));
                    fr.readAsDataURL(f);
                });
                const r = await fetch("/api/invoices", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: f.name, type: f.type, dataUrl }),
                });
                const j = await r.json();
                if (!r.ok) throw new Error(j?.error || "Upload failed");
                setQueue((q) => q.map((x, j2) => (j2 === i ? { ...x, state: "done" } : x)));
            } catch (e) {
                setQueue((q) => q.map((x, j2) => (j2 === i
                    ? { ...x, state: "failed", error: e instanceof Error ? e.message : "Upload failed" }
                    : x)));
            }
        }

        await load();
        // Leave failures on screen; clear the batch once it all landed.
        setQueue((q) => (q.every((x) => x.state === "done") ? [] : q));
    }

    const busy = queue.some((q) => q.state === "waiting" || q.state === "reading");

    return (
        <div className="space-y-6">
            <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                    e.preventDefault(); setDrag(false);
                    void send([...e.dataTransfer.files]);
                }}
            >
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={busy}
                    className={`w-full rounded-2xl border border-dashed px-6 py-10 text-center transition disabled:opacity-60 ${drag ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] hover:border-[var(--accent-line)] hover:bg-[var(--surface-2)]"
                        }`}
                >
                    {busy ? (
                        <Loader2 size={20} className="mx-auto mb-2 animate-spin text-[var(--accent)]" />
                    ) : (
                        <Upload size={20} className="mx-auto mb-2 text-[var(--text-faint)]" />
                    )}
                    <div className="text-[15px] font-medium">
                        {busy ? "Reading your invoices…" : "Drop this month's invoices here"}
                    </div>
                    <div className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--text-dim)]">
                        All of them at once — PDFs or photos, however your freelancers sent them.
                        We read each one and check it before anything is paid.
                    </div>
                </button>
                <input
                    ref={inputRef} type="file" multiple className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => { void send([...(e.target.files ?? [])]); e.target.value = ""; }}
                />
            </div>

            {err && (
                <p className="flex items-start gap-2 text-[12px] text-[var(--warn)]">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />{err}
                </p>
            )}

            {/* The batch in flight. Separate from the table below because these
                are not submissions yet — a file still reading has no row. */}
            {queue.length > 0 && (
                <ul className="space-y-1.5">
                    {queue.map((q, i) => (
                        <li key={`${q.name}-${i}`} className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px]">
                            {q.state === "reading" ? <Loader2 size={13} className="animate-spin text-[var(--accent)]" />
                                : q.state === "done" ? <CheckCircle2 size={13} className="text-[var(--accent)]" />
                                    : q.state === "failed" ? <TriangleAlert size={13} className="text-[var(--danger)]" />
                                        : <Clock size={13} className="text-[var(--text-faint)]" />}
                            <span className="min-w-0 flex-1 truncate">{q.name}</span>
                            <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
                                {q.state === "failed" ? q.error : q.state === "reading" ? "reading" : q.state === "done" ? "sent" : "waiting"}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <div>
                <h2 className="mb-3 text-[13px] font-medium text-[var(--text-dim)]">Sent to GlobePay</h2>
                {rows === null ? (
                    <SkeletonRows rows={3} cols={4} />
                ) : rows.length === 0 ? (
                    <Empty
                        icon={FileText}
                        title="Nothing sent yet"
                        body="Invoices you upload appear here with their status, so you always know what we have and what we've checked."
                    />
                ) : (
                    <ul className="space-y-2">
                        {rows.map((r) => <Row key={r.id} r={r} onReplace={(f) => void send(f)} />)}
                    </ul>
                )}
            </div>
        </div>
    );
}

function Row({ r, onReplace }: { r: InvoiceSubmission; onReplace: (files: File[]) => void }) {
    const replaceRef = useRef<HTMLInputElement>(null);
    const copy = STATUS_COPY[r.status];
    const tone = r.status === "accepted" ? "text-[var(--accent)]"
        : r.status === "needs_attention" ? "text-[var(--warn)]"
            : "text-[var(--text-faint)]";
    const Icon = r.status === "accepted" ? CheckCircle2
        : r.status === "needs_attention" ? TriangleAlert : Clock;

    return (
        <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                    <span className="text-[14px] font-medium">{r.payee_name || r.file_name}</span>
                    {r.invoice_number && (
                        <span className="ml-2 font-mono text-[11px] text-[var(--text-faint)]">{r.invoice_number}</span>
                    )}
                </div>
                <span className="font-mono text-[14px]">{money(r.amount, r.currency)}</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className={`inline-flex items-center gap-1.5 ${tone}`}>
                    <Icon size={12} /> {copy.label}
                </span>
                <span className="text-[var(--text-faint)]">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
                {r.file_size !== null && (
                    <span className="text-[var(--text-faint)]">{prettyBytes(r.file_size)}</span>
                )}
            </div>

            {/* The reason, when there is one. Without it a rejected invoice is
                just a red word and the client's only move is to send it again. */}
            {r.review_note && (
                <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-[12px] leading-relaxed text-[var(--text-dim)]">
                    {r.review_note}
                </p>
            )}

            {/* Something to actually do about it. Being told an invoice needs
                fixing and then having to scroll back up and guess which file to
                drag is how the same wrong one gets sent twice. */}
            {r.status === "needs_attention" && (
                <>
                    <button
                        onClick={() => replaceRef.current?.click()}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 py-1.5 text-[12px] text-[var(--text-dim)] transition hover:border-[var(--accent-line)] hover:text-[var(--text)]"
                    >
                        <RefreshCw size={12} /> Send a corrected version
                    </button>
                    <input
                        ref={replaceRef} type="file" className="hidden" accept="image/*,application/pdf"
                        onChange={(e) => { onReplace([...(e.target.files ?? [])]); e.target.value = ""; }}
                    />
                </>
            )}
        </li>
    );
}
