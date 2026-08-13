"use client";
// What is behind the tick, for the day somebody asks.
//
// Opened from the tick itself, because that is the thing being questioned. It
// shows the sentence the freelancer signed word for word, the signature, and
// when — and re-checks the signature against their address as it opens, so the
// answer is "it checks out now" rather than "our records say so".
//
// The message is shown in full rather than summarised on purpose: what was
// agreed to is the evidence, and a paraphrase of a signed statement is not the
// signed statement.
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Loader2, ShieldCheck, TriangleAlert, X } from "lucide-react";
import type { VerificationProof } from "@/app/api/verify-wallet/proof/route";

function CopyLine({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</span>
                <button
                    onClick={() => navigator.clipboard.writeText(value).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                    })}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-faint)] transition hover:text-[var(--text)]"
                >
                    {copied ? <Check size={11} className="text-[var(--ok)]" /> : <Copy size={11} />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <div className={`max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] ${mono ? "font-mono" : ""}`}>
                {value}
            </div>
        </div>
    );
}

/**
 * Controlled rather than driven by Dialog.Trigger.
 *
 * The tick is already wrapped in our Tooltip, which takes `children` as a plain
 * prop — so a Trigger cloning it had its onClick quietly dropped and the tick
 * did nothing. Owning `open` sidesteps the composition entirely.
 */
export default function VerificationProofDialog({ contractorId, open, onOpenChange }: {
    contractorId: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const [proof, setProof] = useState<VerificationProof | null>(null);
    const [err, setErr] = useState<string | null>(null);
    // Nothing yet and nothing wrong means the request is still out. Derived
    // rather than a third state to keep in step with the other two.
    const loading = !proof && !err;

    // Fetched on mount. The caller only renders this while it is open, so each
    // opening is a fresh mount and a fresh check — which is the point: a pass
    // recorded months ago is exactly what this is meant to replace.
    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const r = await fetch(`/api/verify-wallet/proof?contractorId=${contractorId}`);
                const j = await r.json();
                if (!r.ok) throw new Error(j?.error || "Couldn't load the proof");
                if (live) setProof(j.proof);
            } catch (e) {
                if (live) setErr(e instanceof Error ? e.message : "Couldn't load the proof");
            }
        })();
        return () => { live = false; };
    }, [contractorId]);

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[92] bg-black/70 backdrop-blur-[2px]" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-[93] w-[min(calc(100vw-2rem),560px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <Dialog.Title className="text-[15px] font-medium">Wallet confirmation</Dialog.Title>
                            <Dialog.Description className="mt-1 text-[13px] text-[var(--text-dim)]">
                                Proof this wallet belongs to the person you&rsquo;re paying.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button aria-label="Close" className="rounded-lg p-1 text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
                                <X size={16} />
                            </button>
                        </Dialog.Close>
                    </div>

                    {loading && (
                        <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-dim)]">
                            <Loader2 size={14} className="animate-spin" /> Re-checking the signature…
                        </div>
                    )}
                    {err && <p className="mt-4 text-[13px] text-[var(--danger)]">{err}</p>}

                    {proof && (
                        <div className="mt-4 space-y-4">
                            {/* The live result, not the stored flag. */}
                            <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] ${proof.stillValid
                                ? "border-[var(--ok-line)] bg-[var(--ok-soft)] text-[var(--ok)]"
                                : "border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn)]"}`}>
                                {proof.stillValid
                                    ? <ShieldCheck size={15} className="mt-px shrink-0" />
                                    : <TriangleAlert size={15} className="mt-px shrink-0" />}
                                <span>
                                    {proof.stillValid
                                        ? "Checked just now: the signature matches this wallet."
                                        : proof.note || "This couldn't be confirmed."}
                                </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Freelancer</div>
                                    <div className="mt-1 text-[13px]">{proof.name}</div>
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Confirmed</div>
                                    <div className="mt-1 text-[13px]">
                                        {proof.verifiedAt
                                            ? new Date(proof.verifiedAt).toLocaleString("en-GB", {
                                                day: "numeric", month: "long", year: "numeric",
                                                hour: "2-digit", minute: "2-digit",
                                            })
                                            : "—"}
                                    </div>
                                </div>
                            </div>

                            <CopyLine label="Wallet" value={proof.wallet} />
                            {proof.message && <CopyLine label="What they signed" value={proof.message} mono={false} />}
                            {proof.signature && <CopyLine label="Signature" value={proof.signature} />}

                            <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
                                Anyone can check this without us: recovering the signer from the message and
                                signature should give the wallet above. Nothing here is secret — a signature
                                proves who signed, and grants no permission to spend.
                            </p>
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
