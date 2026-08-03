// "Prove you know the current password", checked on the server so it can be
// rate limited.
//
// The check used to run in the browser: signInWithPassword straight to Supabase,
// which meant the only ceiling on guessing was Supabase's own — 1800 requests an
// hour on /auth/v1/token, per IP, and not configurable. Against a known email
// address that is a wide door, and the session holder already knows the email.
//
// Here it is five attempts per fifteen minutes **per user**, so rotating IP does
// not help. This cannot stop someone who calls Supabase directly — nothing in
// our code can — but it closes the path our own UI offers, and it is keyed to
// the thing an attacker cannot change.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionInfo } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";

export async function POST() {
    return NextResponse.json({ error: "Use PUT" }, { status: 405 });
}

export async function PUT(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const over = await guard("reauth", s.userId,
            "Too many attempts. Wait a few minutes before trying again.");
        if (over) return over;

        const { password } = await req.json();
        if (typeof password !== "string" || !password) {
            return NextResponse.json({ error: "Enter your current password." }, { status: 400 });
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anon) return NextResponse.json({ error: "Auth is not configured" }, { status: 500 });

        // A throwaway client with no session persistence. Using the request's
        // own client would mint a second session and rotate the caller's cookies
        // as a side effect of what is only meant to be a yes/no question.
        const probe = createClient(url, anon, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await probe.auth.signInWithPassword({ email: s.email, password });

        // Sign the throwaway session straight back out so the token minted by a
        // successful check does not outlive the question it answered.
        if (!error) await probe.auth.signOut();

        // Same shape either way; the caller learns only whether it matched.
        return error
            ? NextResponse.json({ error: "That current password isn't right." }, { status: 401 })
            : NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
