"use client";
// Ask a question about payment history in plain English.
//
// The model only parses the question into a filter; every number in every answer
// is computed server-side from the records. That's why each answer carries a
// footer saying exactly what was counted — in a stakeholder meeting, a figure
// you can't trace is worse than no figure.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Loader2, Sparkles, AlertCircle, ChevronRight, ArrowUpRight } from "lucide-react";

type Evidence = {
    name: string; country: string | null; amount: number;
    date: string; invoice: string | null; tx: string | null;
};

type Turn = {
    q: string;
    at: number;          // asked
    answeredAt?: number; // replied — a question and its answer can be minutes apart
    a?: string;
    scope?: string;
    error?: string;
    evidence?: Evidence[];
    truncated?: boolean;
};

// Rotated while waiting. One unchanging string makes a slow reply feel stuck;
// text that moves reads as work happening. Each line also says something true
// about the step it's on, rather than being noise for its own sake.
const WORKING = [
    "Reading your question…",
    "Finding the payments…",
    "Adding them up…",
    "Checking the figures…",
];

const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Evidence({ rows, truncated, scope, paymentsHref }: {
    rows: Evidence[]; truncated: boolean; scope?: string; paymentsHref: string;
}) {
    // Collapsed by default: the answer is the point, the working is the backup.
    // Small result sets open straight away, because hiding three rows is silly.
    const [open, setOpen] = useState(rows.length <= 5);

    // Deep link carrying the transactions this answer was built from. The
    // payments page lifts them to the top and marks them, so the row someone
    // clicked is the row they land on rather than one they have to hunt for.
    const txs = [...new Set(rows.map((r) => r.tx).filter(Boolean))] as string[];
    const linkTo = (tx?: string | null) =>
        `${paymentsHref}?highlight=${encodeURIComponent(tx ? tx : txs.join(","))}`;

    return (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
                <button onClick={() => setOpen(!open)}
                    className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text)] transition">
                    <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                    {open ? "Hide" : "Show"} {rows.length} payment{rows.length === 1 ? "" : "s"}
                </button>
                {txs.length > 0 && (
                    <Link href={linkTo()}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline underline-offset-2">
                        See {txs.length > 1 ? "all" : "it"} in payments <ArrowUpRight size={11} />
                    </Link>
                )}
            </div>
            {scope && <div className="mt-1 text-[10px] text-[var(--text-faint)]">{scope}</div>}

            {open && (
                <div className="mt-2 overflow-hidden rounded-lg border border-[var(--border)]">
                    {rows.map((r, i) => (
                        <Link key={i} href={linkTo(r.tx)}
                            title="Open this payment"
                            className="flex items-baseline gap-2 px-2.5 py-1.5 border-b border-[var(--border)] last:border-0 bg-[var(--surface)] hover:bg-[var(--surface-2)] transition group">
                            <span className="font-mono text-[11px] text-[var(--text-faint)] shrink-0 w-[74px]">{r.date}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[12px] truncate group-hover:text-[var(--accent)] transition">{r.name}</span>
                                <span className="block text-[10px] text-[var(--text-faint)] truncate">
                                    {r.country ?? "—"}{r.invoice ? ` · ${r.invoice}` : ""}
                                </span>
                            </span>
                            <span className="font-mono text-[12px] shrink-0 tabular-nums">
                                ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <ArrowUpRight size={11} className="shrink-0 text-[var(--text-faint)] group-hover:text-[var(--accent)] transition" />
                        </Link>
                    ))}
                    {truncated && (
                        <div className="px-2.5 py-1.5 text-[10px] text-[var(--text-faint)] bg-[var(--surface)]">
                            Showing the 50 most recent — open the audit pack for the full list.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Starter questions come from the server, built from this client's own payments,
// so nothing offered here can answer "no payments" — see /api/ask/suggestions.

export default function AskBot({ clientId, height = "min(66vh, 620px)", bare = false }: {
    clientId?: string;
    /** Shorter inside the floating widget than on the full page. */
    height?: string;
    /** Drop the card chrome when the widget already provides it. */
    bare?: boolean;
}) {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState(false);
    const [suggestions, setSuggestions] = useState<string[] | null>(null);
    const [workingIdx, setWorkingIdx] = useState(0);
    const endRef = useRef<HTMLDivElement>(null);

    // Which console we're in decides where "see it in payments" goes. Read from
    // the path rather than passed in, so the floating widget works on any page.
    const pathname = usePathname();
    const paymentsHref = pathname?.startsWith("/admin") ? "/admin/payments" : "/portal/payments";

    // Step the waiting message on while a request is in flight. The reset back
    // to the first line happens where the request starts, not here — resetting
    // in the effect body would be a synchronous setState on every toggle.
    useEffect(() => {
        if (!busy) return;
        const t = setInterval(() => setWorkingIdx((i) => (i + 1) % WORKING.length), 1400);
        return () => clearInterval(t);
    }, [busy]);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

    useEffect(() => {
        let live = true;
        fetch("/api/ask/suggestions")
            .then((r) => r.json())
            .then((j) => { if (live) setSuggestions(j.suggestions ?? []); })
            .catch(() => { if (live) setSuggestions([]); });
        return () => { live = false; };
    }, []);

    async function ask(question: string) {
        const text = question.trim();
        if (!text || busy) return;
        setQ("");
        setTurns((t) => [...t, { q: text, at: Date.now() }]);
        setWorkingIdx(0);
        setBusy(true);
        try {
            const r = await fetch("/api/ask", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: text, clientId }),
            });
            const j = await r.json();
            setTurns((t) => {
                const next = [...t];
                const last = next[next.length - 1];
                last.answeredAt = Date.now();
                if (!r.ok) last.error = j?.error || "Couldn't answer that";
                else {
                    last.a = j.answer;
                    // What the filter actually matched, so the number is traceable.
                    last.scope = `${j.rows} record${j.rows === 1 ? "" : "s"} · ${j.period}`;
                    last.evidence = j.evidence ?? [];
                    last.truncated = !!j.truncated;
                }
                return next;
            });
        } catch {
            setTurns((t) => {
                const next = [...t];
                next[next.length - 1].error = "Network error";
                next[next.length - 1].answeredAt = Date.now();
                return next;
            });
        } finally { setBusy(false); }
    }

    return (
        <div className={`flex flex-col overflow-hidden ${bare ? "" : "card"}`} style={{ height }}>
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                {turns.length === 0 && (
                    <div className="h-full grid place-items-center text-center px-6">
                        <div>
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-3">
                                <Sparkles size={20} />
                            </div>
                            <div className="text-[15px] font-medium">Ask about your payments</div>
                            <p className="text-[13px] text-[var(--text-dim)] mt-1.5 max-w-sm mx-auto">
                                {suggestions?.length === 0
                                    ? "Once you've made a payment, you can ask about totals by period, country or contractor here."
                                    : "Totals by period, country or contractor — answered from your own payment records."}
                            </p>
                            {/* Built from this client's own history, so every one of
                                these returns a real answer rather than "no payments". */}
                            {suggestions && suggestions.length > 0 && (
                                <div className="mt-5 flex flex-wrap justify-center gap-2">
                                    {suggestions.map((s) => (
                                        <button key={s} onClick={() => ask(s)}
                                            className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent-line)] transition">
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {turns.map((t, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex flex-col items-end">
                            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2.5 text-[13px]">
                                {t.q}
                            </div>
                            <span className="mt-1 text-[10px] text-[var(--text-faint)]">{clock(t.at)}</span>
                        </div>

                        {t.error ? (
                            <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] text-[var(--danger)] max-w-[85%]">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {t.error}
                            </div>
                        ) : t.a ? (
                            <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-[var(--surface-2)] border border-[var(--border)] px-3.5 py-3">
                                <div className="text-[14px] whitespace-pre-wrap leading-relaxed">{t.a}</div>

                                {/* The payments the figure was computed from. A total
                                    nobody can open is a total that gets challenged. */}
                                {t.evidence && t.evidence.length > 0 && (
                                    <Evidence rows={t.evidence} truncated={!!t.truncated} scope={t.scope} paymentsHref={paymentsHref} />
                                )}

                                {t.scope && !t.evidence?.length && (
                                    <div className="mt-2 pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-faint)]">
                                        {t.scope}
                                    </div>
                                )}
                                {t.answeredAt && (
                                    <div className="mt-2 text-[10px] text-[var(--text-faint)]">{clock(t.answeredAt)}</div>
                                )}
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
                                <Loader2 size={13} className="animate-spin" /> {WORKING[workingIdx]}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <div className="border-t border-[var(--border)] p-3 flex items-end gap-2">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") ask(q); }}
                    placeholder="How much did we send to Nigeria last year?"
                    aria-label="Ask a question about your payments"
                    className="flex-1 px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                />
                <button onClick={() => ask(q)} disabled={busy || !q.trim()} aria-label="Ask"
                    className="btn-primary shrink-0 h-9 w-9 !p-0 justify-center disabled:opacity-40">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
            </div>
        </div>
    );
}
