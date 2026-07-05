// Session + role resolution for route handlers and server components.
// Role/client mapping is read with the service-role client so it works
// regardless of RLS; the session itself comes from the user's cookies.
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export type SessionInfo = {
    userId: string;
    email: string | null;
    role: "globepay_admin" | "client";
    clientId: string | null;   // null for globepay_admin
};

export async function getSessionInfo(): Promise<SessionInfo | null> {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await getSupabase()
        .from("client_users")
        .select("role, client_id")
        .eq("user_id", user.id)
        .single();
    if (!data) return null; // logged in but not provisioned — treat as no access

    return {
        userId: user.id,
        email: user.email ?? null,
        role: data.role,
        clientId: data.client_id,
    };
}

export async function requireAdmin(): Promise<SessionInfo> {
    const s = await getSessionInfo();
    if (!s || s.role !== "globepay_admin") throw new Error("UNAUTHORIZED");
    return s;
}

export async function requireClient(): Promise<SessionInfo & { clientId: string }> {
    const s = await getSessionInfo();
    if (!s || s.role !== "client" || !s.clientId) throw new Error("UNAUTHORIZED");
    return s as SessionInfo & { clientId: string };
}
