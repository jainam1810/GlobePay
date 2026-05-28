import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getFxRate } from "@/lib/fx";
import { findContractorByName } from "@/lib/match";
import { computeWithholding } from "@/lib/tax-rules";
import { getCompanyCountry } from "@/lib/company";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.payeeName?.trim()) return NextResponse.json({ error: "payeeName is required" }, { status: 400 });
        if (typeof body.amount !== "number" || isNaN(body.amount)) return NextResponse.json({ error: "amount must be a number" }, { status: 400 });
        if (!body.currency?.trim()) return NextResponse.json({ error: "currency is required" }, { status: 400 });

        const invoiceCurrency = body.currency.toUpperCase();
        const invoiceDate: string | null = body.date || null;
        const contractor = await findContractorByName(body.payeeName);
        const companyCountry = await getCompanyCountry();

        // --- FX pin (always useful, domestic or cross-border) ---
        let local_amount: number | null = null, local_currency: string | null = null, fx_rate: number | null = null, fx_pinned_at: string | null = null;
        if (contractor && contractor.currency !== invoiceCurrency) {
            const lookup = isValidPastDate(invoiceDate) ? invoiceDate! : "latest";
            const rate = await getFxRate(invoiceCurrency, contractor.currency, lookup);
            if (rate !== null) {
                fx_rate = rate;
                local_currency = contractor.currency;
                local_amount = Math.round(body.amount * rate * 100) / 100;
                fx_pinned_at = lookup === "latest" ? new Date().toISOString().slice(0, 10) : invoiceDate;
            }
        }

        // --- Tax: withhold ONLY when payer and payee are in the same country ---
        let tax_country: string | null = null, withholding_rate: number | null = null;
        let withheld_amount: number | null = null, net_amount: number | null = null;
        let contractor_tax_id: string | null = null, tax_treatment: string | null = null;
        const company_country = companyCountry;

        if (contractor) {
            contractor_tax_id = contractor.tax_id ?? null;
            tax_country = contractor.country;
            const sameCountry = !!companyCountry && companyCountry.toLowerCase() === contractor.country.toLowerCase();

            if (sameCountry) {
                const wh = computeWithholding(body.amount, contractor.country); // computed in CODE, never the AI
                if (wh) {
                    tax_treatment = "domestic";
                    withholding_rate = wh.withholdingRate;
                    withheld_amount = wh.withheldAmount;
                    net_amount = wh.netAmount;
                }
            } else {
                tax_treatment = "cross_border"; // payer abroad → no withholding; contractor self-reports
            }
        }

        const row = {
            payee_name: body.payeeName, payee_address: body.payeeAddress || null,
            amount: body.amount, currency: invoiceCurrency, invoice_date: invoiceDate,
            description: body.description || null, invoice_number: body.invoiceNumber || null,
            ai_confidence: body.confidence || null, ai_notes: body.notes || null,
            local_amount, local_currency, fx_rate, fx_pinned_at,
            tax_country, withholding_rate, withheld_amount, net_amount, contractor_tax_id,
            tax_treatment, company_country,
        };

        const { data, error } = await getSupabase().from("records").insert(row).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ record: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const { data, error } = await getSupabase().from("records").select("*").order("created_at", { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ records: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

function isValidPastDate(d: string | null): boolean {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const today = new Date().toISOString().slice(0, 10);
    return d <= today && d >= "2023-01-01";
}