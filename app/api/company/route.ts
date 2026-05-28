import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
    try {
        const { data, error } = await getSupabase().from("company_profile").select("*").eq("id", 1).single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ company: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const update: Record<string, unknown> = {};
        if (typeof body.home_country === "string") update.home_country = body.home_country;
        if (typeof body.company_name === "string") update.company_name = body.company_name;
        const { data, error } = await getSupabase().from("company_profile").update(update).eq("id", 1).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ company: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
    }
}