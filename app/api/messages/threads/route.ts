import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import type { ThreadSummary } from "@/lib/messages";

// GET /api/messages/threads — the admin inbox: one row per client, newest
// conversation first, with a count of what they've sent that we haven't opened.
// Clients don't need this; they only ever have one conversation.
export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
        if (s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const supabase = getSupabase();
        const [{ data: clients }, { data: msgs, error }] = await Promise.all([
            supabase.from("clients").select("id, company_name, home_country").order("company_name"),
            supabase.from("messages").select("client_id, sender, body, created_at, read_at, attachment_path")
                .order("created_at", { ascending: false }),
        ]);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const byClient = new Map<string, typeof msgs>();
        for (const m of msgs || []) {
            const list = byClient.get(m.client_id) ?? [];
            list.push(m);
            byClient.set(m.client_id, list);
        }

        // Every client appears, including ones who've never written — an empty
        // conversation is still somewhere you might start one.
        const threads: ThreadSummary[] = (clients || []).map((c) => {
            const list = byClient.get(c.id) ?? [];
            const last = list[0];
            return {
                client_id: c.id,
                company_name: c.company_name,
                home_country: c.home_country,
                last_body: last?.body ?? (last?.attachment_path ? "Sent a file" : null),
                last_at: last?.created_at ?? null,
                last_sender: last?.sender ?? null,
                unread: list.filter((m) => m.sender === "client" && !m.read_at).length,
                has_attachment: list.some((m) => !!m.attachment_path),
            };
        });

        // Unread first, then most recent. A quiet client shouldn't push an
        // unanswered one down the page.
        threads.sort((a, b) => {
            if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
            return +new Date(b.last_at ?? 0) - +new Date(a.last_at ?? 0);
        });

        return NextResponse.json({ threads });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
