"use client";
// Ask a question about payment history in plain English.
//
// The model reads the question, decides what to look up, and writes the reply;
// every number in every answer is computed server-side from the records. That's
// why each answer carries a footer saying exactly what was counted — in a
// stakeholder meeting, a figure you can't trace is worse than no figure.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Sparkles, AlertCircle, Check, ChevronRight, ArrowUpRight, FileText, History, Plus, Trash2 } from "lucide-react";
import {
    listConversations, saveConversation, deleteConversation, clearConversations,
    titleFrom, dayLabel, RETENTION_HOURS, type Conversation,
} from "@/lib/ask-history";
import Confirm from "@/components/confirm";

type Evidence = {
    name: string; country: string | null; amount: number;
    date: string; invoice: string | null; tx: string | null;
};

/** A figure exactly as the server computed it — never re-derived on the client. */
type Figure = {
    label?: string;
    total: number;
    payments: number;
    contractors?: number;
    average?: number;
    breakdown?: { key: string; total: number; payments: number }[];
};

type Turn = {
    q: string;
    at: number;          // asked
    answeredAt?: number; // replied — a question and its answer can be minutes apart
    a?: string;
    scope?: string;
    error?: string;
    evidence?: Evidence[];
    figures?: Figure[];
    truncated?: boolean;
};

// Rotated while waiting. One unchanging string makes a slow reply feel stuck;
// text that moves reads as work happening. Each line also says something true
// about the step it's on, rather than being noise for its own sake.
const clock = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

/**
 * The computed figures, drawn from the numbers rather than read out of the prose.
 *
 * Two cases earn the space. A message containing several questions gets one tile
 * per answer, so the figures sit side by side instead of buried in a paragraph —
 * that was the complaint. A breakdown gets bars, because ranking four countries
 * by eye down a bullet list is work the chart should be doing.
 */
function Figures({ figures }: { figures: Figure[] }) {
    const bars = figures.find((f) => f.breakdown && f.breakdown.length > 1);
    const tiles = figures.length > 1 ? figures : [];
    if (!tiles.length && !bars) return null;

    // One hue, length carries the magnitude. Scaled to the largest bar, not to
    // the total, so small values stay visible.
    const max = bars ? Math.max(...bars.breakdown!.map((b) => b.total)) : 0;

    return (
        <div className="mt-3 space-y-3">
            {tiles.length > 0 && (
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, minmax(0,1fr))` }}>
                    {tiles.map((f, i) => (
                        <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] truncate" title={f.label}>
                                {f.label || "Total"}
                            </div>
                            <div className="text-[15px] font-medium tabular-nums mt-0.5">{usd(f.total)}</div>
                            <div className="text-[10px] text-[var(--text-faint)]">
                                {f.payments} payment{f.payments === 1 ? "" : "s"}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {bars && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] mb-2">
                        {bars.label || "Breakdown"}
                    </div>
                    <div className="space-y-1.5">
                        {bars.breakdown!.map((b) => (
                            <div key={b.key} className="grid grid-cols-[minmax(60px,88px)_1fr_auto] items-center gap-2">
                                <span className="text-[11px] text-[var(--text-dim)] truncate" title={b.key}>{b.key}</span>
                                <span className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                                    <span className="block h-full rounded-full bg-[var(--accent)]"
                                        style={{ width: `${max ? Math.max((b.total / max) * 100, 2) : 0}%` }} />
                                </span>
                                <span className="text-[11px] tabular-nums text-[var(--text)]">{usd(b.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * What the assistant is doing, while it does it.
 *
 * These lines are streamed from the agent as each tool call fires, so they are
 * a record of real work rather than captions on a timer. That distinction is
 * the whole point: a rotating "Adding them up…" that plays whether or not
 * anything is being added is theatre, and people learn to distrust it. Watching
 * it decide to check which countries exist, then add up two different
 * questions, is the part that reads as intelligence.
 *
 * Completed steps stay visible and dim; the current one keeps the pulse.
 */
function Thinking({ steps }: { steps: string[] }) {
    return (
        <div className="flex items-start gap-2.5">
            <span className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles size={12} />
                <span className="absolute inset-0 animate-ping rounded-lg bg-[var(--accent)] opacity-15" />
            </span>
            <div className="min-w-0 space-y-1 pt-0.5">
                {(steps.length ? steps : ["Reading your question"]).map((s, i, all) => {
                    const current = i === all.length - 1;
                    return (
                        <div
                            key={`${s}-${i}`}
                            className={`flex items-center gap-2 text-[12px] transition-colors ${current ? "text-[var(--text-dim)]" : "text-[var(--text-faint)]"}`}
                        >
                            {current
                                ? <Loader2 size={11} className="shrink-0 animate-spin text-[var(--accent)]" />
                                : <Check size={11} className="shrink-0 text-[var(--ok)]" />}
                            <span className="truncate">{s}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** The model writes prose with the occasional list; render it rather than
 *  showing people raw asterisks. Headings are stripped — this is a chat bubble. */
function Answer({ text }: { text: string }) {
    return (
        <div className="text-[14px] leading-relaxed space-y-2 [&_ul]:space-y-1 [&_ul]:my-1 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-medium [&_code]:text-[12px]">
            <ReactMarkdown
                components={{
                    // A chat reply has no document structure to carry.
                    h1: ({ children }) => <p className="font-medium">{children}</p>,
                    h2: ({ children }) => <p className="font-medium">{children}</p>,
                    h3: ({ children }) => <p className="font-medium">{children}</p>,
                    a: ({ children }) => <span>{children}</span>,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}

function Evidence({ rows, truncated, scope, paymentsHref }: {
    rows: Evidence[]; truncated: boolean; scope?: string; paymentsHref: string;
}) {
    // Collapsed by default: the answer is the point, the working is the backup.
    // Small result sets open straight away, because hiding three rows is silly.
    const [open, setOpen] = useState(rows.length <= 5);

    // Deep link carrying the transactions this answer was built from. The
    // payments page lifts them to the top and marks them, so the row someone
    // clicked is the row they land on rather than one they have to hunt for.
    //
    // The payments page can only highlight by transaction hash, so a record
    // without one has nothing to land on: it was saved as an invoice but never
    // settled through a payroll run. Those rows are not links.
    //
    // The old code fell back to `txs.join(",")` for such a row, which was wrong
    // twice over — it highlighted *every other* payment in the answer, and when
    // the row was the only one, it produced `?highlight=` and silently did
    // nothing. Nothing is exactly what the user saw.
    const txs = [...new Set(rows.map((r) => r.tx).filter(Boolean))] as string[];
    const linkTo = (tx?: string | null) =>
        `${paymentsHref}?highlight=${encodeURIComponent(tx || txs.join(","))}`;

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
                    {rows.map((r, i) => {
                        const cell = (
                            <>
                                <span className="font-mono text-[11px] text-[var(--text-faint)] shrink-0 w-[74px]">{r.date}</span>
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-[12px] truncate transition ${r.tx ? "group-hover:text-[var(--accent)]" : ""}`}>{r.name}</span>
                                    <span className="block text-[10px] text-[var(--text-faint)] truncate">
                                        {r.tx
                                            ? <>{r.country ?? "—"}{r.invoice ? ` · ${r.invoice}` : ""}</>
                                            // Says why it doesn't open, rather than
                                            // looking clickable and doing nothing.
                                            : <>{r.country ?? "—"} · invoice only, no payment recorded</>}
                                    </span>
                                </span>
                                <span className="font-mono text-[12px] shrink-0 tabular-nums">
                                    ${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {r.tx
                                    ? <ArrowUpRight size={11} className="shrink-0 text-[var(--text-faint)] group-hover:text-[var(--accent)] transition" />
                                    : <FileText size={11} className="shrink-0 text-[var(--text-faint)]" />}
                            </>
                        );

                        const shell = "flex items-baseline gap-2 px-2.5 py-1.5 border-b border-[var(--border)] last:border-0 bg-[var(--surface)] transition group";

                        return r.tx ? (
                            <Link key={i} href={linkTo(r.tx)} title="Open this payment"
                                className={`${shell} hover:bg-[var(--surface-2)]`}>
                                {cell}
                            </Link>
                        ) : (
                            <div key={i} title="This invoice has no on-chain payment to open"
                                className={shell}>
                                {cell}
                            </div>
                        );
                    })}
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
//
// Fetched once per page and kept here, outside the component, for two reasons.
// The panel only mounts when it is opened, so without a cache the request began
// at the moment the user was looking at the empty state and the chips landed
// half a second later, shoving the copy upward. And reopening it re-ran the
// same request for the same four strings. AskWidget primes this on mount, so by
// the time anyone clicks the answer is usually already here.
const SUGGESTION_COUNT = 4;
let suggestionCache: string[] | null = null;
let suggestionInflight: Promise<string[]> | null = null;

export function fetchSuggestions(): Promise<string[]> {
    if (suggestionCache) return Promise.resolve(suggestionCache);
    suggestionInflight ??= fetch("/api/ask/suggestions")
        .then((r) => r.json())
        .then((j) => (suggestionCache = j.suggestions ?? []))
        // Let a failure be retried on the next open rather than caching "none".
        .catch(() => { suggestionInflight = null; return []; });
    return suggestionInflight;
}

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
    // Starts from the cache when there is one, so a reopen shows the chips in
    // the first frame instead of replaying the skeleton.
    const [suggestions, setSuggestions] = useState<string[] | null>(suggestionCache);
    // The agent's real steps, streamed as it works.
    const [steps, setSteps] = useState<string[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<Conversation[]>([]);
    // Deleting one conversation is cheap to redo; deleting all of them isn't,
    // and the button sits next to "Back".
    const [askClear, setAskClear] = useState(false);
    const convId = useRef<string>("");
    const endRef = useRef<HTMLDivElement>(null);

    // Which console we're in decides where "see it in payments" goes. Read from
    // the path rather than passed in, so the floating widget works on any page.
    const pathname = usePathname();
    const paymentsHref = pathname?.startsWith("/admin") ? "/admin/payments" : "/portal/payments";

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

    // Persist after every completed exchange, not on a timer — a conversation
    // is worth keeping once it has an answer in it, and not before.
    useEffect(() => {
        if (turns.length === 0) return;
        const last = turns[turns.length - 1];
        if (!last.a && !last.error) return;   // still in flight
        let live = true;
        saveConversation({
            id: convId.current || undefined,
            title: titleFrom(turns),
            turns,
        }).then((saved) => {
            // Keep the server's id so the next exchange updates this row rather
            // than starting a second conversation.
            if (live && saved?.id) convId.current = saved.id;
        });
        return () => { live = false; };
    }, [turns]);

    async function openHistory() {
        setShowHistory(true);
        setHistory(await listConversations());
    }

    function newChat() {
        convId.current = "";
        setTurns([]);
        setShowHistory(false);
    }

    function resume(c: Conversation) {
        convId.current = c.id;
        setTurns(c.turns as Turn[]);
        setShowHistory(false);
    }

    useEffect(() => {
        let live = true;
        fetchSuggestions().then((s) => { if (live) setSuggestions(s); });
        return () => { live = false; };
    }, []);

    async function ask(question: string) {
        const text = question.trim();
        if (!text || busy) return;
        setQ("");
        setTurns((t) => [...t, { q: text, at: Date.now() }]);
        setSteps([]);
        setBusy(true);
        try {
            const r = await fetch("/api/ask", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: text, clientId,
                    // Prior turns, so "…and Argentina only?" knows what "and"
                    // refers to. Trimmed server-side.
                    history: turns.filter((t) => t.a).map((t) => ({ q: t.q, a: t.a })),
                }),
            });

            // The route streams newline-delimited JSON: a `step` per tool call
            // as it happens, then one `done`. Reading it as it arrives is what
            // lets the UI narrate the real work instead of guessing at it.
            let j: Record<string, unknown> = {};
            if (r.body && r.headers.get("content-type")?.includes("ndjson")) {
                const reader = r.body.getReader();
                const dec = new TextDecoder();
                let buf = "";
                for (; ;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += dec.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() ?? "";
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        const ev = JSON.parse(line);
                        if (ev.type === "step") setSteps((s) => [...s, ev.text]);
                        else if (ev.type === "error") j = { error: ev.error };
                        else if (ev.type === "done") j = ev;
                    }
                }
            } else {
                j = await r.json();
            }

            const ok = r.ok && !j.error;
            setTurns((t) => {
                const next = [...t];
                const last = next[next.length - 1];
                last.answeredAt = Date.now();
                if (!ok) last.error = (j.error as string) || "Couldn't answer that";
                else {
                    last.a = j.answer as string;
                    // What it actually queried, so a surprising answer can be
                    // traced to the question behind it rather than argued with.
                    const labels = ((j.calls ?? []) as { name: string; label?: string }[])
                        .filter((c) => c.name === "query_payments")
                        .map((c) => c.label).filter(Boolean);
                    last.scope = [
                        `${j.rows} record${j.rows === 1 ? "" : "s"}`,
                        labels.length ? labels.join(" · ") : null,
                    ].filter(Boolean).join(" · ");
                    last.evidence = (j.evidence ?? []) as Evidence[];
                    last.figures = (j.figures ?? []) as Figure[];
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

    if (showHistory) {
        return (
            <div className={`flex flex-col overflow-hidden ${bare ? "" : "card"}`} style={{ height }}>
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0">
                    <div className="text-[13px] font-medium">Past conversations</div>
                    <div className="flex items-center gap-2">
                        {history.length > 0 && (
                            <button
                                onClick={() => setAskClear(true)}
                                className="text-[11px] text-[var(--text-dim)] hover:text-[var(--danger)] transition">
                                Delete all
                            </button>
                        )}
                        <button onClick={() => setShowHistory(false)}
                            className="text-[11px] text-[var(--accent)] hover:underline underline-offset-2">
                            Back
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                    {history.length === 0 ? (
                        <div className="h-full grid place-items-center text-center px-6">
                            <div>
                                <div className="text-[13px] font-medium">Nothing saved yet</div>
                                <p className="text-[12px] text-[var(--text-dim)] mt-1.5 max-w-xs">
                                    Conversations are kept on this browser once they have an answer in them.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {history.map((c) => (
                                <div key={c.id}
                                    className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 hover:border-[var(--accent-line)] transition">
                                    <button onClick={() => resume(c)} className="min-w-0 flex-1 text-left">
                                        <div className="text-[12px] truncate">{c.title}</div>
                                        <div className="text-[10px] text-[var(--text-faint)]">
                                            {dayLabel(c.updated_at)} · {c.turns.length} question{c.turns.length === 1 ? "" : "s"}
                                        </div>
                                    </button>
                                    <button
                                        onClick={async () => { await deleteConversation(c.id); setHistory(await listConversations()); }}
                                        aria-label={`Delete "${c.title}"`}
                                        className="shrink-0 text-[var(--text-faint)] hover:text-[var(--danger)] transition">
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-[var(--border)] p-3 shrink-0">
                    <p className="text-[10px] text-[var(--text-faint)] leading-relaxed">
                        Saved to your account, so they follow you to any device you sign in on, and cleared after{" "}
                        {RETENTION_HOURS} hours. Only you can see them. Every answer can be asked again — the durable
                        copy of your payments is the audit pack.
                    </p>
                </div>

                <Confirm
                    open={askClear}
                    onOpenChange={setAskClear}
                    title="Delete all conversations?"
                    confirmLabel="Delete all"
                    danger
                    body={<>All {history.length} saved conversation{history.length === 1 ? "" : "s"} on this device
                        will be removed. Your payments are untouched — only the questions go.</>}
                    onConfirm={() => { clearConversations(); setHistory([]); }}
                />
            </div>
        );
    }

    return (
        <div className={`flex flex-col overflow-hidden ${bare ? "" : "card"}`} style={{ height }}>
            {/* History and a fresh start. Kept to two small controls: this is a
                widget people dip into, not an app they live in. */}
            <div className="flex items-center justify-end gap-1 px-3 py-2 border-b border-[var(--border)] shrink-0">
                <button onClick={newChat} disabled={turns.length === 0}
                    title="Start a new conversation"
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition disabled:opacity-40">
                    <Plus size={12} /> New
                </button>
                <button onClick={openHistory} title="Past conversations"
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition">
                    <History size={12} /> History
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                {turns.length === 0 && (
                    <div className="h-full grid place-items-center text-center px-6">
                        <div>
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-3">
                                <Sparkles size={20} />
                            </div>
                            <div className="text-[15px] font-medium">Ask about your payments</div>
                            <p className="text-[13px] text-[var(--text-dim)] mt-1.5 max-w-sm mx-auto">
                                {/* Only the settled no-payments case gets its own
                                    line. While loading it keeps the ordinary copy,
                                    because swapping the sentence and then swapping
                                    it back is a flicker in the first thing read. */}
                                {suggestions?.length === 0
                                    ? "Once you've made a payment, you can ask about totals by period, country or contractor here."
                                    : "Totals by period, country or contractor — answered from your own payment records."}
                            </p>
                            {/* Built from this client's own history, so every one of
                                these returns a real answer rather than "no payments".
                                The skeletons hold the exact height and shape of the
                                real chips, so when they arrive nothing moves. */}
                            {suggestions === null ? (
                                <div className="mt-5 flex flex-wrap justify-center gap-2" aria-hidden>
                                    {[124, 148, 106, 132].slice(0, SUGGESTION_COUNT).map((w, i) => (
                                        <span
                                            key={i}
                                            style={{ width: w, animationDelay: `${i * 90}ms` }}
                                            className="h-[29px] animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
                                        />
                                    ))}
                                </div>
                            ) : suggestions.length > 0 && (
                                <div className="mt-5 flex flex-wrap justify-center gap-2">
                                    {suggestions.map((s) => (
                                        <button key={s} onClick={() => ask(s)}
                                            className="anim-pop text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent-line)] transition">
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
                                <Answer text={t.a} />

                                {/* Drawn from the computed figures, not parsed back
                                    out of the sentence above them. */}
                                {t.figures && t.figures.length > 0 && <Figures figures={t.figures} />}

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
                            <Thinking steps={steps} />
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
