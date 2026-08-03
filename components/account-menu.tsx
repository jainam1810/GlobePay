"use client";
// Who you are signed in as, and the three things you might want to do about it.
//
// One component with two triggers, because the menu is the same menu: a compact
// avatar in the header, and a full row at the foot of the sidebar. Built on
// Radix DropdownMenu so focus, Escape, arrow keys and the aria wiring come from
// a library that has already got them right.
//
// Signing out and disconnecting a wallet are deliberately different things, and
// the menu says so. Signing out ends your GlobePay session. Disconnecting drops
// the browser's link to your wallet — it moves no money and cancels nothing, but
// you cannot approve a payroll until you reconnect, so it asks first.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { useAccount, useDisconnect } from "wagmi";
import { LogOut, Settings, Unplug, MoreVertical } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import Confirm from "@/components/confirm";

export type AccountRole = "globepay_admin" | "client";

const ROLE_LABEL: Record<AccountRole, string> = {
    globepay_admin: "GlobePay admin",
    client: "Client",
};

/** First letter of the address someone signs in with — no name is on file. */
const initial = (email: string | null) => (email?.trim()?.[0] ?? "?").toUpperCase();

function Avatar({ email, size = 32 }: { email: string | null; size?: number }) {
    return (
        <span
            aria-hidden
            style={{ width: size, height: size, fontSize: size * 0.42 }}
            className="grid shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
        >
            {initial(email)}
        </span>
    );
}

export default function AccountMenu({
    email, role, settingsHref, variant = "avatar",
}: {
    email: string | null;
    role: AccountRole;
    /** Omitted where no settings page serves this role, rather than linking nowhere. */
    settingsHref?: string;
    variant?: "avatar" | "row";
}) {
    const router = useRouter();
    const { isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const [askDisconnect, setAskDisconnect] = useState(false);

    async function signOut() {
        await getSupabaseBrowser().auth.signOut();
        router.replace("/login");
    }

    const item = "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text-dim)] outline-none transition data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-[var(--text)]";

    return (
        <>
            <DM.Root>
                <DM.Trigger asChild>
                    {variant === "row" ? (
                        <button
                            aria-label="Account menu"
                            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        >
                            <Avatar email={email} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-[var(--text)]">
                                    {email ?? "Signed in"}
                                </span>
                                <span className="block text-[11px] text-[var(--text-faint)]">{ROLE_LABEL[role]}</span>
                            </span>
                            <MoreVertical size={15} className="shrink-0 text-[var(--text-faint)]" />
                        </button>
                    ) : (
                        <button
                            aria-label="Account menu"
                            className="rounded-full transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        >
                            <Avatar email={email} size={34} />
                        </button>
                    )}
                </DM.Trigger>

                <DM.Portal>
                    <DM.Content
                        align="end"
                        sideOffset={8}
                        collisionPadding={12}
                        className="anim-pop z-[80] w-60 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)]"
                    >
                        <div className="flex items-center gap-2.5 px-2.5 py-2">
                            <Avatar email={email} size={30} />
                            <span className="min-w-0">
                                <span className="block truncate text-[13px] font-medium">{email ?? "Signed in"}</span>
                                <span className="block text-[11px] text-[var(--text-faint)]">{ROLE_LABEL[role]}</span>
                            </span>
                        </div>
                        <DM.Separator className="my-1.5 h-px bg-[var(--border)]" />

                        {settingsHref && (
                            <DM.Item asChild>
                                <Link href={settingsHref} className={item}>
                                    <Settings size={15} strokeWidth={1.8} />
                                    Settings
                                </Link>
                            </DM.Item>
                        )}

                        {/* Only offered when there is a connection to drop. */}
                        {isConnected && (
                            <DM.Item
                                className={item}
                                // Radix restores focus to the trigger as it closes;
                                // opening the dialog in the same tick fights that,
                                // so it is handed to the next one.
                                onSelect={(e) => { e.preventDefault(); setTimeout(() => setAskDisconnect(true), 0); }}
                            >
                                <Unplug size={15} strokeWidth={1.8} />
                                Disconnect wallet
                            </DM.Item>
                        )}

                        <DM.Item className={item} onSelect={signOut}>
                            <LogOut size={15} strokeWidth={1.8} />
                            Sign out
                        </DM.Item>
                    </DM.Content>
                </DM.Portal>
            </DM.Root>

            <Confirm
                open={askDisconnect}
                onOpenChange={setAskDisconnect}
                title="Disconnect your wallet?"
                confirmLabel="Disconnect"
                danger
                onConfirm={() => disconnect()}
                body={
                    <>
                        This only ends the link between GlobePay and your wallet in this browser.
                        No money moves, and nothing already paid is affected.
                        <span className="mt-2 block">
                            You&apos;ll need to reconnect before you can approve another payroll.
                        </span>
                    </>
                }
            />
        </>
    );
}
