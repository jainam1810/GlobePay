"use client";
import { useState } from "react";
import { useAccount, useWriteContract, useReadContract, usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { parseUnits, erc20Abi } from "viem";
import { Send, Users, ExternalLink, Loader2, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { contractors, truncate, formatUSD, type Contractor } from "@/lib/mock-data";
import { USDC_ADDRESS } from "@/lib/usdc";
import { DISPERSE_ADDRESS, disperseAbi } from "@/lib/disperse";

const PER_PERSON = "1";    // test USDC per recipient
const APPROVE_CAP = "1000"; // one-time approval cap (USDC)

type Phase = "idle" | "approving" | "dispersing" | "done" | "failed";

export default function PayrollPage() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [err, setErr] = useState<string | null>(null);

  const total = contractors.reduce((s, c) => s + c.monthlyAmount, 0);
  const countries = new Set(contractors.map((c) => c.country)).size;
  const wrongNetwork = isConnected && chainId !== baseSepolia.id;
  const totalUnits = parseUnits(String(contractors.length * Number(PER_PERSON)), 6);
  const configured = !!DISPERSE_ADDRESS;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, DISPERSE_ADDRESS] : undefined,
    query: { enabled: !!address && configured },
  });

  const approved = allowance !== undefined && (allowance as bigint) >= totalUnits;
  const busy = phase === "approving" || phase === "dispersing";

  async function authorise() {
    if (!publicClient) return;
    setErr(null); setPhase("approving");
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve",
        args: [DISPERSE_ADDRESS, parseUnits(APPROVE_CAP, 6)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchAllowance();
      setPhase("idle");
    } catch (e) { setErr(humanError(e)); setPhase("idle"); }
  }

  async function runPayroll() {
    if (!publicClient) return;
    setErr(null); setPhase("dispersing"); setTxHash(undefined);
    try {
      const recipients = contractors.map((c) => c.wallet as `0x${string}`);
      const amounts = contractors.map(() => parseUnits(PER_PERSON, 6));
      const hash = await writeContractAsync({
        address: DISPERSE_ADDRESS, abi: disperseAbi, functionName: "disperseToken",
        args: [USDC_ADDRESS, recipients, amounts],
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchAllowance();
      setPhase("done");
    } catch (e) { setErr(humanError(e)); setPhase("failed"); }
  }

  const rowState: "idle" | "batch" | "paid" =
    phase === "dispersing" ? "batch" : phase === "done" ? "paid" : "idle";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="fade-up flex items-center gap-3">
        <div className="kicker">Payroll · May 2026</div>
        <span className="badge-testnet"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Testnet</span>
        <span className="badge-testnet"><Zap size={10} /> Batch · 1 tx</span>
      </div>

      <div className="fade-up flex flex-col gap-6 md:flex-row md:items-end md:justify-between mt-2">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">Run this month&rsquo;s payroll</h1>
          <p className="text-[var(--text-dim)] mt-2 max-w-md">
            Everyone paid in <span className="text-[var(--text)]">one transaction, one signature</span> via your Disperse contract. Non-custodial — the contract moves your USDC, never holds it.
          </p>
        </div>

        {!approved ? (
          <button className="btn-primary self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={authorise} disabled={!isConnected || wrongNetwork || busy || !configured}>
            {phase === "approving" ? <><Loader2 size={18} className="animate-spin" /> Authorising…</> : <><ShieldCheck size={18} /> Authorise batch payroll</>}
          </button>
        ) : (
          <button className="btn-primary self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={runPayroll} disabled={!isConnected || wrongNetwork || busy}>
            {phase === "dispersing" ? <><Loader2 size={18} className="animate-spin" /> Paying everyone…</> : <><Send size={18} /> Run Payroll · {formatUSD(total)}</>}
          </button>
        )}
      </div>

      {!configured && <Banner tone="warn">Set <span className="font-mono">NEXT_PUBLIC_DISPERSE_ADDRESS</span> in .env.local and restart the dev server.</Banner>}
      {configured && !isConnected && <Banner>Connect your wallet (top right) to run payroll.</Banner>}
      {wrongNetwork && <Banner tone="warn">Wrong network — switch to Base Sepolia (top right).</Banner>}
      {configured && isConnected && !wrongNetwork && !approved && phase !== "approving" && (
        <Banner>One-time setup: authorise the contract to move your USDC (up to {APPROVE_CAP}). Revocable anytime. After this, payroll is a single click — forever.</Banner>
      )}
      {err && <Banner tone="warn">{err}</Banner>}
      {phase === "done" && txHash && (
        <div className="fade-up notice mt-6 rounded-xl px-4 py-3 text-sm flex items-center gap-2 flex-wrap">
          <CheckCircle2 size={16} /> All {contractors.length} contractors paid in <span className="font-semibold">one transaction</span>.
          <a className="inline-flex items-center gap-1 underline underline-offset-2" href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">
            View on Basescan <ExternalLink size={13} />
          </a>
        </div>
      )}

      <div className="fade-up delay-1 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <Stat label="Net this cycle" value={formatUSD(total)} sub="USDC" />
        <Stat label="Contractors" value={String(contractors.length)} sub={`${countries} countries`} icon={<Users size={15} />} />
        <Stat label="Signatures" value="1" sub={`not ${contractors.length}`} icon={<Zap size={15} />} />
      </div>

      <div className="fade-up delay-2 card mt-8 overflow-hidden">
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-display text-lg font-semibold">Recipients</h2>
          <span className="text-xs text-[var(--text-dim)]">{contractors.length} contractors · {countries} countries</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {contractors.map((c) => <Row key={c.id} c={c} state={rowState} hash={txHash} />)}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-faint)] mt-6">
        One <span className="font-mono">disperseToken</span> call sends {PER_PERSON} test USDC to each recipient — real &amp; verifiable on Base Sepolia.
      </p>
    </div>
  );
}

function Banner({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const cls = tone === "warn"
    ? "border-[rgba(245,177,76,0.3)] bg-[rgba(245,177,76,0.08)] text-[#f5b14c]"
    : "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-dim)]";
  return <div className={`fade-up mt-6 rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-1.5 text-[var(--text-dim)] text-xs uppercase tracking-wide">{icon}{label}</div>
      <div className="font-mono text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className="text-xs text-[var(--text-faint)] mt-1">{sub}</div>}
    </div>
  );
}

function Row({ c, state, hash }: { c: Contractor; state: "idle" | "batch" | "paid"; hash?: `0x${string}` }) {
  const initials = c.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <div className="flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-[var(--surface-2)] transition-colors">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-semibold text-sm text-[#04130d]" style={{ background: `linear-gradient(135deg, ${c.avatar[0]}, ${c.avatar[1]})` }}>{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{c.name}</div>
        <div className="text-xs text-[var(--text-dim)] truncate">{c.role}</div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-dim)] w-28"><span className="text-base">{c.flag}</span> {c.country}</div>
      <div className="hidden xl:block font-mono text-xs text-[var(--text-faint)] w-28">{truncate(c.wallet)}</div>
      <StatusCell state={state} hash={hash} />
      <div className="w-28 text-right">
        <div className="font-mono font-semibold">{formatUSD(c.monthlyAmount)}</div>
        <div className="text-[10px] text-[var(--text-faint)] uppercase">{c.currency} payout</div>
      </div>
    </div>
  );
}

function StatusCell({ state, hash }: { state: "idle" | "batch" | "paid"; hash?: `0x${string}` }) {
  if (state === "idle") return <div className="hidden md:block w-32" />;
  if (state === "batch") return (
    <div className="hidden md:flex items-center gap-1.5 text-xs w-32 text-[#f5b14c]"><Loader2 size={13} className="animate-spin" /> In batch…</div>
  );
  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs w-32 text-[var(--accent)]">
      <CheckCircle2 size={13} /> Paid
      {hash && <a href={`https://sepolia.basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" className="opacity-80 hover:opacity-100"><ExternalLink size={12} /></a>}
    </div>
  );
}

function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/rejected|denied/i.test(msg)) return "You rejected the request in your wallet.";
  if (/insufficient/i.test(msg)) return "Not enough test USDC or ETH - top up from the faucet.";
  if (/allowance|transferFrom/i.test(msg)) return "Approval needed - authorise the contract first.";
  return "Transaction failed. " + msg.slice(0, 120);
}