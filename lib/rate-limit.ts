// Rate limiting, keyed by who is asking rather than where from.
//
// These endpoints sit behind a login, so the identity is the useful key: an
// office shares one IP, and a stolen session moves between them. IP is the
// fallback for the routes anyone can reach.
//
// The counter lives in Postgres (see supabase/007-rate-limits.sql) because a
// Map in module scope is per-instance and resets on deploy — the real limit
// becomes N times what you wrote, and an attacker only has to keep landing on a
// cold instance.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export type Limit = { limit: number; windowSeconds: number };

/**
 * Budgets, set by what the call costs us rather than by a house number.
 *
 * The AI routes are the expensive ones. A single /api/ask question spends up to
 * five Gemini round trips, and the free tier is twenty per model per day — so
 * one bored account could take the assistant down for every client before
 * lunch. /api/extract ships a whole document. The rest are generous enough that
 * no real person will meet them, and low enough to make scripted abuse dull.
 */
export const LIMITS = {
    ask: { limit: 20, windowSeconds: 300 },        // ~1 question every 15s, sustained
    extract: { limit: 15, windowSeconds: 300 },    // an invoice every 20s
    search: { limit: 120, windowSeconds: 60 },     // typing is bursty; the debounce is 180ms
    write: { limit: 60, windowSeconds: 300 },      // roster edits, settings, messages
    reauth: { limit: 5, windowSeconds: 900 },      // password guesses. Deliberately tight.
    verify: { limit: 20, windowSeconds: 3600 },    // public: wallet signature checks
    contact: { limit: 5, windowSeconds: 3600 },    // public: the enquiry form
} as const satisfies Record<string, Limit>;

export type Result = { ok: boolean; remaining: number; retryAfter: number };

/**
 * Count a hit against a bucket.
 *
 * Fails **open**. If the database is unreachable the request proceeds: this
 * guards a quota, and refusing to let a company approve payroll because a
 * counter table was briefly unavailable would be a worse outcome than the abuse
 * it prevents. The failure is logged so it cannot pass silently.
 */
export async function rateLimit(bucket: string, { limit, windowSeconds }: Limit): Promise<Result> {
    try {
        const { data, error } = await getSupabase().rpc("check_rate_limit", {
            p_bucket: bucket,
            p_limit: limit,
            p_window_seconds: windowSeconds,
        });
        if (error) {
            console.error(`[rate-limit] ${bucket}: ${error.message}`);
            return { ok: true, remaining: limit, retryAfter: 0 };
        }
        const row = Array.isArray(data) ? data[0] : data;
        return {
            ok: row?.allowed ?? true,
            remaining: row?.remaining ?? 0,
            retryAfter: row?.retry_after ?? windowSeconds,
        };
    } catch (e) {
        console.error(`[rate-limit] ${bucket}:`, e instanceof Error ? e.message : e);
        return { ok: true, remaining: limit, retryAfter: 0 };
    }
}

/** The caller's address, as far as the proxy in front of us reports it. */
export function ipOf(req: Request) {
    return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
        || req.headers.get("x-real-ip")
        || "unknown";
}

/**
 * A 429 that says how long to wait, in a sentence rather than a status code.
 *
 * Retry-After is set because well-behaved clients honour it, and because
 * without it the only way to find out is to keep hammering.
 */
export function tooMany(retryAfter: number, message?: string) {
    const mins = Math.ceil(retryAfter / 60);
    return NextResponse.json(
        {
            error: message
                ?? `That's a lot of requests in a short while — try again in ${mins <= 1 ? "a minute" : `${mins} minutes`}.`,
            retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
}

/**
 * The usual shape: check, and hand back a ready-made 429 if it's over.
 * Returns null when the call may proceed.
 */
export async function guard(action: keyof typeof LIMITS, identity: string, message?: string) {
    const r = await rateLimit(`${action}:${identity}`, LIMITS[action]);
    return r.ok ? null : tooMany(r.retryAfter, message);
}
