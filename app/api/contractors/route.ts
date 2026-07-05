import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isAddress } from "viem";
import { getTaxRule } from "@/lib/tax-rules";
import { getSessionInfo } from "@/lib/auth";

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

export async function GET(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        let q = getSupabase().from("contractors").select("*").order("created_at", { ascending: true });
        if (s.role === "globepay_admin") {
            const clientId = new URL(req.url).searchParams.get("client_id");
            if (clientId) q = q.eq("client_id", clientId);
        } else {
            q = q.eq("client_id", s.clientId!);
        }
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ contractors: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const body = await req.json();
        if (!body.client_id) return NextResponse.json({ error: "client_id is required — every freelancer belongs to a client" }, { status: 400 });
        const err = validate(body);
        if (err) return NextResponse.json({ error: err }, { status: 400 });

        const rule = getTaxRule(body.country);
        const row = {
            client_id: body.client_id,
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