import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { EmailSection, PasswordSection, SessionsSection, HelpSection } from "@/components/settings-account";
import { CompanySection, WalletSection, type ClientSettings } from "@/components/settings-company";
import pkg from "@/package.json";

// Server-rendered so the form starts filled from the database rather than
// flashing empty and populating from a fetch — settings you cannot read for the
// first second are settings you distrust.
export default async function PortalSettingsPage() {
    const session = await getSessionInfo();
    if (!session?.clientId) redirect("/login");

    const { data } = await getSupabase()
        .from("clients")
        .select("id, company_name, home_country, contact_email, wallet_address")
        .eq("id", session.clientId)
        .single();

    const client = (data ?? {
        id: session.clientId,
        company_name: "",
        home_country: "United Kingdom",
        contact_email: null,
        wallet_address: null,
    }) as ClientSettings;

    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Your account</div>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
                <p className="mt-2 max-w-md text-[var(--text-dim)]">
                    Your company details, the wallet that approves payroll, and how you sign in.
                </p>
            </div>

            {/* Ordered by how often it is needed and how much it costs to get
                wrong: the company details are routine, the wallet decides who
                can pay, and sign-in lives at the bottom where settings pages
                have taught people to look for it. */}
            <div className="space-y-4">
                <CompanySection initial={client} />
                <WalletSection initial={client} />
                <EmailSection current={session.email} />
                <PasswordSection email={session.email} />
                <SessionsSection />
                <HelpSection version={pkg.version} />
            </div>
        </div>
    );
}
