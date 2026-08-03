// Messages between a client company and GlobePay.
//
// There are only ever two parties, so a client is its own thread — client_id is
// the conversation key and there's no threads table. Attachments live in the
// private "attachments" storage bucket; rows hold only the object path, and
// downloads are served through short-lived signed URLs minted server-side.

export type MessageSender = "client" | "globepay";

export type Message = {
    id: string;
    created_at: string;
    client_id: string;
    sender: MessageSender;
    author_email: string | null;
    body: string | null;
    attachment_path: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    attachment_size: number | null;
    read_at: string | null;
    // Set when the sender retracted it. The row survives; the content does not.
    deleted_for_all_at?: string | null;
    deleted_by_email?: string | null;
    // Attached by the API when listing a thread — expires, so it is never stored.
    attachment_url?: string | null;
};

/* ── retracting a message ────────────────────────────────────────────────────
   WhatsApp allows "delete for everyone" for about 60 hours and does not care
   whether the message was read. Neither rule fits here.

   This thread is a business record between a company and its payroll provider,
   so the window is short — long enough to catch the real mistake (wrong file,
   wrong figure, wrong thread) and too short to rewrite a conversation someone
   is relying on. And it closes the moment the other side reads it, because a
   message that has been seen cannot be unseen: quietly removing it from the
   record afterwards is worse than leaving it and correcting it in the open.

   Both conditions must hold. "Delete for me" has neither restriction — it only
   changes your own view, so it can never mislead anybody else. */

export const UNSEND_WINDOW_MS = 15 * 60 * 1000;

export type UnsendState =
    | { can: true; msLeft: number }
    | { can: false; reason: "not-yours" | "already-deleted" | "read" | "expired" };

/**
 * Whether `me` may still retract `m`. The server runs this too and its answer
 * is the one that counts — this copy exists so the UI doesn't offer a button
 * that is going to be refused.
 */
export function unsendState(m: Message, me: MessageSender, now = Date.now()): UnsendState {
    if (m.sender !== me) return { can: false, reason: "not-yours" };
    if (m.deleted_for_all_at) return { can: false, reason: "already-deleted" };
    if (m.read_at) return { can: false, reason: "read" };
    const msLeft = UNSEND_WINDOW_MS - (now - new Date(m.created_at).getTime());
    if (msLeft <= 0) return { can: false, reason: "expired" };
    return { can: true, msLeft };
}

/** "14 min" / "40 sec" — what's left of the window, for the dialog. */
export function humanLeft(ms: number) {
    const s = Math.max(0, Math.round(ms / 1000));
    return s >= 60 ? `${Math.floor(s / 60)} min` : `${s} sec`;
}

/** One row per client in the admin inbox list. */
export type ThreadSummary = {
    client_id: string;
    company_name: string;
    home_country: string;
    last_body: string | null;
    last_at: string | null;
    last_sender: MessageSender | null;
    unread: number;          // messages from the client we haven't read
    has_attachment: boolean;
};

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Kept in step with the bucket's own allowed_mime_types, so a file that would be
// rejected by storage is rejected earlier with a sentence a human can act on.
export const ALLOWED_TYPES = [
    "image/png", "image/jpeg", "image/webp", "image/heic",
    "application/pdf", "text/plain", "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function prettyBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
