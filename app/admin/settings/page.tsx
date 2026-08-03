import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/auth";
import { EmailSection, PasswordSection, HelpSection } from "@/components/settings-account";
import pkg from "@/package.json";

// Operators get the account half only. There is no company profile or payout
// wallet here because an admin has neither — GlobePay prepares payroll, it does
// not pay it, so no wallet on this side ever signs anything.
export default async function AdminSettingsPage() {
    const session = await getSessionInfo();
    if (!session) redirect("/login");
    if (session.role !== "globepay_admin") redirect("/portal");

    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Your account</div>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Settings</h1>
                <p className="mt-2 max-w-md text-[var(--text-dim)]">How you sign in to the operator console.</p>
            </div>

            <div className="space-y-4">
                <EmailSection current={session.email} />
                <PasswordSection email={session.email} />
                <HelpSection version={pkg.version} messagesHref="/admin/messages" />
            </div>
        </div>
    );
}
