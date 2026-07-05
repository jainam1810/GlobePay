import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildPaymentRow } from "@/lib/chain";

// POST { txHash } — the client only sends the hash; everything stored is
// rebuilt from the chain server-side (receipt + USDC Transfer events).
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const txHash: string | undefined = body?.txHash;
        if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
            return NextResponse.json({ error: "txHash must be a 66-character transaction hash" }, { status: 400 });
        }

        const row = await buildPaymentRow(txHash as `0x${string}`);
        const { data, error } = await getSupabase()
            .from("payments")
            .upsert(row, { onConflict: "tx_hash" })
            .select()
            .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ payment: data }, { status: 201 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const { data, error } = await getSupabase()
            .from("payments")
            .select("*")
            .order("paid_at", { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ payments: data || [] });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
