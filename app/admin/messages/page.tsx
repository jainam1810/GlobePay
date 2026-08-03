"use client";
// The GlobePay inbox: every client conversation in one place, unanswered first.
import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ArrowLeft, MessagesSquare, Paperclip } from "lucide-react";
import Conversation from "@/components/conversation";
import Flag from "@/components/flag";

import type { ThreadSummary } from "@/lib/messages";

export default function AdminMessagesPage() {
    const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState<ThreadSummary | null>(null);

    function load() {
        fetch("/api/messages/threads")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setThreads(j.threads || []) : setError(j?.error || "Couldn't load the inbox"))
            .catch(() => setError("Network error"));
    }
    // Refresh the list periodically so unread counts don't go stale while the
    // page sits open; the open conversation polls on its own.
    useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

    if (open) {
        return (
            <div className="mx-auto max-w-3xl">
                <button onClick={() => { setOpen(null); load(); }}
                    className="fade-up inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">
                    <ArrowLeft size={13} /> All conversations
                </button>
                <div className="fade-up delay-1 mt-4">
                    <Conversation
                        me="globepay"
                        clientId={open.client_id}
                        title={open.company_name}
                        subtitle={open.home_country}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Messages</div>
                <h1 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mt-2">Inbox</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    Every client conversation, with anything unanswered at the top.
                </p>
            </div>

            {error && (
                <div className="fade-up rounded-[var(--radius)] border border-[var(--danger-line)] bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {threads === null && !error && (
                <div className="fade-up card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading…
                </div>
            )}

            {threads?.length === 0 && (
                <div className="fade-up card p-12 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-4">
                        <MessagesSquare size={20} />
                    </div>
                    <div className="text-xl font-medium tracking-[-0.02em]">No clients yet</div>
                    <p className="text-[var(--text-dim)] text-sm mt-2">Add a client and you can start a conversation with them here.</p>
                </div>
            )}

            {threads && threads.length > 0 && (
                <div className="fade-up card overflow-hidden divide-y divide-[var(--border)]">
                    {threads.map((t) => (
                        <button key={t.client_id} onClick={() => setOpen(t)}
                            className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] transition-colors">
                            <Flag country={t.home_country} size={20} className="shrink-0" />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[14px] truncate ${t.unread ? "font-semibold" : "font-medium"}`}>{t.company_name}</span>
                                    {t.has_attachment && <Paperclip size={12} className="shrink-0 text-[var(--text-faint)]" />}
                                </div>
                                <div className={`text-[12px] truncate mt-0.5 ${t.unread ? "text-[var(--text)]" : "text-[var(--text-faint)]"}`}>
                                    {t.last_body
                                        ? `${t.last_sender === "globepay" ? "You: " : ""}${t.last_body}`
                                        : "No messages yet"}
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                {t.last_at && (
                                    <div className="text-[11px] text-[var(--text-faint)]">
                                        {new Date(t.last_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    </div>
                                )}
                                {t.unread > 0 && (
                                    <span className="mt-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold text-[var(--accent-ink)]">
                                        {t.unread}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
