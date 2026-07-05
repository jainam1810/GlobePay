import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildPaymentRow } from "@/lib/chain";
import { getSessionInfo } from "@/lib/auth";

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
        const s = await getSessionInfo();
        if (!s) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const supabase = getSupabase();
        let q = supabase.from("payments").select("*").order("paid_at", { ascending: false });
        if (s.role !== "globepay_admin") q = q.eq("client_id", s.clientId!);
        const { data, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // Admin view: label each payment with its client's name.
        let payments = data || [];
        if (s.role === "globepay_admin" && payments.length) {
            const { data: clients } = await supabase.from("clients").select("id, company_name");
            const names = new Map((clients || []).map((c) => [c.id, c.company_name]));
            payments = payments.map((p) => ({ ...p, client_name: p.client_id ? names.get(p.client_id) ?? null : null }));
        }
        return NextResponse.json({ payments });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
