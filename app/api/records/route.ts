import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getFxRate } from "@/lib/fx";
import { findContractorByName } from "@/lib/match";

// POST /api/records — save a confirmed invoice
export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (!body.payeeName || typeof body.payeeName !== "string") {
            return NextResponse.json({ error: "payeeName is required" }, { status: 400 });
        }
        if (typeof body.amount !== "number" || isNaN(body.amount)) {
            return NextResponse.json({ error: "amount must be a number" }, { status: 400 });
        }
        if (!body.currency || typeof body.currency !== "string") {
            return NextResponse.json({ error: "currency is required" }, { status: 400 });
        }

        const invoiceCurrency = body.currency.toUpperCase();
        const invoiceDate: string | null = body.date || null;

        // --- FX pin: invoice currency → contractor's local currency, on the invoice date ---
        let local_amount: number | null = null;
        let local_currency: string | null = null;
        let fx_rate: number | null = null;
        let fx_pinned_at: string | null = null;

        const contractor = findContractorByName(body.payeeName);
        if (contractor) {
            const localCcy = contractor.currency;
            if (localCcy !== invoiceCurrency) {
                const lookup = isValidPastDate(invoiceDate) ? invoiceDate! : "latest";
                const rate = await getFxRate(invoiceCurrency, localCcy, lookup);
                if (rate !== null) {
                    fx_rate = rate;
                    local_currency = localCcy;
                    local_amount = Math.round(body.amount * rate * 100) / 100;
                    fx_pinned_at = lookup === "latest" ? new Date().toISOString().slice(0, 10) : invoiceDate;
                }
            }
        }

        const row = {
            payee_name: body.payeeName,
            payee_address: body.payeeAddress || null,
            amount: body.amount,
            currency: invoiceCurrency,
            invoice_date: invoiceDate,
            description: body.description || null,
            invoice_number: body.invoiceNumber || null,
            ai_confidence: body.confidence || null,
            ai_notes: body.notes || null,
            local_amount,
            local_currency,
            fx_rate,
            fx_pinned_at,
        };

        const { data, error } = await getSupabase()
            .from("records")
            .insert(row)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ record: data }, { status: 201 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function GET() {
    try {
        const { data, error } = await getSupabase()
            .from("records")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ records: data || [] });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// Accept only YYYY-MM-DD dates that aren't in the future (FX API has no future data).
function isValidPastDate(d: string | null): boolean {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const today = new Date().toISOString().slice(0, 10);
    return d <= today && d >= "2023-01-01"; // API historical range
}