import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildPaymentRow } from "@/lib/chain";
import { DISPERSE_ADDRESS } from "@/lib/disperse";

type EtherscanTx = { hash: string; to: string; isError: string; functionName?: string };

// One-time import: finds every successful payroll run ever sent to the
// Disperse contract (via the Basescan/Etherscan index) and ingests the ones
// we don't have yet. Idempotent — safe to run again.
export async function POST() {
    try {
        if (!DISPERSE_ADDRESS) return NextResponse.json({ error: "Disperse contract address not configured" }, { status: 500 });

        const key = process.env.ETHERSCAN_API_KEY || "";
        const url = `https://api.etherscan.io/v2/api?chainid=84532&module=account&action=txlist&address=${DISPERSE_ADDRESS}&startblock=0&endblock=99999999&sort=asc${key ? `&apikey=${key}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) return NextResponse.json({ error: `Basescan index unreachable (${res.status})` }, { status: 502 });
        const json = await res.json();
        if (json.status !== "1" && !Array.isArray(json.result)) {
            return NextResponse.json({ error: `Basescan index: ${json.message || "no results"} ${typeof json.result === "string" ? json.result : ""}`.trim() }, { status: 502 });
        }

        const candidates = (json.result as EtherscanTx[]).filter(
            (t) => t.isError === "0" && t.to?.toLowerCase() === DISPERSE_ADDRESS.toLowerCase()
        );

        const supabase = getSupabase();
        const { data: existing, error: exErr } = await supabase.from("payments").select("tx_hash");
        if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
        const have = new Set((existing || []).map((r: { tx_hash: string }) => r.tx_hash.toLowerCase()));

        let imported = 0;
        const skipped: string[] = [];
        for (const tx of candidates) {
            if (have.has(tx.hash.toLowerCase())) continue;
            try {
                const row = await buildPaymentRow(tx.hash as `0x${string}`);
                const { error } = await supabase.from("payments").upsert(row, { onConflict: "tx_hash" });
                if (error) throw new Error(error.message);
                imported++;
            } catch {
                skipped.push(tx.hash); // e.g. an approve or a non-payroll call — not an error
            }
        }

        return NextResponse.json({ imported, alreadyHad: have.size, skipped: skipped.length });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
