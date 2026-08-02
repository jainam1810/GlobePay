import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { RETENTION_HOURS } from "@/lib/ask-history";

// Saved conversations, per account rather than per browser — sign in anywhere
// and your questions are there.
//
// Everything is scoped to the calling user, never to the client: two people at
// the same company shouldn't read each other's questions, and this is somebody's
// train of thought rather than a business record. The durable record of the
// payments themselves is the ledger and the audit pack.

const cutoff = () => new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

/** Expire on access. A scheduled job would need infrastructure this doesn't warrant. */
async function sweep(userId: string) {
    await getSupabase().from("ask_conversations").delete()
        .eq("user_id", userId).lt("updated_at", cutoff());
}

export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        await sweep(s.userId);
        const { data, error } = await getSupabase()
            .from("ask_conversations").select("*")
            .eq("user_id", s.userId).order("updated_at", { ascending: false }).limit(40);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ conversations: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

/** POST { id?, title, turns } — upsert. The client owns the id so a growing
 *  conversation updates in place rather than spawning a row per question. */
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { id, title, turns } = await req.json();
        if (!Array.isArray(turns) || turns.length === 0) {
            return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
        }

        const row = {
            ...(id ? { id } : {}),
            user_id: s.userId,
            client_id: s.role === "globepay_admin" ? null : s.clientId,
            title: String(title || "Conversation").slice(0, 120),
            turns,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await getSupabase()
            .from("ask_conversations").upsert(row, { onConflict: "id" }).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ conversation: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

/** DELETE ?id=… removes one; no id removes every conversation this user has. */
export async function DELETE(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const id = new URL(req.url).searchParams.get("id");
        // The user_id filter is what stops an id from another account being
        // deleted by guessing it; RLS refuses it again underneath.
        let q = getSupabase().from("ask_conversations").delete().eq("user_id", s.userId);
        if (id) q = q.eq("id", id);

        const { error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
