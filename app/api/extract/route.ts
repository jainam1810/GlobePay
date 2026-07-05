import { NextResponse } from "next/server";
import { invoiceSchema, type ExtractedInvoice } from "@/lib/invoice-schema";
import { getSessionInfo } from "@/lib/auth";

const MODEL = "gemini-2.5-flash";

// Legacy invoice OCR — superseded by /api/import-freelancers. Kept for now,
// but admin-gated so it can't burn Gemini quota unauthenticated.
export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });
        const { dataUrl, mimeType } = await req.json();
        if (!dataUrl || !mimeType) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
        }

        const base64 = dataUrl.split(",")[1];
        if (!base64) return NextResponse.json({ error: "Invalid file data" }, { status: 400 });

        const body = {
            contents: [{
                parts: [
                    { inlineData: { mimeType, data: base64 } },
                    {
                        text:
                            `You are an invoice-reading assistant. Extract the structured fields from the attached invoice and return JSON matching the provided schema.

Rules:
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