import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { ALLOWED_TYPES, MAX_ATTACHMENT_BYTES, type Message } from "@/lib/messages";

const BUCKET = "attachments";
const SIGNED_URL_TTL = 60 * 10;   // 10 minutes: long enough to click, short enough not to leak

/**
 * GET /api/messages                 → the caller's own thread (client)
 * GET /api/messages?client_id=…     → that client's thread (admin only)
 *
 * Listing a thread also marks the other side's messages as read, because
 * "opened it" is the only signal either party actually has.
 */
export async function GET(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const asked = new URL(req.url).searchParams.get("client_id");
        const clientId = s.role === "globepay_admin" ? asked : s.clientId;
        if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });
        // A client may only ever read its own thread, whatever it asks for.
        if (s.role !== "globepay_admin" && asked && asked !== s.clientId) {
            return NextResponse.json({ error: "That conversation belongs to another client" }, { status: 403 });
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from("messages").select("*").eq("client_id", clientId).order("created_at", { ascending: true });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // "Delete for me" is per person, so it is applied here rather than in
        // the query — the same thread looks different to two colleagues at the
        // same company.
        //
        // Tolerates the table being absent: 005-message-deletion.sql may not
        // have been run yet, and a missing hide list must degrade to "nothing
        // hidden" rather than taking the whole conversation down with it.
        const { data: hides, error: hidesErr } = await supabase
            .from("message_hides").select("message_id").eq("user_id", s.userId);
        if (hidesErr) console.error("[messages] hide list unavailable:", hidesErr.message);
        const hidden = new Set((hides || []).map((h) => h.message_id as string));

        const all = (data || []) as Message[];
        const messages = all.filter((m) => !hidden.has(m.id));

        // Sign attachment URLs on the way out. The bucket is private, so a raw
        // path is useless without one — and these expire.
        const withUrls = await Promise.all(messages.map(async (m) => {
            if (!m.attachment_path) return m;
            const { data: signed } = await supabase.storage.from(BUCKET)
                .createSignedUrl(m.attachment_path, SIGNED_URL_TTL, { download: m.attachment_name ?? undefined });
            return { ...m, attachment_url: signed?.signedUrl ?? null };
        }));

        // Mark what the *other* side sent as read — over the full thread, not
        // the visible one. Hiding a message from your own view does not unsee
        // it, and read_at is what decides whether the sender may still unsend.
        const theirs = s.role === "globepay_admin" ? "client" : "globepay";
        const unread = all.filter((m) => m.sender === theirs && !m.read_at).map((m) => m.id);
        if (unread.length) {
            await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread);
        }

        return NextResponse.json({ messages: withUrls });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

/**
 * POST /api/messages
 * { clientId?, body?, file?: { name, type, dataUrl } }
 *
 * Attachments arrive as a data URL and are written to storage server-side, so
 * the browser never holds a bucket credential and the file is validated before
 * it lands anywhere.
 */
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { clientId: asked, body, file } = await req.json();
        const clientId = s.role === "globepay_admin" ? asked : s.clientId;
        if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });
        if (s.role !== "globepay_admin" && asked && asked !== s.clientId) {
            return NextResponse.json({ error: "That conversation belongs to another client" }, { status: 403 });
        }

        const text = typeof body === "string" ? body.trim() : "";
        if (!text && !file) return NextResponse.json({ error: "Write a message or attach a file" }, { status: 400 });

        const supabase = getSupabase();
        let attachment: {
            attachment_path: string; attachment_name: string;
            attachment_type: string; attachment_size: number;
        } | null = null;

        if (file) {
            const { name, type, dataUrl } = file;
            if (!name || !type || !dataUrl) return NextResponse.json({ error: "That file is missing its name or type" }, { status: 400 });
            if (!ALLOWED_TYPES.includes(type)) {
                return NextResponse.json({ error: `We can't accept ${type} files. Send a PDF, image, CSV or spreadsheet.` }, { status: 400 });
            }
            const base64 = String(dataUrl).split(",")[1];
            if (!base64) return NextResponse.json({ error: "That file couldn't be read" }, { status: 400 });

            const bytes = Buffer.from(base64, "base64");
            if (bytes.length > MAX_ATTACHMENT_BYTES) {
                return NextResponse.json({ error: "That file is over 10 MB — send a smaller one." }, { status: 400 });
            }

            // Namespaced by client so the storage policy can scope access by
            // folder, and prefixed with a uuid so two invoices called
            // "invoice.pdf" don't overwrite each other.
            const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
            const path = `${clientId}/${crypto.randomUUID()}-${safe}`;

            const { error: upErr } = await supabase.storage.from(BUCKET)
                .upload(path, bytes, { contentType: type, upsert: false });
            if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

            attachment = {
                attachment_path: path, attachment_name: String(name),
                attachment_type: type, attachment_size: bytes.length,
            };
        }

        const { data, error } = await supabase.from("messages").insert({
            client_id: clientId,
            sender: s.role === "globepay_admin" ? "globepay" : "client",
            author_id: s.userId,
            author_email: s.email,
            body: text || null,
            ...(attachment ?? {}),
        }).select().single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ message: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
