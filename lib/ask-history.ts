// Saved assistant conversations.
//
// Stored against the account, not the browser: the assistant is part of what a
// client is given, so their questions follow them to another device rather than
// living in one browser profile. See supabase/004-ask-conversations.sql.
//
// Scoped per *user* rather than per client — two people at the same company
// shouldn't read each other's questions, and a GlobePay admin has no client_id.

export type StoredTurn = {
    q: string;
    at: number;
    answeredAt?: number;
    a?: string;
    scope?: string;
    error?: string;
    evidence?: unknown[];
    truncated?: boolean;
};

export type Conversation = {
    id: string;
    updated_at: string;
    title: string;
    turns: StoredTurn[];
};

/**
 * How long a saved conversation survives.
 *
 * 24 hours. Nothing here is a record: every answer is recomputed from the ledger
 * on demand, so a lost question costs one re-ask, and keeping a month of
 * somebody's financial questions on file buys convenience nobody asked for. The
 * durable copy of the payments is the audit pack.
 *
 * Enforced server-side on access — a client-side timer would be advisory only.
 */
export const RETENTION_HOURS = 24;

export async function listConversations(): Promise<Conversation[]> {
    try {
        const r = await fetch("/api/ask/conversations");
        if (!r.ok) return [];
        return (await r.json()).conversations ?? [];
    } catch {
        return [];
    }
}

/** Upsert. Returns the server's id so a growing conversation updates in place. */
export async function saveConversation(c: { id?: string; title: string; turns: StoredTurn[] }) {
    try {
        const r = await fetch("/api/ask/conversations", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c),
        });
        if (!r.ok) return null;
        return (await r.json()).conversation as Conversation;
    } catch {
        // Saving history is a convenience; failing to save it must never
        // interrupt the conversation on screen.
        return null;
    }
}

export async function deleteConversation(id: string) {
    try { await fetch(`/api/ask/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
    catch { /* nothing to recover */ }
}

export async function clearConversations() {
    try { await fetch("/api/ask/conversations", { method: "DELETE" }); }
    catch { /* nothing to recover */ }
}

export function titleFrom(turns: StoredTurn[]) {
    const first = turns[0]?.q?.trim() ?? "New conversation";
    return first.length > 60 ? first.slice(0, 57) + "…" : first;
}

/** "Today", "Yesterday", else a date — how people actually look for a chat. */
export function dayLabel(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yday = new Date(); yday.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return `Today, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    if (same(d, yday)) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
