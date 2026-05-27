import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// POST /api/records — save a confirmed invoice
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Light validation — the AI + human-confirm step does the heavy lifting,
        // but we still don't trust whatever lands here.
        if (!body.payeeName || typeof body.payeeName !== "string") {
            return NextResponse.json({ error: "payeeName is required" }, { status: 400 });
        }
        if (typeof body.amount !== "number" || isNaN(body.amount)) {
            return NextResponse.json({ error: "amount must be a number" }, { status: 400 });
        }
        if (!body.currency || typeof body.currency !== "string") {
            return NextResponse.json({ error: "currency is required" }, { status: 400 });
        }

        const row = {
            payee_name: body.payeeName,
            payee_address: body.payeeAddress || null,
            amount: body.amount,
            currency: body.currency.toUpperCase(),
            invoice_date: body.date || null,
            description: body.description || null,
            invoice_number: body.invoiceNumber || null,
            ai_confidence: body.confidence || null,
            ai_notes: body.notes || null,
        };

        const { data, error } = await getSupabase()
            .from("records")
            .insert(row)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ record: data }, { status: 201 });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// GET /api/records — list all records, newest first
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