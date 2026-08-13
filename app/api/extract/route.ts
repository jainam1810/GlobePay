import { NextResponse } from "next/server";
import { invoiceSchema, type ExtractedInvoice } from "@/lib/invoice-schema";
import { getSessionInfo } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";

const MODEL = "gemini-2.5-flash";

/**
 * What Gemini can read, and how much of it.
 *
 * Both were missing: dataUrl and mimeType went from the request body straight
 * into the model. No cap meant an unbounded Buffer allocation from a request —
 * a 500 MB data URL is a trivial way to exhaust the server's memory — and no
 * allowlist meant the model was handed whatever content type the caller named.
 * The messages route has had both since it was written; this one was the gap.
 */
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];

// Legacy invoice OCR — superseded by /api/import-freelancers. Kept for now,
// but admin-gated so it can't burn Gemini quota unauthenticated.
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const over = await guard("extract", s.userId);
        if (over) return over;

        const { dataUrl, mimeType } = await req.json();
        if (!dataUrl || !mimeType) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }
        if (!ALLOWED.includes(String(mimeType))) {
            return NextResponse.json({ error: "Send a PDF or an image of the invoice." }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
        }

        const base64 = dataUrl.split(",")[1];
        if (!base64) return NextResponse.json({ error: "Invalid file data" }, { status: 400 });
        // Measured from the encoded length rather than by decoding first, so an
        // oversized payload is refused before it is ever held in memory.
        if (Math.ceil(base64.length * 0.75) > MAX_BYTES) {
            return NextResponse.json({ error: "That file is over 10 MB — send a smaller one." }, { status: 413 });
        }

        const body = {
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64 } },
                    {
                        text:
                            `You are an invoice-reading assistant. Extract the structured fields from the attached invoice and return JSON matching the provided schema.

Rules:
- payeeName: the person or business being PAID — normally the name at the top of the invoice, or under "From". It is NOT the customer being billed, which appears under "Billed to", "Bill to", "Invoice to" or "Client". Those two are easy to swap and swapping them is how a payment ends up addressed to the wrong party. If in doubt, the payee is whoever the wallet address belongs to.
- payeeWallet: the 0x… crypto wallet address the contractor asks to be paid at, copied EXACTLY, character for character. Never correct, complete or guess an address — a single wrong character sends money to a stranger. Empty string if none is given.
- amount: the final total payable, as a number with no currency symbol.
- currency: 3-letter ISO code (USD, EUR, GBP, NGN, INR, ARS, PHP, BRL, etc.).
- date: ISO YYYY-MM-DD. If only month and year are shown, use day 01.
- If a field is genuinely absent or unreadable, return an empty string (or 0 for amount). Do NOT invent values, and do NOT write explanations like "missing" into the field itself - leaving it empty is how you signal absence. Mention what was missing in the notes field instead.
- confidence: "high" if all fields clear, "medium" if some ambiguity, "low" if significant gaps.
- notes: flag anything ambiguous, contradictory, or missing — this is where you tell the human what to look at.` },
                ],
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: invoiceSchema,
                temperature: 0.1,
            },
        };

        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        );

        if (!r.ok) {
            const detail = (await r.text()).slice(0, 400);
            return NextResponse.json({ error: `Gemini API ${r.status}`, detail }, { status: 502 });
        }

        const data = await r.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return NextResponse.json({ error: "Empty response from model" }, { status: 502 });

        const extracted = JSON.parse(text) as ExtractedInvoice;
        return NextResponse.json({ extracted });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}