import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import PortalShell from "@/components/portal-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await getSessionInfo();
    if (!session) redirect("/login");
    if (session.role === "globepay_admin") redirect("/admin");

    const { data: client } = await getSupabase()
        .from("clients").select("company_name, home_country").eq("id", session.clientId!).single();

    return (
        <PortalShell
            companyName={client?.company_name ?? "Your company"}
            homeCountry={client?.home_country ?? ""}
            email={session.email}>
            {children}
        </PortalShell>
    );
}
