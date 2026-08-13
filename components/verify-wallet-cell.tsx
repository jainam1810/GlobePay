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
import VerificationProofDialog from "@/components/verification-proof";

/**
 * A green tick beside the name, and nothing at all when unverified.
 *
 * Deliberately just the tick. A badge reading "Unverified" next to every
 * freelancer who simply hasn't got round to it turns the roster into a wall of
 * warnings, and a warning shown that often stops being read. The absence of a
 * tick is the signal; the tick is the reassurance.
 */
export function VerifiedTick({ contractor }: { contractor: TrustInput & { id?: string } }) {
    const [open, setOpen] = useState(false);
    if (walletTrust(contractor) !== "verified") return null;

    const id = contractor.id;
    return (
        <>
            <Tooltip content={id ? "Confirmed by the freelancer — click to see the proof." : "Confirmed by the freelancer."}>
                <button
                    type="button"
                    onClick={() => id && setOpen(true)}
                    aria-label={id ? "Wallet verified — see the proof" : "Wallet verified by the freelancer"}
                    className={`inline-flex shrink-0 text-[var(--ok)] transition hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${id ? "cursor-pointer" : "cursor-help"}`}
                >
                    <ShieldCheck size={14} aria-hidden />
                </button>
            </Tooltip>
            {/* Mounted only while open, so every opening re-checks rather than
                showing what it found last time. */}
            {id && open && <VerificationProofDialog contractorId={id} open onOpenChange={setOpen} />}
        </>
    );
}

/**
 * The action: mint a single-use link and put it on the clipboard.
 *
 * Which row is showing "Link copied" is owned by the list, not by each row.
 * There is one clipboard, so only one link can be on it — with the flag held
 * per row, copying a second while the first was still counting down left two
 * rows both claiming to be the thing you were about to paste.
 */
export default function VerifyWalletCell({ contractor, onError, copiedId, onCopied }: {
    contractor: TrustInput & { id: string; name: string };
    onError?: (m: string) => void;
    copiedId?: string | null;
    onCopied?: (id: string | null) => void;
}) {
    const [busy, setBusy] = useState(false);
    const copied = copiedId === contractor.id;

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
            onCopied?.(contractor.id);
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
