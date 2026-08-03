"use client";
// How much to trust the address in front of you, at a glance.
//
// This is the part worth stealing from Confirmation of Payee. The value of CoP
// isn't the check — it's that the payer *sees a different thing* for a matched
// payee than an unmatched one, and behaves accordingly. Before this, a wallet
// somebody had cryptographically proved and a wallet typed in from a WhatsApp
// message looked identical on screen.
import { ShieldCheck, ShieldQuestion, Shield } from "lucide-react";
import { Tooltip } from "@/components/ui/overlays";
import { walletTrust, TRUST_COPY, type TrustInput } from "@/lib/wallet-verification";

const STYLE = {
    verified: { icon: ShieldCheck, cls: "text-[var(--ok)] bg-[var(--ok-soft)] border-[var(--ok-line)]" },
    recognised: { icon: Shield, cls: "text-[var(--accent)] bg-[var(--accent-soft)] border-[var(--accent-line)]" },
    unverified: { icon: ShieldQuestion, cls: "text-[var(--text-faint)] bg-[var(--surface-2)] border-[var(--border-strong)]" },
} as const;

export default function WalletBadge({ contractor, compact = false }: {
    contractor: TrustInput;
    /** Icon only — for dense rows where the word would crowd the name. */
    compact?: boolean;
}) {
    const trust = walletTrust(contractor);
    const { icon: Icon, cls } = STYLE[trust];
    const { label, hint } = TRUST_COPY[trust];

    return (
        <Tooltip content={hint}>
            <span
                className={`inline-flex shrink-0 cursor-help items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
                // The word is the label for anyone who can't see the colour, and
                // the icon differs per state too — status is never colour alone.
                aria-label={`${label}. ${hint}`}
            >
                <Icon size={11} aria-hidden />
                {!compact && label}
            </span>
        </Tooltip>
    );
}
