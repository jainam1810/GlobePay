import { NextResponse } from "next/server";
import { Resend } from "resend";

// The contact form's send route.
//
// The recipient is fixed in configuration and never comes from the request —
// a contact form that mails wherever it is told is an open relay, and spammers
// find those within days. The visitor's address is used only as Reply-To, so
// hitting reply in the inbox answers them directly.

const TO = process.env.CONTACT_TO || "jainamvaria1010@gmail.com";
// Resend's sandbox sender works without a verified domain, but will only
// deliver to the account owner. Point CONTACT_FROM at a verified domain once
// there is one, and delivery to anyone else starts working.
const FROM = process.env.CONTACT_FROM || "GlobePay <onboarding@resend.dev>";

const MAX = { name: 120, email: 200, company: 160, message: 4000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A few submissions per IP per hour is generous for a human and useless to a
// bot. In-memory, so it resets on deploy — enough for a form this size, and
// honest about being a speed bump rather than a wall.
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.set(ip, recent);
    if (recent.length >= LIMIT) return true;
    recent.push(now);
    return false;
}

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const name = String(body?.name ?? "").trim();
        const email = String(body?.email ?? "").trim();
        const company = String(body?.company ?? "").trim();
        const message = String(body?.message ?? "").trim();
        // Hidden field. A human never fills it; a bot fills everything.
        const trap = String(body?.website ?? "").trim();

        if (trap) return NextResponse.json({ ok: true });   // accept and drop

        if (!name || !email || !message) {
            return NextResponse.json({ error: "Name, email and message are all needed." }, { status: 400 });
        }
        if (!EMAIL.test(email)) {
            return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
        }
        if (name.length > MAX.name || email.length > MAX.email
            || company.length > MAX.company || message.length > MAX.message) {
            return NextResponse.json({ error: "That message is longer than we can accept." }, { status: 400 });
        }

        const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
        if (rateLimited(ip)) {
            return NextResponse.json(
                { error: "That's a few messages in a short while — try again a little later." },
                { status: 429 },
            );
        }

        const key = process.env.RESEND_API_KEY;
        if (!key) {
            console.error("[contact] RESEND_API_KEY is not set");
            return NextResponse.json(
                { error: "We couldn't send that just now. Email us directly and we'll pick it up." },
                { status: 500 },
            );
        }

        const { error } = await new Resend(key).emails.send({
            from: FROM,
            to: [TO],
            // The whole point: reply in the inbox and it reaches them.
            replyTo: email,
            subject: `GlobePay enquiry — ${name}${company ? ` (${company})` : ""}`,
            text: [
                `From:    ${name} <${email}>`,
                company ? `Company: ${company}` : null,
                "",
                message,
            ].filter(Boolean).join("\n"),
            html: `
                <div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111">
                  <p style="margin:0 0 4px"><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p>
                  ${company ? `<p style="margin:0 0 4px;color:#555">${esc(company)}</p>` : ""}
                  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0" />
                  <p style="white-space:pre-wrap;margin:0">${esc(message)}</p>
                </div>`,
        });

        if (error) {
            console.error("[contact] resend:", error.message);
            return NextResponse.json(
                { error: "We couldn't send that just now. Email us directly and we'll pick it up." },
                { status: 502 },
            );
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("[contact]", e instanceof Error ? e.message : e);
        return NextResponse.json({ error: "Something went wrong sending that." }, { status: 500 });
    }
}
