"use client";
import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { parseUnits, erc20Abi } from "viem";
import { Send, Users, Clock, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { contractors, truncate, formatUSD, type Contractor } from "@/lib/mock-data";
import { USDC_ADDRESS } from "@/lib/usdc";

const DEMO_AMOUNT = "1"; // send 1 test USDC for the first live transfer

export default function PayrollPage() {
  const { isConnected, chainId } = useAccount();
  const { writeContractAsync, isPending, error } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const total = contractors.reduce((s, c) => s + c.monthlyAmount, 0);
  const countries = new Set(contractors.map((c) => c.country)).size;
  const wrongNetwork = isConnected && chainId !== baseSepolia.id;
  const disabled = !isConnected || wrongNetwork || isPending || isConfirming;

  async function runPayroll() {
    setTxHash(undefined);
    const first = contractors[0];
    try {
      const hash = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [first.wallet as `0x${string}`, parseUnits(DEMO_AMOUNT, 6)], // USDC = 6 decimals
      });
      setTxHash(hash);
    } catch {
      /* rejected/failed - shown via `error` below */
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="fade-up flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="kicker">Payroll · May 2026</div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Run this month&rsquo;s payroll</h1>
          <p className="text-[var(--text-dim)] mt-2 max-w-md">One click pays every contractor in stable dollars. Your wallet signs - we never hold the funds.</p>
        </div>
        <button className="btn-primary self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed" onClick={runPayroll} disabled={disabled}>
          {isPending ? <><Loader2 size={18} className="animate-spin" /> Confirm in wallet…</>
            : isConfirming ? <><Loader2 size={18} className="animate-spin" /> Settling on-chain…</>
              : <><Send size={18} /> Run Payroll · {formatUSD(total)}</>}
        </button>
      </div>

      {!isConnected && <Banner>Connect your wallet (top right) to run a live payment.</Banner>}
      {wrongNetwork && <Banner tone="warn">Wrong network - hit “Switch to Base Sepolia” (top right).</Banner>}
      {error && <Banner tone="warn">Transaction cancelled or failed. {shortErr(error.message)}</Banner>}
      {isSuccess && txHash && (
        <div className="fade-up notice mt-6 rounded-xl px-4 py-3 text-sm flex items-center gap-2 flex-wrap">
          <CheckCircle2 size={16} /> Live transfer confirmed on Base Sepolia.
          <a className="inline-flex items-center gap-1 underline underline-offset-2" href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer">
            View on Basescan <ExternalLink size={13} />
          </a>
        </div>
      )}

      <div className="fade-up delay-1 grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <Stat label="Net this cycle" value={formatUSD(total)} sub="USDC" />
        <Stat label="Contractors" value={String(contractors.length)} sub={`${countries} countries`} icon={<Users size={15} />} />
        <Stat label="Avg settlement" value="~2 min" sub="vs 3–5 days by wire" icon={<Clock size={15} />} />
      </div>

      <div className="fade-up delay-2 card mt-8 overflow-hidden">
        <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-display text-lg font-semibold">Recipients</h2>
          <span className="text-xs text-[var(--text-dim)]">{contractors.length} contractors · {countries} countries</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {contractors.map((c, i) => <Row key={c.id} c={c} live={i === 0} />)}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-faint)] mt-6">
        First live transfer sends {DEMO_AMOUNT} test USDC to the top recipient - real &amp; verifiable on Base Sepolia, only the funds are testnet.
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

function shortErr(msg: string) {
  if (/rejected|denied/i.test(msg)) return "You rejected the request.";
  if (/insufficient/i.test(msg)) return "Not enough test USDC - grab some from the faucet.";
  return "";
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

function Row({ c, live }: { c: Contractor; live?: boolean }) {
  const initials = c.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
  return (
    <div className="flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-[var(--surface-2)] transition-colors">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-semibold text-sm text-[#04130d]" style={{ background: `linear-gradient(135deg, ${c.avatar[0]}, ${c.avatar[1]})` }}>{initials}</div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate flex items-center gap-2">
          {c.name}
          {live && <span className="text-[9px] font-mono tracking-wider text-[var(--accent)] border border-[rgba(47,230,168,0.3)] rounded px-1.5 py-0.5">LIVE</span>}
        </div>
        <div className="text-xs text-[var(--text-dim)] truncate">{c.role}</div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-sm text-[var(--text-dim)] w-32"><span className="text-base">{c.flag}</span> {c.country}</div>
      <div className="hidden md:block font-mono text-xs text-[var(--text-faint)] w-32">{truncate(c.wallet)}</div>
      <div className="text-right w-28">
        <div className="font-mono font-semibold">{formatUSD(c.monthlyAmount)}</div>
        <div className="text-[10px] text-[var(--text-faint)] uppercase">{c.currency} payout</div>
      </div>
    </div>
  );
}