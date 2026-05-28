import { getSupabase } from "@/lib/supabase";

export async function getCompanyCountry(): Promise<string | null> {
    const { data, error } = await getSupabase()
        .from("company_profile").select("home_country").eq("id", 1).single();
    if (error || !data) return null;
    return data.home_country as string;
}