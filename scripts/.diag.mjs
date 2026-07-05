import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
    readFileSync(".env.local", "utf8").split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const s = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: run } = await s.from("payroll_runs").select("*").eq("id", "2e3e7e50-48ae-4c4c-86d5-9d25de16dea0").single();
console.log("run status:", run?.status, "| note:", run?.note, "| items:", run?.line_items?.map(li => `${li.name}:${li.wallet.slice(0,8)}`).join(", "));

// Recent txs from the funded company wallet via Basescan index
const key = env.ETHERSCAN_API_KEY || "";
const wallet = "0x7a0e76dc321B5d44BcEa20527f4B93d13bfc93e5";
const u = `https://api.etherscan.io/v2/api?chainid=84532&module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&sort=desc&page=1&offset=8${key ? `&apikey=${key}` : ""}`;
const r = await (await fetch(u)).json();
for (const t of (r.result || [])) {
    console.log(`${new Date(t.timeStamp * 1000).toISOString()} | from=${t.from.slice(0,8)} to=${t.to?.slice(0,8)} | fn=${t.functionName?.slice(0,40) || "-"} | err=${t.isError} | ${t.hash.slice(0,14)}...`);
}
console.log("DISPERSE:", env.NEXT_PUBLIC_DISPERSE_ADDRESS);
