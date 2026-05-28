import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isAddress } from "viem";
import { getTaxRule } from "@/lib/tax-rules";

function validate(body: any): string | null {
    if (!body.name?.trim()) return "Name is required";
    if (!body.country?.trim()) return "Country is required";
    if (!isAddress(body.wallet ?? "")) return "Wallet address is not a valid Ethereum address";
    if (typeof body.monthly_amount !== "number" || body.monthly_amount <= 0) return "Monthly amount must be a positive number";
    const rule = getTaxRule(body.country);
    if (rule && body.tax_id && !rule.taxIdRegex.test(String(body.tax_id).trim()))
        return `Tax ID doesn't match ${body.country} ${rule.taxIdName} format (e.g. ${rule.taxIdPlaceholder})`;
    return null;
}

export async function GET() {
    try {
        const { data, error } = await getSupabase()
            .from("contractors").select("*").order("created_at", { ascending: true });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ contractors: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const err = validate(body);
        if (err) return NextResponse.json({ error: err }, { status: 400 });

        const rule = getTaxRule(body.country);
        const row = {
            name: body.name.trim(),
            role: body.role?.trim() || null,
            country: body.country.trim(),
            currency: rule?.currencyLocal ?? (body.currency || "USD"),
            wallet: body.wallet.trim(),
            monthly_amount: body.monthly_amount,
            tax_id: body.tax_id?.trim() || null,
        };
        const { data, error } = await getSupabase().from("contractors").insert(row).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ contractor: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}