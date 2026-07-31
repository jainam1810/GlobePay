"use client";
// Client portal home: the ONE job — confirm pending payroll with one signature.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useWriteContract, useReadContract, usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { parseUnits, formatUnits, erc20Abi } from "viem";
import { Loader2, CheckCircle2, ShieldCheck, Send, AlertCircle, History, Wallet } from "lucide-react";
import { USDC_ADDRESS } from "@/lib/usdc";
import { DISPERSE_ADDRESS, disperseAbi } from "@/lib/disperse";
import { flagFor, avatarFor, truncate, formatUSD } from "@/lib/contractor-types";
import type { DbClient, PayrollRun } from "@/lib/clients";

// Testnet convention (as before): each recipient receives 1 test USDC on-chain;
// real USD amounts are shown for the business record.
const PER_PERSON = "1";
const APPROVE_CAP = "1000";

export default function PortalHome() {
    const { address, isConnected, chainId, connector } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();

    // A Safe multisig doesn't execute on signing — it *proposes*, then waits for
    // the other signers. So the hash we get back is a Safe transaction hash, not
    // an on-chain one, and waiting for a receipt would hang until co-signers act.
    //
    // Detect this from the chain, not the connector: a Safe reached over
    // WalletConnect reports type "walletConnect", so trusting the connector would
    // miss it. An address with bytecode is a smart account; an EOA has none.
    // Store *which* address was found to be a contract, so switching wallets
    // can't leave a stale "yes" behind while the new check is in flight.
    const [smartAccountAddr, setSmartAccountAddr] = useState<string | null>(null);
    useEffect(() => {
        if (!publicClient || !address) return;
        let live = true;
        publicClient.getCode({ address })
            .then((code) => { if (live && code && code !== "0x") setSmartAccountAddr(address); })
            .catch(() => { /* treat as a plain EOA */ });
        return () => { live = false; };
    }, [publicClient, address]);

    const viaSafe = connector?.type === "safe" || (!!address && smartAccountAddr === address);

    const [runs, setRuns] = useState<PayrollRun[] | null>(null);
    const [myClient, setMyClient] = useState<DbClient | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busyRun, setBusyRun] = useState<string | null>(null);
    const [phase, setPhase] = useState<"idle" | "approving" | "paying">("idle");
    const [doneRun, setDoneRun] = useState<string | null>(null);
    const [proposedRun, setProposedRun] = useState<string | null>(null);

    function load() {
        fetch("/api/payroll-runs")
            .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
            .then(({ ok, j }) => ok ? setRuns(j.runs || []) : setError(j?.error || "Failed to load"))
            .catch((e) => setError(e instanceof Error ? e.message : "Network error"));
        fetch("/api/clients").then((r) => r.json())
            .then((j) => setMyClient((j.clients || [])[0] ?? null))
            .catch(() => { });
    }
    useEffect(load, []);

    const pending = (runs || []).filter((r) => r.status === "pending_confirmation");
    const recent = (runs || []).filter((r) => r.status === "executed").slice(0, 3);
    const wrongNetwork = isConnected && chainId !== baseSepolia.id;
    const wrongWallet = !!(isConnected && address && myClient?.wallet_address &&
        address.toLowerCase() !== myClient.wallet_address.toLowerCase());

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: USDC_ADDRESS, abi: erc20Abi, functionName: "allowance",
        args: address ? [address, DISPERSE_ADDRESS] : undefined,
        query: { enabled: !!address && !!DISPERSE_ADDRESS },
    });
    // Polled, not just fetched once: with a Safe the payment is executed in the
    // Safe UI rather than here, so the only way this page sees the deduction is
    // to keep asking the chain.
    const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
        address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address, refetchInterval: 5000 },
    });

    async function confirmRun(run: PayrollRun) {
        if (!publicClient) return;
        setBusyRun(run.id); setError(null);
        try {
            const needed = parseUnits(String(run.line_items.length * Number(PER_PERSON)), 6);
            if (allowance === undefined || (allowance as bigint) < needed) {
                setPhase("approving");
                const approveHash = await writeContractAsync({
                    address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve",
                    args: [DISPERSE_ADDRESS, parseUnits(APPROVE_CAP, 6)],
                });
                // In a Safe the approval is itself queued for signatures. Queueing
                // the payout now would guarantee a revert — the allowance won't
                // exist when it executes. Stop here and let the signers act.
                if (viaSafe) {
                    setError("Step 1 of 2: the USDC authorisation is queued in your Safe. Once the other signers approve it, come back and propose the payroll itself.");
                    return;
                }
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                await refetchAllowance();
            }

            setPhase("paying");
            const recipients = run.line_items.map((li) => li.wallet as `0x${string}`);
            const amounts = run.line_items.map(() => parseUnits(PER_PERSON, 6));
            const hash = await writeContractAsync({
                address: DISPERSE_ADDRESS, abi: disperseAbi, functionName: "disperseToken",
                args: [USDC_ADDRESS, recipients, amounts],
            });

            // Multisig: the payroll is now queued in the Safe awaiting the other
            // signers. There's no receipt to wait for and nothing to file yet —
            // once the Safe executes, the payment is picked up from the chain.
            if (viaSafe) {
                setProposedRun(run.id);
                return;
            }

            await publicClient.waitForTransactionReceipt({ hash });

            // Tell the server: it verifies the tx on-chain and files the receipt.
            const r = await fetch(`/api/payroll-runs/${run.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "executed", txHash: hash }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Payment sent, but filing the receipt failed — it will appear after the next import.");
            setDoneRun(run.id);
            await refetchBalance();   // show the deduction immediately
            load();
        } catch (e) {
            setError(humanError(e));
        } finally {
            setBusyRun(null); setPhase("idle");
        }
    }

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up">
                <div className="kicker">Your payroll</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">
                    {pending.length > 0 ? "Payroll ready for your confirmation" : "All caught up"}
                </h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    GlobePay prepares everything. You approve with <span className="text-[var(--text)]">one signature from your own wallet</span> — funds go straight from you to your freelancers. GlobePay never holds your money.
                </p>
            </div>

            <TreasuryBalance
                address={address}
                isConnected={isConnected}
                balance={usdcBalance as bigint | undefined}
                viaSafe={viaSafe}
            />

            {error && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] text-[#ff6b6b] px-4 py-3 text-sm flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            )}
            {doneRun && (
                <div className="fade-up notice mt-6 rounded-xl px-4 py-3 text-sm flex items-center gap-2 flex-wrap">
                    <CheckCircle2 size={16} /> Payroll confirmed — everyone paid in one transaction.
                    <Link className="underline underline-offset-2 font-medium" href="/portal/payments">View receipt →</Link>
                </div>
            )}
            {proposedRun && (
                <div className="fade-up mt-6 rounded-xl border border-[rgba(245,177,76,0.3)] bg-[rgba(245,177,76,0.08)] text-[#f5b14c] px-4 py-3 text-sm flex items-start gap-2">
                    <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                    <span>
                        <span className="font-medium">Queued in your Safe.</span> Your signature is recorded — the payroll
                        executes once the remaining signers approve it in the Safe. Nothing has moved yet, and it stays
                        listed here until it does.
                    </span>
                </div>
            )}

            {runs === null && !error && (
                <div className="fade-up mt-8 card p-10 flex items-center justify-center gap-2 text-[var(--text-dim)] text-sm">
                    <Loader2 size={15} className="animate-spin" /> Loading…
                </div>
            )}

            {pending.map((run) => (
                <div key={run.id} className="fade-up delay-1 card mt-8 overflow-hidden">
                    <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-[var(--border)] flex-wrap gap-2">
                        <div>
                            <h2 className="font-display text-lg font-semibold">{run.note || "Payroll"}</h2>
                            <div className="text-[11px] font-mono text-[var(--text-faint)] mt-0.5">
                                Prepared {new Date(run.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {run.line_items.length} freelancer{run.line_items.length === 1 ? "" : "s"}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-xl font-semibold">{formatUSD(Number(run.total_amount))}</div>
                            <div className="text-[10px] text-[var(--text-faint)] uppercase font-mono">total this run</div>
                        </div>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                        {run.line_items.map((li) => {
                            const initials = li.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                            const [g1, g2] = avatarFor(li.name);
                            return (
                                <div key={li.contractor_id} className="flex items-center gap-3 px-5 md:px-6 py-3">
                                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display font-semibold text-xs text-[#04130d]" style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>{initials}</div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium truncate">{li.name} <span className="ml-1">{flagFor(li.country)}</span></div>
                                        <div className="font-mono text-[10px] text-[var(--text-faint)]">{truncate(li.wallet)}</div>
                                    </div>
                                    <div className="font-mono text-sm font-semibold">{formatUSD(li.amount)}</div>
                                </div>
                            );
                        })}
                    </div>
                    {(() => {
                        const neededUnits = BigInt(run.line_items.length) * 1_000_000n; // 1 test USDC per person
                        const insufficientUsdc = isConnected && usdcBalance !== undefined && (usdcBalance as bigint) < neededUnits;
                        return (
                            <>
                                <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/30 px-5 md:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="text-[11px] text-[var(--text-dim)] max-w-sm leading-relaxed">
                                        <ShieldCheck size={13} className="inline mr-1 text-[var(--accent)]" />
                                        {viaSafe
                                            ? "This queues the payroll in your Safe for the other signers to approve. If anything fails, the whole payment rolls back — no one gets half-paid."
                                            : "One signature pays everyone at once. If anything fails, the whole payment rolls back — no one gets half-paid."}
                                    </div>
                                    <button onClick={() => confirmRun(run)}
                                        disabled={!isConnected || wrongNetwork || wrongWallet || insufficientUsdc || busyRun !== null || !DISPERSE_ADDRESS}
                                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                                        {busyRun === run.id
                                            ? <><Loader2 size={16} className="animate-spin" /> {phase === "approving" ? "Authorising…" : viaSafe ? "Queueing in Safe…" : "Paying everyone…"}</>
                                            : <><Send size={16} /> {viaSafe ? `Propose payroll (${run.line_items.length})` : `Confirm & pay ${run.line_items.length}`}</>}
                                    </button>
                                </div>
                                {!isConnected && <PortalBanner>Connect your company wallet (top right) to confirm.</PortalBanner>}
                                {wrongNetwork && <PortalBanner warn>Wrong network — switch to Base Sepolia (top right).</PortalBanner>}
                                {wrongWallet && (
                                    <PortalBanner warn>
                                        This isn&rsquo;t your company wallet. You&rsquo;re connected as <span className="font-mono">{truncate(address!)}</span> but
                                        payroll is funded from <span className="font-mono">{truncate(myClient!.wallet_address!)}</span> — switch accounts in your wallet.
                                    </PortalBanner>
                                )}
                                {!wrongWallet && insufficientUsdc && (
                                    <PortalBanner warn>
                                        The connected wallet doesn&rsquo;t hold enough test USDC to fund this payroll ({run.line_items.length} USDC needed on Base Sepolia).
                                    </PortalBanner>
                                )}
                            </>
                        );
                    })()}
                </div>
            ))}

            {runs !== null && pending.length === 0 && (
                <div className="fade-up delay-1 mt-8 card p-10 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4"><CheckCircle2 size={20} /></div>
                    <div className="font-display text-xl font-semibold">Nothing waiting for you</div>
                    <p className="text-[var(--text-dim)] text-sm mt-2">When GlobePay prepares your next payroll, it&rsquo;ll appear here for one-click confirmation.</p>
                </div>
            )}

            {recent.length > 0 && (
                <div className="fade-up delay-2 card mt-8 overflow-hidden">
                    <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-[var(--border)]">
                        <h2 className="font-display text-lg font-semibold">Recent payrolls</h2>
                        <Link href="/portal/payments" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition inline-flex items-center gap-1"><History size={12} /> All receipts →</Link>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                        {recent.map((r) => (
                            <div key={r.id} className="flex items-center gap-4 px-5 md:px-6 py-3.5">
                                <CheckCircle2 size={15} className="text-[var(--accent)] shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium">{r.note || `${r.line_items.length} freelancers paid`}</div>
                                    <div className="text-[11px] font-mono text-[var(--text-faint)]">{r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}</div>
                                </div>
                                <div className="font-mono text-sm font-semibold">{formatUSD(Number(r.total_amount))}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// The money the client is about to spend, read live from the chain. This is
// what makes a payment feel real in the demo: the number visibly drops when the
// transfer lands, and it keeps polling so a Safe execution (which happens in
// the Safe UI, not here) still shows up.
function TreasuryBalance({ address, isConnected, balance, viaSafe }: {
    address?: `0x${string}`;
    isConnected: boolean;
    balance?: bigint;
    viaSafe: boolean;
}) {
    if (!isConnected || !address) return null;
    const usdc = balance !== undefined ? Number(formatUnits(balance, 6)) : null;

    return (
        <div className="fade-up delay-1 card mt-6 px-5 md:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(47,230,168,0.08)] border border-[rgba(47,230,168,0.2)] text-[var(--accent)]">
                    <Wallet size={17} />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">
                        {viaSafe ? "Company treasury · Safe" : "Company wallet"}
                    </div>
                    <div className="font-mono text-sm text-[var(--text-dim)] truncate">{truncate(address)}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="flex items-baseline gap-1.5 justify-end">
                    <span className="font-mono text-2xl font-semibold text-[var(--accent)]">
                        {usdc === null ? "…" : usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs text-[var(--text-dim)]">USDC</span>
                </div>
                <div className="text-[10px] text-[var(--text-faint)] mt-0.5">available to pay · updates live</div>
            </div>
        </div>
    );
}

function PortalBanner({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
    const cls = warn
        ? "border-[rgba(245,177,76,0.3)] bg-[rgba(245,177,76,0.08)] text-[#f5b14c]"
        : "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)]";
    return <div className={`mx-5 md:mx-6 mb-4 rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function humanError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (/rejected|denied/i.test(msg)) return "You declined the request in your wallet — nothing was sent.";
    if (/insufficient/i.test(msg)) return "Not enough test USDC or ETH in the wallet — top up from the faucet.";
    if (/allowance|transferFrom/i.test(msg)) return "Authorisation needed — try again and approve both prompts.";
    return "Something went wrong. " + msg.slice(0, 140);
}
