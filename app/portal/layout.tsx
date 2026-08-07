import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import WalletProviders from "@/components/wallet-providers";
import { config } from "@/lib/wagmi";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import PortalShell from "@/components/portal-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    // The wallet state the browser already had, read from its cookie so the
    // first paint already knows about it — otherwise the server renders
    // "not connected" and a returning user watches Connect Wallet blink past.
    // Safe to read here: this route is dynamic anyway because it reads a session.
    const walletState = cookieToInitialState(config, (await headers()).get("cookie"));

    const session = await getSessionInfo();
    if (!session) redirect("/login");
    if (session.role === "globepay_admin") redirect("/admin");

    const { data: client } = await getSupabase()
        .from("clients").select("company_name, home_country").eq("id", session.clientId!).single();

    return (
        <WalletProviders initialState={walletState}>
            <PortalShell
            companyName={client?.company_name ?? "Your company"}
            homeCountry={client?.home_country ?? ""}
            email={session.email}>
                {children}
            </PortalShell>
        </WalletProviders>
    );
}
