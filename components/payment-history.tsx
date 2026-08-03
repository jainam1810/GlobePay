"use client";
// Shared payment history: list + expandable plain-language receipts.
// The /api/payments route scopes by session (admin: all clients + names;
// client: only their own), so this component works in both worlds.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History, CheckCircle2, ExternalLink, Loader2, AlertCircle, Copy, Check, ChevronDown, DownloadCloud } from "lucide-react";
import type { SavedPayment } from "@/lib/payments";
import { truncate, avatarFor, currencyForCountry } from "@/lib/contractor-types";
import Flag from "@/components/flag";
import { getFxRate } from "@/lib/fx";

const ALL = "__all__";

export default function PaymentHistory({ allowImport = false }: { allowImport?: boolean }) {
    const [payments, setPayments] = useState<SavedPayment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importNote, setImportNote] = useState<string | null>(null);
    const [client, setClient] = useState<string>(ALL);

    // ?highlight=0xabc,0xdef — arrived here from the assistant or a shared link.
    // Those payments are lifted to the top and marked, because someone who
    // didn't scroll here has no idea which row they were sent to find.
    const params = useSearchParams();
    const highlighted = useMemo(() => {
        const raw = params?.get("highlight");
        if (!raw) return new Set<string>();
        return new Set(raw.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
    }, [params]);

    function load() {
        fetch("/api/payments")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setPayments(j.payments || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
    }
    useEffect(load, []);

    // Only meaningful for GlobePay admins — a client's own payments all carry
    // the same name, so the API leaves client_name null in the portal.
    const clientNames = useMemo(
        () => [...new Set((payments || []).map((p) => p.client_name).filter((n): n is string => !!n))].sort(),
        [payments],
    );
    const isHit = (p: SavedPayment) => highlighted.has((p.tx_hash ?? "").toLowerCase());

    const visible = useMemo(() => {
        const list = (payments || []).filter((p) => client === ALL || p.client_name === client);
        if (highlighted.size === 0) return list;
        // Stable partition: the linked payments first, everything else in its
        // existing order underneath. Sorting the whole list would scramble the
        // newest-first ordering people rely on.
        return [...list.filter(isHit), ...list.filter((p) => !isHit(p))];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payments, client, highlighted]);

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
        <div>
            {allowImport && (
                <div className="fade-up flex justify-end">
                    <button onClick={backfill} disabled={importing}
                        className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)] transition disabled:opacity-50">
                        {importing ? <><Loader2 size={15} className="animate-spin" /> Checking the blockchain…</> : <><DownloadCloud size={15} /> Import past payments</>}
                    </button>
                </div>
            )}
            {importNote && <div className="fade-up mt-4 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)] px-4 py-3 text-sm">{importNote}</div>}
            {error && (
                <div className="fade-up mt-4 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {payments === null && !error && (
                <div className="fade-up mt-4 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading payments…
                </div>
            )}

            {payments && payments.length === 0 && (
                <div className="fade-up mt-4 card p-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-4"><History size={20} /></div>
                    <div className="font-display text-xl font-semibold">No payments yet</div>
                    <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">Confirmed payrolls appear here automatically, each with a plain-language receipt.</p>
                </div>
            )}

            {payments && payments.length > 0 && (
                <>
                    {clientNames.length > 1 && (
                        <div className="fade-up mt-4 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mr-1">Client</span>
                            <FilterPill label="All clients" active={client === ALL} onClick={() => setClient(ALL)} />
                            {clientNames.map((n) => (
                                <FilterPill key={n} label={n} active={client === n} onClick={() => setClient(n)} />
                            ))}
                        </div>
                    )}
                    <div className="fade-up mt-4 text-xs text-[var(--text-faint)] font-mono">
                        {visible.length}{visible.length !== payments.length && ` of ${payments.length}`} payment{payments.length === 1 ? "" : "s"} · newest first
                    </div>
                    <div className="fade-up mt-3 space-y-3">
                        {visible.map((p) => <PaymentRow key={p.id} p={p} found={isHit(p)} />)}
                        {visible.length === 0 && (
                            <div className="card p-8 text-center text-sm text-[var(--text-dim)]">No payments for {client}.</div>
                        )}
                    </div>
                    <Footnote />
                </>
            )}
        </div>
    );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${active
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}>
            {label}
        </button>
    );
}

const fmtUsdc = (n: number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const fmtMoney = (n: number, ccy: string) => {
    try {
        return n.toLocaleString("en-GB", { style: "currency", currency: ccy, maximumFractionDigits: n < 1 ? 4 : 2 });
    } catch {
        return `${fmtUsdc(n)} ${ccy}`;   // unknown ISO code — degrade rather than throw
    }
};
// Testnet fees are fractions of a cent, so a fixed 5dp would read "0.00000".
// In ETH mode show the exact number the chain charged, however small.
const fmtFeeEth = (f: number) => `${f} ETH`;

const TESTNET_NOTE =
    "Testnet demo: the chain moved a flat 1 USDC per person. This is the real USD figure from the payroll run — in production that exact amount is what gets sent.";

function PaymentRow({ p, found = false }: { p: SavedPayment; found?: boolean }) {
    // A payment someone was sent to opens on arrival — they came to look at it,
    // so making them click again is a step for nothing.
    const [open, setOpen] = useState(found);
    const when = p.paid_at ? new Date(p.paid_at) : new Date(p.created_at);
    const date = when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const time = when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const named = p.recipients.filter((r) => r.name);
    const headline = named.length === p.recipient_count && named.length > 0 && p.recipient_count <= 3
        ? named.map((r) => r.name!.split(" ")[0]).join(", ")
        : `${p.recipient_count} freelancer${p.recipient_count === 1 ? "" : "s"}`;

    // Prefer the real USD the payroll run recorded; fall back to what the
    // chain actually moved when no run is linked to this transaction.
    const hasIntended = p.intended_total != null;
    const total = hasIntended ? p.intended_total! : p.total_amount;

    return (
        <div className={`card overflow-hidden ${found ? "found scroll-mt-24" : ""}`}
            ref={(el) => {
                // Bring the first linked payment into view. Without this the row
                // is at the top of the list but the page may still be scrolled
                // wherever the browser restored it.
                if (found && el) el.scrollIntoView({ block: "center", behavior: "smooth" });
            }}>
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 p-5 text-left hover:bg-[var(--surface-2)] transition-colors">
                <RecipientStack recipients={p.recipients} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[15px]">Paid {headline}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded px-1.5 py-0.5">
                            <CheckCircle2 size={10} /> Confirmed
                        </span>
                        {p.client_name && (
                            <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-dim)] border border-[var(--border-strong)] rounded px-1.5 py-0.5">
                                {p.client_name}
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-faint)] mt-1.5">
                        {date} · {time}
                    </div>
                </div>
                <div className="text-right shrink-0" title={hasIntended ? TESTNET_NOTE : undefined}>
                    <div className="font-mono text-xl font-semibold">
                        {hasIntended ? fmtMoney(total, "USD") : fmtUsdc(total)}
                    </div>
                    <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono tracking-wider">
                        {hasIntended ? "total paid" : `${p.token_symbol} sent`}
                    </div>
                </div>
                <ChevronDown size={16} className={`shrink-0 text-[var(--text-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && <Receipt p={p} date={date} time={time} />}
        </div>
    );
}

// Network fees are quoted in ETH, which means nothing to a finance team.
// Show the payer's own currency by default and let them flip to exact ETH.
function NetworkFee({ feeEth, country }: { feeEth: number | null; country?: string | null }) {
    const ccy = currencyForCountry(country);
    const [rate, setRate] = useState<number | null>(null);
    const [showEth, setShowEth] = useState(false);

    useEffect(() => {
        let live = true;
        getFxRate("eth", ccy, "latest").then((r) => { if (live) setRate(r); });
        return () => { live = false; };
    }, [ccy]);

    if (feeEth === null) return <Fact label="Network fee" value="—" sub="paid to the network, not GlobePay" />;

    const fiat = rate !== null ? feeEth * rate : null;
    // Sub-cent fees are the norm on testnet — say so rather than print "£0.00".
    const fiatText = fiat === null ? null : fiat < 0.01 ? `under ${fmtMoney(0.01, ccy)}` : fmtMoney(fiat, ccy);
    const showingFiat = !showEth && fiatText !== null;

    return (
        <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1 flex items-center gap-1.5">
                Network fee
                {fiatText !== null && (
                    <button onClick={() => setShowEth(!showEth)}
                        className="text-[9px] normal-case tracking-normal text-[var(--text-dim)] hover:text-[var(--accent)] underline underline-offset-2 transition"
                        title={showingFiat ? "Show the exact amount of ETH charged" : `Show the value in ${ccy}`}>
                        {showingFiat ? "show ETH" : `show ${ccy}`}
                    </button>
                )}
            </div>
            <div className="font-mono text-sm text-[var(--text)]" title={showingFiat ? `Exactly ${fmtFeeEth(feeEth)}` : undefined}>
                {showingFiat ? fiatText : fmtFeeEth(feeEth)}
            </div>
            <div className="text-[10px] text-[var(--text-faint)] mt-0.5">paid to the network, not GlobePay</div>
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
                    const intended = r.intended_amount;
                    return (
                        <div key={r.wallet} className="flex items-center gap-3 px-5 py-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display font-semibold text-[11px] text-[var(--accent-ink)]" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>{initials}</div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{display}{r.country && <Flag country={r.country} className="ml-1.5" />}</div>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] text-[var(--text-faint)]">{truncate(r.wallet)}</span>
                                    <CopyButton value={r.wallet} title={`Copy ${display}'s wallet address`} size={11} />
                                </div>
                            </div>
                            <div className="font-mono text-sm font-semibold text-[var(--accent)] shrink-0"
                                title={intended != null ? TESTNET_NOTE : undefined}>
                                {intended != null ? fmtMoney(intended, "USD") : `+ ${fmtUsdc(r.amount)} ${p.token_symbol}`}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 px-5 py-4 border-t border-[var(--border)]">
                <Fact label="Sent on" value={`${date}, ${time}`} />
                <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">Status</div>
                    <a href={`https://sepolia.basescan.org/tx/${p.tx_hash}`} target="_blank" rel="noreferrer"
                        className="font-mono text-sm text-[var(--accent)] inline-flex items-center gap-1 hover:underline underline-offset-2"
                        title="View this transaction on Basescan">
                        Confirmed on Base <ExternalLink size={11} />
                    </a>
                    <div className="text-[10px] text-[var(--text-faint)] mt-0.5">permanently recorded</div>
                </div>
                <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] mb-1">From</div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm text-[var(--text)]">{truncate(p.from_address)}</span>
                        <CopyButton value={p.from_address} title="Copy the company wallet address" size={12} />
                    </div>
                    <div className="text-[10px] text-[var(--text-faint)] mt-0.5">the company wallet</div>
                </div>
                <NetworkFee feeEth={p.fee_eth} country={p.client_country} />
            </div>

            <div className="flex items-center gap-2 px-5 py-3.5 border-t border-[var(--border)] min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)] shrink-0">Receipt ID</span>
                <span className="font-mono text-[11px] text-[var(--text-dim)] truncate">{truncate(p.tx_hash)}</span>
                <CopyButton value={p.tx_hash} title="Copy full receipt ID" size={13} />
            </div>
        </div>
    );
}

function CopyButton({ value, title, size = 12 }: { value: string; title: string; size?: number }) {
    const [copied, setCopied] = useState(false);
    function copy(e: React.MouseEvent) {
        e.stopPropagation();   // rows are clickable; copying must not toggle them
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    }
    return (
        <button onClick={copy} title={title}
            className="text-[var(--text-faint)] hover:text-[var(--text)] transition shrink-0">
            {copied ? <Check size={size} className="text-[var(--accent)]" /> : <Copy size={size} />}
        </button>
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
                    Every payment here is rebuilt from the blockchain itself — the transaction, its timestamp and its
                    recipients all come from the chain, not from anything typed in.
                    <span className="text-[var(--text-dim)]"> &ldquo;Confirmed&rdquo;</span> means the network has permanently
                    recorded it: it can&rsquo;t be edited, reversed, or deleted, and the Receipt ID lets anyone verify it
                    independently. Amounts are shown in USD from the payroll run behind each payment; on this testnet the
                    chain itself moves a flat 1 USDC per person, and in production that USD figure is what gets sent.
                </div>
            </div>
        </div>
    );
}

/**
 * Who was in this payment run, as overlapping avatars.
 *
 * Every row used to open with the same send icon, which meant the list read as
 * one repeated shape and told you nothing until you expanded a row. The people
 * are the thing that differs between runs, so they belong in the row: different
 * names give different initials and different gradients, and the count is
 * legible without opening anything.
 */
function RecipientStack({ recipients }: { recipients: SavedPayment["recipients"] }) {
    const shown = recipients.slice(0, 3);
    const extra = recipients.length - shown.length;

    return (
        <div className="flex shrink-0 items-center">
            {shown.map((r, i) => {
                const name = r.name ?? "Unknown wallet";
                const initials = r.name
                    ? r.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                    : "0x";
                const [g1, g2] = avatarFor(name);
                return (
                    <span
                        key={r.wallet}
                        title={name}
                        // Overlapped, and ringed in the page colour so the edges
                        // stay legible where they cross.
                        className="grid h-9 w-9 place-items-center rounded-full font-display text-[11px] font-semibold text-[var(--accent-ink)] ring-2 ring-[var(--surface)]"
                        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})`, marginLeft: i ? -10 : 0 }}
                    >
                        {initials}
                    </span>
                );
            })}
            {extra > 0 && (
                <span
                    title={`${extra} more`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] font-mono text-[11px] text-[var(--text-dim)] ring-2 ring-[var(--surface)]"
                    style={{ marginLeft: -10 }}
                >
                    +{extra}
                </span>
            )}
        </div>
    );
}
