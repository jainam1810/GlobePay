"use client";
// The page a freelancer lands on to confirm their payout wallet.
//
// Written for someone who has never used GlobePay and may be wary of a link
// asking them to connect a wallet — so it says, before anything else, that
// nothing moves and no key is shared. The one action is a signature, which is
// free and reversible in the sense that it authorises nothing but the sentence
// itself.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { pickable, connectorLabel } from "@/components/connect-button";
import { AlertCircle, CheckCircle2, PenLine, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/landing/nav";
import { Button, Spinner } from "@/components/ui/kit";

type Ask = {
    name: string;
    company: string;
    wallet: string;
    message: string;
    alreadyVerified: boolean;
};

export default function VerifyPage() {
    return (
        <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner size={20} label="Loading" /></div>}>
            <Verify />
        </Suspense>
    );
}

function Verify() {
    const token = useSearchParams()?.get("token") ?? "";
    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    // connectors[0] is the Safe connector — it is registered first and only
    // works inside the Safe app's iframe, so in an ordinary browser this button
    // fired a connection that could never resolve and looked like nothing
    // happened. pickable() drops it and keeps the wallets that can actually
    // answer, which is the same rule the header's Connect Wallet uses.
    const usable = pickable(connectors);
    const { signMessageAsync } = useSignMessage();

    const [ask, setAsk] = useState<Ask | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        // A missing token is derived below rather than set from here — a
        // synchronous setState in an effect body cascades renders.
        if (!token) return;
        fetch(`/api/verify-wallet?token=${encodeURIComponent(token)}`)
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setAsk(j) : setErr(j?.error || "This link isn't valid"))
            .catch(() => setErr("Couldn't load this link — check your connection and try again."));
    }, [token]);

    const problem = token ? err : "This link is missing its code. Ask whoever sent it for a new one.";

    const wrongWallet = !!(address && ask && address.toLowerCase() !== ask.wallet.toLowerCase());

    async function sign() {
        if (!ask) return;
        setBusy(true); setErr(null);
        try {
            const signature = await signMessageAsync({ message: ask.message });
            const r = await fetch("/api/verify-wallet", {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, signature, address }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "That didn't verify");
            setDone(true);
        } catch (e) {
            const m = e instanceof Error ? e.message : "That didn't verify";
            setErr(/user rejected|denied/i.test(m) ? "You cancelled the signature — nothing happened." : m);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="grid min-h-screen place-items-center px-5 py-12">
            <div className="w-full max-w-lg">
                <div className="flex justify-center"><Logo size={32} /></div>

                {done || ask?.alreadyVerified ? (
                    <div className="card mt-8 p-7 text-center">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--ok-soft)] text-[var(--ok)]">
                            <CheckCircle2 size={22} />
                        </div>
                        <h1 className="mt-4 text-[20px] font-medium tracking-[-0.02em]">Wallet confirmed</h1>
                        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-dim)]">
                            Thanks{ask ? `, ${ask.name.split(" ")[0]}` : ""} — your payout wallet is confirmed.
                            {ask ? ` ${ask.company} will see it as verified when they pay you.` : ""} You can close this page.
                        </p>
                    </div>
                ) : !ask ? (
                    <div className="card mt-8 p-7">
                        {problem
                            ? <div className="flex items-start gap-2.5 text-[14px] text-[var(--danger)]">
                                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {problem}
                            </div>
                            : <div className="grid place-items-center py-6"><Spinner size={18} label="Loading your request" /></div>}
                    </div>
                ) : (
                    <div className="card mt-8 overflow-hidden">
                        <div className="p-7">
                            <h1 className="text-[22px] font-medium tracking-[-0.025em]">Confirm your payout wallet</h1>
                            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-dim)]">
                                <span className="text-[var(--text)]">{ask.company}</span> is about to pay you through
                                GlobePay. Confirming the wallet is yours means they can be certain the money
                                reaches you and not someone else.
                            </p>

                            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                                <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Wallet on file</div>
                                <div className="mt-1 break-all font-mono text-[13px]">{ask.wallet}</div>
                                <div className="mt-1 text-[12px] text-[var(--text-dim)]">for {ask.name}</div>
                            </div>

                            {/* Said before they're asked to do anything, because a link
                                asking you to connect a wallet deserves suspicion. */}
                            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--ok-line)] bg-[var(--ok-soft)] p-3.5">
                                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                                <p className="text-[12px] leading-relaxed text-[var(--text-dim)]">
                                    <span className="text-[var(--text)]">This moves no money and costs nothing.</span> You&rsquo;ll
                                    sign a sentence to prove the wallet is yours. Your private key never leaves your
                                    wallet, and the signature gives nobody permission to spend anything.
                                </p>
                            </div>

                            {err && (
                                <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-[var(--danger)]">
                                    <AlertCircle size={15} className="mt-px shrink-0" /> <span>{err}</span>
                                </div>
                            )}

                            <div className="mt-6">
                                {!isConnected ? (
                                    <div className="space-y-2">
                                        {usable.length === 0 ? (
                                            <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-soft)] px-3.5 py-3 text-[13px] text-[var(--warn)]">
                                                No wallet found in this browser. Install MetaMask, or open this link in
                                                your wallet&rsquo;s own browser, and the button will appear.
                                            </div>
                                        ) : usable.length === 1 ? (
                                            <Button size="lg" className="w-full" loading={isPending}
                                                onClick={() => connect({ connector: usable[0] })}>
                                                <Wallet size={16} /> Connect your wallet
                                            </Button>
                                        ) : (
                                            // More than one extension announced itself, so name them
                                            // rather than guessing which one they meant.
                                            usable.map((c) => (
                                                <Button key={c.uid} size="lg" variant="subtle" className="w-full"
                                                    loading={isPending} onClick={() => connect({ connector: c })}>
                                                    <Wallet size={16} /> Connect with {connectorLabel(c)}
                                                </Button>
                                            ))
                                        )}
                                    </div>
                                ) : wrongWallet ? (
                                    <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-soft)] px-3.5 py-3 text-[13px] text-[var(--warn)]">
                                        You&rsquo;re connected as <span className="font-mono">{address?.slice(0, 10)}…</span>,
                                        which isn&rsquo;t the wallet above. Switch accounts in your wallet, or ask
                                        {" "}{ask.company} to update the address they have for you.
                                    </div>
                                ) : (
                                    <Button size="lg" className="w-full" loading={busy} onClick={sign}>
                                        <PenLine size={16} /> {busy ? "Waiting for your wallet…" : "Sign to confirm"}
                                    </Button>
                                )}
                            </div>
                        </div>

                        <details className="border-t border-[var(--border)] bg-[var(--surface-2)] px-7 py-4">
                            <summary className="cursor-pointer text-[12px] text-[var(--text-dim)] transition hover:text-white">
                                See exactly what you&rsquo;ll be signing
                            </summary>
                            <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--text-faint)]">
                                {ask.message}
                            </pre>
                        </details>
                    </div>
                )}

                <p className="mt-5 text-center text-[11px] text-[var(--text-faint)]">
                    GlobePay never asks for a seed phrase or private key. If anything asks you for one, it isn&rsquo;t us.
                </p>
            </div>
        </div>
    );
}
