// Saved conversations for the assistant.
//
// Kept in localStorage rather than the database, deliberately: there is no
// migration, no row cost and no new API surface, and the questions are about
// data the person can already see. The trade is that history is per-browser —
// worth saying out loud in the UI rather than letting someone assume it follows
// them to another machine.
//
// Everything below is defensive about storage failing: private windows, full
// quotas and disabled storage all throw, and none of that should take the
// assistant down with it.

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
    startedAt: number;
    updatedAt: number;
    title: string;        // first question, trimmed — what someone recognises it by
    turns: StoredTurn[];
};

const KEY = "globepay.ask.history";
const MAX = 40;   // plenty for a person, nowhere near a storage quota

/**
 * How long a saved conversation survives.
 *
 * 30 days, not 24 hours. The job here is "get a number before a stakeholder
 * meeting", and those are weekly, monthly or quarterly — a question asked on
 * Friday for a Monday meeting must still be there on Monday. A day-long window
 * would delete the history precisely when it was about to be useful, and silent
 * overnight loss reads as a bug rather than a feature.
 *
 * It still expires, so nothing accumulates indefinitely on a shared machine.
 * One constant to change if a shorter window is ever wanted.
 */
export const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function read(): Conversation[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];

        // Expire on read rather than on a timer: a background timer only runs
        // while a tab is open, so it would miss exactly the case that matters —
        // a browser closed for a fortnight.
        const cutoff = Date.now() - RETENTION_MS;
        const live = (parsed as Conversation[]).filter((c) => (c.updatedAt ?? 0) > cutoff);
        if (live.length !== parsed.length) write(live);
        return live;
    } catch {
        return [];
    }
}

function write(list: Conversation[]) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
        // Out of quota or storage disabled — the conversation on screen still
        // works, it just won't be there tomorrow. Not worth an error message.
    }
}

export function listConversations(): Conversation[] {
    return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Insert or update in place, keyed by id. */
export function saveConversation(c: Conversation) {
    const list = read().filter((x) => x.id !== c.id);
    write([c, ...list].sort((a, b) => b.updatedAt - a.updatedAt));
}

export function deleteConversation(id: string) {
    write(read().filter((c) => c.id !== id));
}

export function clearConversations() {
    write([]);
}

export function titleFrom(turns: StoredTurn[]) {
    const first = turns[0]?.q?.trim() ?? "New conversation";
    return first.length > 60 ? first.slice(0, 57) + "…" : first;
}

/** "Today", "Yesterday", else a date — how people actually look for a chat. */
export function dayLabel(ms: number) {
    const d = new Date(ms);
    const today = new Date();
    const yday = new Date(); yday.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return "Today";
    if (same(d, yday)) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
