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
    // Attached by the API when listing a thread — expires, so it is never stored.
    attachment_url?: string | null;
};

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
