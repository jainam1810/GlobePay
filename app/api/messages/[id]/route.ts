import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { unsendState, type Message, type MessageSender } from "@/lib/messages";

const BUCKET = "attachments";

/**
 * DELETE /api/messages/:id?mode=me|everyone
 *
 *   me         hide it from the caller's own view. Any message, any age, from
 *              either side. A row in message_hides; nothing else changes.
 *
 *   everyone   retract it from the thread. Sender only, inside the window, and
 *              only while unread. The row stays as a tombstone so the history
 *              still shows that something was withdrawn and when — the content
 *              is what goes, including the file in storage.
 *
 * Every rule is re-checked here. The client's copy of the logic decides which
 * buttons to show; this decides what actually happens.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { id } = await ctx.params;
        const mode = new URL(req.url).searchParams.get("mode") ?? "me";
        if (mode !== "me" && mode !== "everyone") {
            return NextResponse.json({ error: "mode must be 'me' or 'everyone'" }, { status: 400 });
        }

        const supabase = getSupabase();
        const { data: row, error: readErr } = await supabase
            .from("messages").select("*").eq("id", id).single();
        if (readErr || !row) return NextResponse.json({ error: "That message no longer exists" }, { status: 404 });

        const m = row as Message;

        // Scope first: a client may only touch messages in its own thread.
        if (s.role !== "globepay_admin" && m.client_id !== s.clientId) {
            return NextResponse.json({ error: "That message belongs to another conversation" }, { status: 403 });
        }

        const me: MessageSender = s.role === "globepay_admin" ? "globepay" : "client";

        /* ── hide it for this person only ── */
        if (mode === "me") {
            const { error } = await supabase
                .from("message_hides")
                .upsert({ message_id: id, user_id: s.userId }, { onConflict: "message_id,user_id" });
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ ok: true, mode });
        }

        /* ── retract it from the thread ── */
        const state = unsendState(m, me);
        if (!state.can) {
            const said = {
                "not-yours": "You can only delete your own messages for everyone.",
                "already-deleted": "That message has already been deleted.",
                // The honest reason, not a generic refusal — it tells the sender
                // what actually happened, which is what they need to know.
                "read": "It's already been read, so it can't be unsent. You can delete it for yourself, or send a correction.",
                "expired": "The time limit for unsending has passed. You can delete it for yourself, or send a correction.",
            }[state.reason];
            return NextResponse.json({ error: said, reason: state.reason }, { status: 409 });
        }

        // The file has to actually go. A retraction that leaves the attachment
        // reachable by signed URL has not retracted anything.
        if (m.attachment_path) {
            await supabase.storage.from(BUCKET).remove([m.attachment_path]);
        }

        const { error } = await supabase.from("messages").update({
            body: null,
            attachment_path: null,
            attachment_name: null,
            attachment_type: null,
            attachment_size: null,
            deleted_for_all_at: new Date().toISOString(),
            deleted_by_email: s.email,
        }).eq("id", id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, mode });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
