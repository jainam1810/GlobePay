import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSessionInfo } from "@/lib/auth";
import { importSchema, type ImportExtraction, type ImportedFreelancer } from "@/lib/import-schema";
import { SUPPORTED_COUNTRIES } from "@/lib/contractor-types";
import { getTaxRule, validateTaxId } from "@/lib/tax-rules";

const MODEL = "gemini-2.5-flash";

const PROMPT = `You are an onboarding assistant for a payroll platform. The attached content is a client's list of freelancers they want to pay — it may be a pasted email, a spreadsheet export, a table, or free text in any format.

Extract every freelancer into the provided JSON schema.

Rules:
- One entry per distinct person. Do not invent people, wallets, or amounts.
- wallet: copy the 0x address EXACTLY as written, character for character. Never correct, complete, or guess an address. Empty string if none given.
- country: the person's country as an English country name.
- monthly_amount: their monthly pay in USD as a number. If a different currency or period is stated, put the stated value and explain in that row's notes — do NOT convert.
- If a field is absent, use an empty string (or 0 for amount) and say what's missing in notes.
- Overall notes: anything a human must double-check (duplicates, inconsistent formats, suspicious data).`;

// Per-row validation — in CODE, never trusted to the AI.
export type ValidatedRow = ImportedFreelancer & {
    valid: boolean;
    problems: string[];
};

function validateRow(f: ImportedFreelancer): ValidatedRow {
    const problems: string[] = [];
    if (!f.name?.trim()) problems.push("missing name");
    if (!f.wallet?.trim()) problems.push("missing wallet address");
    else if (!isAddress(f.wallet.trim())) problems.push("invalid wallet address (checksum failed)");
    if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(f.country?.trim()))
        problems.push(`country "${f.country || "?"}" not supported for tax (${SUPPORTED_COUNTRIES.join(", ")})`);
    if (!(typeof f.monthly_amount === "number") || f.monthly_amount <= 0) problems.push("missing/invalid monthly amount");
    if (f.tax_id?.trim() && getTaxRule(f.country) && !validateTaxId(f.tax_id.trim(), f.country))
        problems.push(`tax ID doesn't match ${f.country} format`);
    return { ...f, valid: problems.length === 0, problems };
}

export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const { text, dataUrl, mimeType } = await req.json();
        if (!text?.trim() && !(dataUrl && mimeType)) {
            return NextResponse.json({ error: "Paste the client's list or attach a file" }, { status: 400 });
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });

        const parts: object[] = [];
        if (dataUrl && mimeType) {
            const base64 = String(dataUrl).split(",")[1];
            if (!base64) return NextResponse.json({ error: "Invalid file data" }, { status: 400 });
            parts.push({ inlineData: { mimeType, data: base64 } });
        }
        if (text?.trim()) parts.push({ text: "CLIENT'S LIST:\n" + text });
        parts.push({ text: PROMPT });

        const callGemini = () => fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
            {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseMimeType: "application/json", responseSchema: importSchema, temperature: 0.1 },
                }),
            },
        );
        let r = await callGemini();
        if (!r.ok && (r.status >= 500 || r.status === 429)) {
            await new Promise((res) => setTimeout(res, 1500)); // one retry on transient errors
            r = await callGemini();
        }
        if (!r.ok) {
            const detail = (await r.text()).slice(0, 400);
            return NextResponse.json({ error: `Gemini API ${r.status}`, detail }, { status: 502 });
        }
        const data = await r.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) return NextResponse.json({ error: "Empty response from model" }, { status: 502 });

        const extraction = JSON.parse(raw) as ImportExtraction;
        const rows = (extraction.freelancers || []).map(validateRow);
        return NextResponse.json({ rows, confidence: extraction.confidence, notes: extraction.notes });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
