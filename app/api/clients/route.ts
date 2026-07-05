import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { isAddress } from "viem";
import { COMPANY_COUNTRIES } from "@/lib/contractor-types";

export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        let q = getSupabase().from("clients").select("*").order("created_at", { ascending: true });
        if (s.role !== "globepay_admin") q = q.eq("id", s.clientId!);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ clients: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s || s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const body = await req.json();
        if (!body.company_name?.trim()) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
        if (!COMPANY_COUNTRIES.includes(body.home_country)) return NextResponse.json({ error: "Pick a valid HQ country" }, { status: 400 });
        if (body.wallet_address && !isAddress(body.wallet_address)) return NextResponse.json({ error: "Wallet address is not a valid Ethereum address" }, { status: 400 });

        const row = {
            company_name: body.company_name.trim(),
            home_country: body.home_country,
            wallet_address: body.wallet_address?.trim() || null,
            contact_email: body.contact_email?.trim() || null,
            notes: body.notes?.trim() || null,
        };
        const { data, error } = await getSupabase().from("clients").insert(row).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ client: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
