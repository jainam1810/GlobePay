// The invoice queue: a client uploads, we read it, GlobePay reviews it.
//
// Extraction happens here, on arrival, rather than when a reviewer opens the
// row. That costs one Gemini call per invoice instead of one per view, and it
// means the queue is already readable when someone sits down to work through
// it — the alternative is a table of filenames that each take five seconds to
// become useful.
//
// A failed extraction is not a failed upload. The file is kept either way: it is
// the evidence behind a payment, and a reviewer can read a page the model
// couldn't. The row simply arrives with empty fields and a note saying so.
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { guard } from "@/lib/rate-limit";
import { ALLOWED_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/messages";
import { invoiceSchema, type ExtractedInvoice } from "@/lib/invoice-schema";
import { matchInvoice, type InvoiceSubmission } from "@/lib/invoice-submissions";

const BUCKET = "attachments";
const SIGNED_URL_TTL = 60 * 10;   // 10 minutes: long enough to click, short enough not to leak
const MODEL = "gemini-2.5-flash";

const FIELDS =
    "id, created_at, client_id, file_name, file_type, file_size, extracted, payee_name, payee_wallet, " +
    "amount, currency, invoice_number, invoice_date, description, status, review_note, contractor_id, reviewed_at, payroll_run_id, storage_path";

/** Read one invoice. Never throws — a document we can't read is still a document. */
async function extract(base64: string, mimeType: string): Promise<{ inv: ExtractedInvoice | null; note: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { inv: null, note: "AI reading is not configured on the server." };

    try {
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType, data: base64 } },
                            {
                                text: `You are an invoice-reading assistant. Extract the structured fields from the attached invoice and return JSON matching the provided schema.

Rules:
- payeeName: the person or business being PAID — normally the name at the top of the invoice, or under "From". It is NOT the customer being billed, which appears under "Billed to", "Bill to", "Invoice to" or "Client". Those two are easy to swap and swapping them is how a payment ends up addressed to the wrong party. If in doubt, the payee is whoever the wallet address belongs to.
- payeeWallet: the 0x… crypto wallet address the contractor asks to be paid at, copied EXACTLY, character for character. Never correct, complete or guess an address — a single wrong character sends money to a stranger. Empty string if none is given.
- amount: the final total payable, as a number with no currency symbol.
- currency: 3-letter ISO code (USD, EUR, GBP, NGN, INR, ARS, PHP, BRL, etc.).
- date: ISO YYYY-MM-DD. If only month and year are shown, use day 01.
- If a field is genuinely absent or unreadable, return an empty string (or 0 for amount). Do NOT invent values.
- confidence: "high" if all fields clear, "medium" if some ambiguity, "low" if significant gaps.
- notes: flag anything ambiguous, contradictory, or missing.`,
                            },
                        ],
                    }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: invoiceSchema,
                        temperature: 0.1,
                    },
                }),
            },
        );
        if (!r.ok) {
            console.error(`[invoices] extract HTTP ${r.status}`);
            return { inv: null, note: "We couldn't read this one automatically — the fields need filling in by hand." };
        }
        const j = await r.json();
        const text = (j?.candidates?.[0]?.content?.parts ?? [])
            .map((p: { text?: string }) => p.text ?? "").join("");
        return { inv: JSON.parse(text) as ExtractedInvoice, note: "" };
    } catch (e) {
        console.error("[invoices] extract:", e instanceof Error ? e.message : e);
        return { inv: null, note: "We couldn't read this one automatically — the fields need filling in by hand." };
    }
}

/** A date the model may have written in any shape; null unless it is a real one. */
const asDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null);

export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s?.clientId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        // Each upload spends a Gemini call, so the ceiling is the AI one rather
        // than the ordinary write one.
        const over = await guard("extract", s.userId);
        if (over) return over;

        const { name, type, dataUrl } = await req.json();
        if (!name || !type || !dataUrl) {
            return NextResponse.json({ error: "That file is missing its name or type" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(String(type))) {
            return NextResponse.json({ error: `We can't accept ${type} files. Send a PDF or an image.` }, { status: 400 });
        }

        const base64 = String(dataUrl).split(",")[1];
        if (!base64) return NextResponse.json({ error: "That file couldn't be read" }, { status: 400 });
        // Checked from the encoded length, before anything is decoded, so an
        // oversized payload is refused rather than briefly held in memory.
        if (Math.ceil(base64.length * 0.75) > MAX_ATTACHMENT_BYTES) {
            return NextResponse.json({ error: "That file is over 10 MB — send a smaller one." }, { status: 413 });
        }

        const supabase = getSupabase();
        const bytes = Buffer.from(base64, "base64");
        // Namespaced by client, so 003's storage policies already scope it, and
        // prefixed with a uuid so two invoices called "invoice.pdf" coexist.
        const safe = String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        const path = `${s.clientId}/${crypto.randomUUID()}-${safe}`;

        const { error: upErr } = await supabase.storage.from(BUCKET)
            .upload(path, bytes, { contentType: type, upsert: false });
        if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

        const { inv, note } = await extract(base64, String(type));

        const { data, error } = await supabase.from("invoice_submissions").insert({
            client_id: s.clientId,
            uploaded_by: s.userId,
            storage_path: path,
            file_name: String(name).slice(0, 200),
            file_type: type,
            file_size: bytes.length,
            extracted: inv,
            payee_name: inv?.payeeName?.trim() || null,
            payee_wallet: inv?.payeeWallet?.trim() || null,
            amount: typeof inv?.amount === "number" && inv.amount > 0 ? inv.amount : null,
            currency: inv?.currency?.trim().toUpperCase() || null,
            invoice_number: inv?.invoiceNumber?.trim() || null,
            invoice_date: asDate(inv?.date),
            description: inv?.description?.trim() || null,
            status: "pending",
            review_note: note || null,
        }).select(FIELDS).single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ submission: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const url = new URL(req.url);
        const status = url.searchParams.get("status");
        const supabase = getSupabase();

        let q = supabase.from("invoice_submissions").select(FIELDS).order("created_at", { ascending: false });
        if (s.role !== "globepay_admin") q = q.eq("client_id", s.clientId!);
        if (status && ["pending", "accepted", "needs_attention"].includes(status)) q = q.eq("status", status);

        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Through unknown: the select string is built at runtime, so Supabase
        // types the result as a union that includes its error shape.
        const rows = (data ?? []) as unknown as (InvoiceSubmission & { storage_path: string })[];

        // Admins see every client, so the rows need to say whose they are — and
        // the verdict is computed here rather than in the browser, because it is
        // the thing that decides whether money can move and the roster it is
        // judged against is not something a client session should be handed.
        let names = new Map<string, string>();
        const verdicts = new Map<string, ReturnType<typeof matchInvoice>>();

        if (s.role === "globepay_admin" && rows.length) {
            const clientIds = [...new Set(rows.map((r) => r.client_id))];
            const [{ data: cs }, { data: roster }, { data: accepted }] = await Promise.all([
                supabase.from("clients").select("id, company_name"),
                supabase.from("contractors").select("id, name, wallet, monthly_amount, client_id").in("client_id", clientIds),
                supabase.from("invoice_submissions")
                    .select("id, client_id, payee_wallet, invoice_number")
                    .in("client_id", clientIds).eq("status", "accepted"),
            ]);
            names = new Map((cs ?? []).map((c) => [c.id, c.company_name]));

            const byClient = new Map<string, typeof roster>();
            for (const c of roster ?? []) {
                byClient.set(c.client_id, [...(byClient.get(c.client_id) ?? []), c]);
            }
            for (const r of rows) {
                if (r.status !== "pending") continue;
                verdicts.set(r.id, matchInvoice(
                    r,
                    byClient.get(r.client_id) ?? [],
                    // An invoice never counts as a duplicate of itself.
                    (accepted ?? []).filter((a) => a.client_id === r.client_id && a.id !== r.id),
                ));
            }
        }

        // Two URLs for the same object, because one cannot do both jobs. Asking
        // for `download` sets Content-Disposition: attachment, which is right for
        // a Save link and useless in an iframe — the browser saves the file and
        // renders nothing, which is exactly how the viewer came up blank. So the
        // viewing URL is minted without it and the download URL with it.
        //
        // Both are signed per request and short-lived: the path is stored, the
        // URLs never are, so a leaked response goes stale in ten minutes.
        const submissions = await Promise.all(rows.map(async (r) => {
            const [{ data: signed }, { data: forDownload }] = await Promise.all([
                supabase.storage.from(BUCKET).createSignedUrl(r.storage_path, SIGNED_URL_TTL),
                supabase.storage.from(BUCKET).createSignedUrl(r.storage_path, SIGNED_URL_TTL, { download: r.file_name }),
            ]);
            const { storage_path: _drop, ...rest } = r;
            void _drop;
            return {
                ...rest,
                client_name: names.get(r.client_id) ?? null,
                file_url: signed?.signedUrl ?? null,
                file_download_url: forDownload?.signedUrl ?? null,
                match: verdicts.get(r.id) ?? null,
            };
        }));

        return NextResponse.json({ submissions });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
