"use client";
// "Prove this wallet is yours" — the link, and the tick once they have.
//
// This lives with the client rather than only with GlobePay, because the client
// is the one who knows the freelancer. GlobePay has no relationship with them
// and no address to send anything to; the client already has a channel they
// both trust. So the button mints a link and copies it, and the client sends it
// however they normally talk — WhatsApp, email, Slack.
import { useState } from "react";
import { Check, Loader2, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Tooltip } from "@/components/ui/overlays";
import { walletTrust, type TrustInput } from "@/lib/wallet-verification";

/**
 * A green tick beside the name, and nothing at all when unverified.
 *
 * Deliberately just the tick. A badge reading "Unverified" next to every
 * freelancer who simply hasn't got round to it turns the roster into a wall of
 * warnings, and a warning shown that often stops being read. The absence of a
 * tick is the signal; the tick is the reassurance.
 */
export function VerifiedTick({ contractor }: { contractor: TrustInput }) {
    if (walletTrust(contractor) !== "verified") return null;
    return (
        <Tooltip content="This freelancer signed with this wallet, so it's provably theirs.">
            <span
                tabIndex={0}
                role="img"
                aria-label="Wallet verified by the freelancer"
                className="inline-flex shrink-0 cursor-help text-[var(--ok)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
                <ShieldCheck size={14} aria-hidden />
            </span>
        </Tooltip>
    );
}

/** The action: mint a single-use link and put it on the clipboard. */
export default function VerifyWalletCell({ contractor, onError }: {
    contractor: TrustInput & { id: string; name: string };
    onError?: (m: string) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    if (walletTrust(contractor) === "verified") return null;

    async function mint() {
        setBusy(true);
        try {
            const r = await fetch("/api/verify-wallet", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contractorId: contractor.id }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Couldn't create a link");
            await navigator.clipboard.writeText(`${window.location.origin}/verify?token=${j.token}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 4000);
        } catch (e) {
            onError?.(e instanceof Error ? e.message : "Couldn't create a link");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Tooltip content={copied
            ? "Link copied — send it to them however you normally talk"
            : `Copy a link for ${contractor.name} to confirm this wallet is theirs`}>
            <button
                onClick={mint}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] text-[var(--text-faint)] transition hover:border-[var(--accent-line)] hover:text-[var(--accent)] disabled:opacity-50"
            >
                {busy ? <Loader2 size={10} className="animate-spin" />
                    : copied ? <Check size={10} className="text-[var(--ok)]" />
                        : <ShieldQuestion size={10} />}
                {copied ? "Link copied" : "Get verify link"}
            </button>
        </Tooltip>
    );
}
