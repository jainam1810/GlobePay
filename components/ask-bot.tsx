"use client";
// Ask a question about payment history in plain English.
//
// The model only parses the question into a filter; every number in every answer
// is computed server-side from the records. That's why each answer carries a
// footer saying exactly what was counted — in a stakeholder meeting, a figure
// you can't trace is worse than no figure.
import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Sparkles, AlertCircle } from "lucide-react";

type Turn = {
    q: string;
    a?: string;
    scope?: string;
    error?: string;
};

const SUGGESTIONS = [
    "How much did we pay last quarter?",
    "How much went to Argentina this year?",
    "Payments per country last year",
    "How many payments did we make last month?",
];

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
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

    async function ask(question: string) {
        const text = question.trim();
        if (!text || busy) return;
        setQ("");
        setTurns((t) => [...t, { q: text }]);
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
                if (!r.ok) last.error = j?.error || "Couldn't answer that";
                else {
                    last.a = j.answer;
                    // What the filter actually matched, so the number is traceable.
                    last.scope = `${j.rows} record${j.rows === 1 ? "" : "s"} · ${j.period}`;
                }
                return next;
            });
        } catch {
            setTurns((t) => {
                const next = [...t];
                next[next.length - 1].error = "Network error";
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
                                Totals by period, country or contractor — answered from your own payment records.
                            </p>
                            <div className="mt-5 flex flex-wrap justify-center gap-2">
                                {SUGGESTIONS.map((s) => (
                                    <button key={s} onClick={() => ask(s)}
                                        className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent-line)] transition">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {turns.map((t, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-end">
                            <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--accent)] text-[var(--accent-ink)] px-3.5 py-2.5 text-[13px]">
                                {t.q}
                            </div>
                        </div>

                        {t.error ? (
                            <div className="flex items-start gap-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-[12px] text-[var(--danger)] max-w-[85%]">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {t.error}
                            </div>
                        ) : t.a ? (
                            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--surface-2)] border border-[var(--border)] px-3.5 py-3">
                                <div className="text-[13px] whitespace-pre-wrap leading-relaxed">{t.a}</div>
                                {t.scope && (
                                    <div className="mt-2 pt-2 border-t border-[var(--border)] font-mono text-[10px] text-[var(--text-faint)]">
                                        {t.scope}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
                                <Loader2 size={13} className="animate-spin" /> Working it out…
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
