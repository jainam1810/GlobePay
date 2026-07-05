"use client";
import { useEffect, useState } from "react";
import { History, CheckCircle2, ExternalLink, Loader2, AlertCircle, Copy, Check, ChevronDown, DownloadCloud, Send } from "lucide-react";
import type { SavedPayment } from "@/lib/payments";
import { truncate, flagFor, avatarFor } from "@/lib/contractor-types";

export default function PaymentsPage() {
    const [payments, setPayments] = useState<SavedPayment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importNote, setImportNote] = useState<string | null>(null);

    function load() {
        fetch("/api/payments")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setPayments(j.payments || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }
    useEffect(load, []);

    async function backfill() {
        setImporting(true); setImportNote(null);
        try {
            const r = await fetch("/api/payments/backfill", { method: "POST" });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Import failed");
            setImportNote(j.imported > 0
                ? `Imported ${j.imported} past payment${j.imported === 1 ? "" : "s"} from the blockchain.`
                : "Nothing new to import — history is already complete.");
            load();
        } catch (e) {
            setImportNote(e instanceof Error ? e.message : "Import failed");
        } finally {
            setImporting(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="kicker">Transaction history</div>
                    <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Payments</h1>
                    <p className="text-[var(--text-dim)] mt-2 max-w-md">
                        Every payroll you&rsquo;ve run — each one a plain-language receipt, backed by proof on the blockchain.
                    </p>
                </div>
                <button onClick={backfill} disabled={importing}
                    className="self-start md:self-auto inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition disabled:opacity-50">
                    {importing ? <><Loader2 size={15} className="animate-spin" /> Checking the blockchain…</> : <><DownloadCloud size={15} /> Import past payments</>}
                </button>
            </div>

            {importNote && (
                <div className="fade-up mt-6 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)] px-4 py-3 text-sm">{importNote}</div>
            )}
            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {payments === null && !error && (
                <div className="fade-up mt-8 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading payments…
                </div>
            )}

            {payments && payments.length === 0 && <EmptyState onImport={backfill} importing={importing} />}

            {payments && payments.length > 0 && (
                <>
                    <div className="fade-up delay-1 mt-6 text-xs text-[var(--text-faint)] font-mono">
                        {payments.length} payment{payments.length === 1 ? "" : "s"} · newest first
                    </div>
                    <div className="fade-up delay-2 mt-3 space-y-3">
                        {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
                    </div>
                    <Footnote />
                </>
            )}
        </div>
    );
}

function EmptyState({ onImport, importing }: { onImport: () => void; importing: boolean }) {
    return (
        <div className="fade-up mt-8 card p-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4">
                <History size={20} />
            </div>
            <div className="font-display text-xl font-semibold">No payments recorded yet</div>
            <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                Run a payroll and it&rsquo;ll appear here automatically. Already paid people before? Import those runs straight from the blockchain.
            </p>
            <button onClick={onImport} disabled={importing} className="btn-primary mt-6 inline-flex disabled:opacity-50">
                {importing ? <><Loader2 size={15} className="animate-spin" /> Checking…</> : <><DownloadCloud size={15} /> Import past payments</>}
            </button>
        </div>
    );
}

const fmtUsdc = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
// Testnet fees are fractions of a cent — never let them round to "0.000000".
const fmtFee = (f: number) => f > 0 && f < 0.00001 ? "< 0.00001 ETH" : `${f.toFixed(5)} ETH`;

function PaymentRow({ p }: { p: SavedPayment }) {
    const [open, setOpen] = useState(false);
    const when = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
    const date = when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const time = when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const named = p.recipients.filter((r) => r.name);
    const headline = named.length === p.recipient_count && named.length > 0 && p.recipient_count <= 3
        ? named.map((r) => r.name!.split(" ")[0]).join(", ")
        : `${p.recipient_count} contractor${p.recipient_count === 1 ? "" : "s"}`;

    return (
        <div className="card overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 p-5 text-left hover:bg-[var(--surface-2)] transition-colors">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[rgba(47,230,168,0.08)] border border-[rgba(47,230,168,0.2)] text-[var(--accent)]">
                    <Send size={16} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[15px]">Paid {headline}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] bg-[rgba(47,230,168,0.07)] border border-[rgba(47,230,168,0.22)] rounded px-1.5 py-0.5">
                            <CheckCircle2 size={10} /> Confirmed
                        </span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-faint)] mt-1.5">
                        {date} · {time} · one transaction, one signature
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="font-mono text-xl font-semibold">{fmtUsdc(p.total_amount)}</div>
                    <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono tracking-wider">{p.token_symbol} sent</div>
                </div>
                <ChevronDown size={16} className={`shrink-0 text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && <Receipt p={p} date={date} time={time} />}
        </div>
    );
}

function Receipt({ p, date, time }: { p: SavedPayment; date: string; time: string }) {
    return (
        <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30">
            <div className="divide-y divide-[var(--border)]">
                {p.recipients.map((r) => {
                    const display = r.name ?? "Unknown wallet";
                    const initials = r.name ? r.name.split(" ").map((n) => n[0]).join("").slice(0, 2) : "0x";
                    const [g1, g2] = avatarFor(display);
                    return (
                        <div key={r.wallet} className="flex items-center gap-3 px-5 py-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display font-semibold text-[11px] text-[#04130d]" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>{initials}</div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{display}{r.country && <span className="ml-1.5 text-sm">{flagFor(r.country)}</span>}</div>
                                <div className="font-mono text-[10px] text-[var(--text-faint)]">{truncate(r.wallet)}</div>
                            </div>
                            <div className="font-mono text-sm font-semibold text-[var(--accent)]">+ {fmtUsdc(r.amount)} {p.token_symbol}</div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 px-5 py-4 border-t border-[var(--border)]">
                <Fact label="Sent on" value={`${date}, ${time}`} />
                <Fact label="Status" value="Confirmed on Base" sub="permanently recorded" tone="accent" />
                <Fact label="From" value={truncate(p.from_address)} sub="your company wallet" />
                <Fact label="Network fee" value={p.fee_eth !== null ? fmtFee(p.fee_eth) : "—"} sub="paid to the network, not GlobePay" />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3.5 border-t border-[var(--border)]">
                <ReceiptId hash={p.tx_hash} />
                <a href={`https://sepolia.basescan.org/tx/${p.tx_hash}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text-dim)] transition">
                    Advanced: raw transaction on Basescan <ExternalLink size={11} />
                </a>
            </div>
        </div>
    );
}

function ReceiptId({ hash }: { hash: string }) {
    const [copied, setCopied] = useState(false);
    function copy() {
        navigator.clipboard.writeText(hash).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    }
    return (
        <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] shrink-0">Receipt ID</span>
            <span className="font-mono text-[11px] text-[var(--text-dim)] truncate">{truncate(hash)}</span>
            <button onClick={copy} className="text-[var(--text-faint)] hover:text-[var(--text)] transition shrink-0" title="Copy full receipt ID">
                {copied ? <Check size={13} className="text-[var(--accent)]" /> : <Copy size={13} />}
            </button>
        </div>
    );
}

function Fact({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "accent" }) {
    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">{label}</div>
            <div className={`font-mono text-sm ${tone === "accent" ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{value}</div>
            {sub && <div className="text-[10px] text-[var(--text-faint)] mt-0.5">{sub}</div>}
        </div>
    );
}

function Footnote() {
    return (
        <div className="fade-up mt-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40">
            <div className="flex items-start gap-2.5 text-[11px] text-[var(--text-faint)] leading-relaxed">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)] shrink-0 mt-0.5">Note</div>
                <div>
                    Every payment here is rebuilt from the blockchain itself — the amounts come from the USDC contract&rsquo;s
                    own transfer log, not from anything typed in. <span className="text-[var(--text-dim)]">&ldquo;Confirmed&rdquo;</span> means
                    the network has permanently recorded it: it can&rsquo;t be edited, reversed, or deleted, and the Receipt ID
                    lets anyone verify it independently.
                </div>
            </div>
        </div>
    );
}
