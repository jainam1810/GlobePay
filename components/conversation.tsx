"use client";
// One conversation between a client company and GlobePay. Same component both
// sides; `me` decides which bubbles sit right.
//
// Polls rather than subscribes: this is a low-traffic support thread, not a chat
// app, and a 10s poll costs nothing next to holding a realtime socket open on
// every page. The tradeoff is a few seconds of latency, which nobody notices in
// a conversation measured in hours.
import { useEffect, useRef, useState } from "react";
import {
    Paperclip, Send, Loader2, AlertCircle, Download, FileText, X, MessagesSquare,
} from "lucide-react";
import { prettyBytes, MAX_ATTACHMENT_BYTES, ALLOWED_TYPES, type Message, type MessageSender } from "@/lib/messages";

export default function Conversation({ me, clientId, title, subtitle }: {
    me: MessageSender;
    clientId?: string;          // admins pass one; clients are scoped by session
    title?: string;
    subtitle?: string;
}) {
    const [messages, setMessages] = useState<Message[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [body, setBody] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [sending, setSending] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const firstLoad = useRef(true);

    const qs = clientId ? `?client_id=${clientId}` : "";

    useEffect(() => {
        let live = true;
        const load = () => {
            fetch(`/api/messages${qs}`)
                .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
                .then(({ ok, j }) => {
                    if (!live) return;
                    if (ok) setMessages(j.messages || []);
                    else setError(j?.error || "Couldn't load this conversation");
                })
                .catch(() => { if (live) setError("Network error"); });
        };
        load();
        const t = setInterval(load, 10000);
        return () => { live = false; clearInterval(t); };
    }, [qs]);

    // Jump to the bottom on open; afterwards only follow if the reader is
    // already near it, so a poll can't yank them away from something they're
    // reading further up.
    useEffect(() => {
        if (!messages) return;
        const el = endRef.current;
        if (!el) return;
        if (firstLoad.current) {
            el.scrollIntoView();
            firstLoad.current = false;
        } else {
            const box = el.parentElement;
            if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 200) {
                el.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [messages]);

    function pick(f: File | null) {
        setError(null);
        if (!f) return setFile(null);
        if (!ALLOWED_TYPES.includes(f.type)) {
            setError(`We can't accept ${f.type || "that file type"}. Send a PDF, image, CSV or spreadsheet.`);
            return;
        }
        if (f.size > MAX_ATTACHMENT_BYTES) {
            setError("That file is over 10 MB — send a smaller one.");
            return;
        }
        setFile(f);
    }

    async function send() {
        if (sending || (!body.trim() && !file)) return;
        setSending(true); setError(null);
        try {
            let filePayload: { name: string; type: string; dataUrl: string } | undefined;
            if (file) {
                const dataUrl: string = await new Promise((res, rej) => {
                    const fr = new FileReader();
                    fr.onload = () => res(String(fr.result));
                    fr.onerror = () => rej(new Error("Couldn't read that file"));
                    fr.readAsDataURL(file);
                });
                filePayload = { name: file.name, type: file.type, dataUrl };
            }
            const r = await fetch("/api/messages", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId, body: body.trim(), file: filePayload }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Couldn't send that");
            setBody(""); setFile(null);
            setMessages((prev) => [...(prev ?? []), j.message as Message]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't send that");
        } finally { setSending(false); }
    }

    return (
        <div className="card flex flex-col overflow-hidden" style={{ height: "min(72vh, 720px)" }}>
            {(title || subtitle) && (
                <div className="px-5 py-3.5 border-b border-[var(--border)]">
                    {title && <div className="text-[15px] font-medium">{title}</div>}
                    {subtitle && <div className="text-[12px] text-[var(--text-faint)] mt-0.5">{subtitle}</div>}
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
                {messages === null && !error && (
                    <div className="h-full grid place-items-center text-sm text-[var(--text-dim)]">
                        <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading…</span>
                    </div>
                )}

                {messages?.length === 0 && (
                    <div className="h-full grid place-items-center text-center px-6">
                        <div>
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-3">
                                <MessagesSquare size={20} />
                            </div>
                            <div className="text-[15px] font-medium">No messages yet</div>
                            <p className="text-[13px] text-[var(--text-dim)] mt-1.5 max-w-xs mx-auto">
                                {me === "client"
                                    ? "Send an invoice or ask a question — it goes straight to the GlobePay team."
                                    : "Nothing from this client yet. You can start the conversation."}
                            </p>
                        </div>
                    </div>
                )}

                {messages?.map((m, i) => (
                    <Bubble key={m.id} m={m} mine={m.sender === me} showDay={i === 0 || !sameDay(messages[i - 1].created_at, m.created_at)} />
                ))}
                <div ref={endRef} />
            </div>

            {error && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {file && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-xs">
                    <FileText size={14} className="text-[var(--accent)] shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-[var(--text-faint)] shrink-0">{prettyBytes(file.size)}</span>
                    <button onClick={() => setFile(null)} aria-label="Remove attachment"
                        className="text-[var(--text-faint)] hover:text-[var(--text)] transition shrink-0"><X size={13} /></button>
                </div>
            )}

            <div className="border-t border-[var(--border)] p-3 flex items-end gap-2">
                <button onClick={() => fileRef.current?.click()} aria-label="Attach a file" disabled={sending}
                    className="shrink-0 grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent-line)] transition disabled:opacity-40">
                    <Paperclip size={15} />
                </button>
                <input ref={fileRef} type="file" className="hidden" accept={ALLOWED_TYPES.join(",")}
                    onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />

                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                        // Enter sends; Shift+Enter is a new line. Matches every
                        // messaging app anyone has used.
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    rows={1}
                    placeholder={me === "client" ? "Message GlobePay…" : "Reply to this client…"}
                    aria-label="Message"
                    className="flex-1 resize-none max-h-32 px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                />

                <button onClick={send} disabled={sending || (!body.trim() && !file)} aria-label="Send"
                    className="btn-primary shrink-0 h-9 w-9 !p-0 justify-center disabled:opacity-40">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
            </div>
        </div>
    );
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

function Bubble({ m, mine, showDay }: { m: Message; mine: boolean; showDay: boolean }) {
    const when = new Date(m.created_at);
    return (
        <>
            {showDay && (
                <div className="flex justify-center py-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] bg-[var(--surface-2)] rounded-full px-2.5 py-1">
                        {when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                </div>
            )}
            <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${mine
                    ? "bg-[var(--accent)] text-[var(--accent-ink)] rounded-br-sm"
                    : "bg-[var(--surface-2)] border border-[var(--border)] rounded-bl-sm"}`}>

                    {!mine && m.author_email && (
                        <div className="text-[10px] opacity-70 mb-1">{m.author_email}</div>
                    )}

                    {m.body && <div className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{m.body}</div>}

                    {m.attachment_path && (
                        <a
                            href={m.attachment_url ?? "#"}
                            target="_blank" rel="noreferrer"
                            className={`mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 transition ${mine
                                ? "bg-black/15 hover:bg-black/25"
                                : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-line)]"}`}
                        >
                            <FileText size={15} className="shrink-0" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-[12px] font-medium truncate">{m.attachment_name}</span>
                                {m.attachment_size !== null && (
                                    <span className="block text-[10px] opacity-70">{prettyBytes(m.attachment_size)}</span>
                                )}
                            </span>
                            <Download size={14} className="shrink-0 opacity-80" />
                        </a>
                    )}

                    <div className={`text-[10px] mt-1.5 ${mine ? "opacity-70 text-right" : "text-[var(--text-faint)]"}`}>
                        {when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        {mine && m.read_at && " · read"}
                    </div>
                </div>
            </div>
        </>
    );
}
