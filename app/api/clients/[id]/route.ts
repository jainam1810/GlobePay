import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { isAddress } from "viem";
import { COMPANY_COUNTRIES } from "@/lib/contractor-types";
import type { ClientInput } from "@/lib/clients";

// PATCH /api/clients/[id] — edit a client's details after creation.
// GlobePay admin only: wallet_address is the address a client signs payroll
// from, so letting anyone rewrite it would be a payroll-redirect hole (the
// same gap that existed on /api/contractors/[id]).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
        if (s.role !== "globepay_admin") return NextResponse.json({ error: "GlobePay admin only" }, { status: 403 });

        const { id } = await params;
        const body = (await req.json()) as ClientInput;

        if (!body.company_name?.trim()) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
        if (!body.home_country || !COMPANY_COUNTRIES.includes(body.home_country)) {
            return NextResponse.json({ error: "Pick a valid HQ country" }, { status: 400 });
        }
        if (body.wallet_address && !isAddress(body.wallet_address.trim())) {
            return NextResponse.json({ error: "Wallet address is not a valid Ethereum address" }, { status: 400 });
        }

        const row = {
            company_name: body.company_name.trim(),
            home_country: body.home_country,
            wallet_address: body.wallet_address?.trim() || null,
            contact_email: body.contact_email?.trim() || null,
            notes: body.notes?.trim() || null,
        };
        const { data, error } = await getSupabase().from("clients").update(row).eq("id", id).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ client: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
