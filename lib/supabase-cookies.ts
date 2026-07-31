// Cookie policy for the Supabase auth session, shared by the browser client,
// the server client and proxy.ts so all three agree.
//
// Normally the session cookie is SameSite=Lax, which browsers refuse to send on
// cross-site requests. That's the right default — it's a CSRF defence. But when
// GlobePay runs as a Safe App it lives in an iframe served from app.safe.global,
// so every request to us is cross-site: the cookie gets set at login and then
// never sent back, the server sees no session, and /login loops forever.
//
// SameSite=None fixes that (and requires Secure, so HTTPS only). It also gives
// up the CSRF protection Lax provides, which is why it is opt-in per deployment
// rather than always on. Turn it on only for a build you intend to embed.
// SameSite=None alone is not enough in current Chrome: third-party cookies are
// blocked outright in an iframe regardless of SameSite. `Partitioned` (CHIPS)
// is the sanctioned way through — the cookie is kept in a separate jar keyed to
// the embedding site, so it works inside Safe without being a tracking cookie.
export const embedInIframe = process.env.NEXT_PUBLIC_EMBED_IN_IFRAME === "1";

export const authCookieOptions = embedInIframe
    ? { sameSite: "none" as const, secure: true, partitioned: true }
    : undefined;
