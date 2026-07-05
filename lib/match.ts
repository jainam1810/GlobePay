import { getSupabase } from "@/lib/supabase";
import type { DbContractor } from "@/lib/contractor-types";

// Pure matcher: find the contractor whose name matches the invoice payee.
export function matchContractor(payeeName: string, contractors: DbContractor[]): DbContractor | null {
    if (!payeeName) return null;
    const needle = payeeName.toLowerCase().trim();

    // exact match first
    for (const c of contractors) {
        if (c.name.toLowerCase() === needle) return c;
    }
    // then partial (first/last name appears in the payee string)
    for (const c of contractors) {
        const parts = c.name.toLowerCase().split(" ");
        if (parts.some((p) => p.length >= 3 && needle.includes(p))) return c;
    }
    return null;
}

// Find a contractor (from the DB) whose name matches the invoice payee.
export async function findContractorByName(payeeName: string): Promise<DbContractor | null> {
    if (!payeeName) return null;
    const { data, error } = await getSupabase().from("contractors").select("*");
    if (error || !data) return null;
    return matchContractor(payeeName, data as DbContractor[]);
}
