"use client";
import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { parseUnits, erc20Abi } from "viem";
import { Send, Users, Clock, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { contractors, truncate, formatUSD, type Contractor } from "@/lib/mock-data";
import { USDC_ADDRESS } from "@/lib/usdc";

const PER_PERSON = "1"; // test USDC actually sent per recipient; displayed figures are the real salaries

type TxState = "idle" | "queued" | "signing" | "pending" | "confirmed" | "failed";
type Status = { state: TxState; hash?: `0x${string}` };

export default function PayrollPage() {
  const { isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);

  const total = contractors.reduce((s, c) => s + c.monthlyAmount, 0);
  const countries = new Set(contractors.map((c) => c.country)).size;
  const wrongNetwork = isConnected && chainId !== baseSepolia.id;
  const confirmed = contractors.filter((c) => statuses[c.id]?.state === "confirmed").length;
  const allDone = confirmed === contractors.length && confirmed > 0;
  const disabled = !isConnected || wrongNetwork || running || !publicClient;

  function set(id: string, state: TxState, hash?: `0x${string}`) {
    setStatuses((p) => ({ ...p, [id]: { state, hash: hash ?? p[id]?.hash } }));
  }

  async function runPayroll() {
    if (!publicClient) return;
    setRunning(true);
    setStatuses(Object.fromEntries(contractors.map((c) => [c.id, { state: "queued" as TxState }])));

    for (const c of contractors) {
      try {
        set(c.id, "signing");
        const hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "transfer",
          args: [c.wallet as `0x${string}`, parseUnits(PER_PERSON, 6)], // USDC = 6 decimals
        });
        set(c.id, "pending", hash);
        await publicClient.waitForTransactionReceipt({ hash }); // await each → nonces stay ordered
        set(c.id, "confirmed", hash);
      } catch {
        set(c.id, "failed");
        break; // stop on reject/fail to avoid nonce gaps
      }
    }
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="fade-up flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="kicker">Payroll · May 2026</div>
          <span className="badge-testnet"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Testnet</span>
        </div>
        <button className="btn-primary self-start md:self-auto disabled:opacity-50 disabled:cursor-not-allowed" onClick={runPayroll} disabled={disabled}>
          {running
            ? <><Loader2 size={18} className="animate-spin" /> Paying… {confirmed}/{contractors.length}</>
            : <><Send size={18} /> Run Payroll · {formatUSD(total)}</>}
        </button>
      </div>

      {!isConnected && <Banner>Connect your wallet (top right) to run payroll.</Banner>}
      {wrongNetwork && <Banner tone="warn">Wrong network - hit “Switch to Base Sepolia” (top right).</Banner>}
      {allDone && (
        <div className="fade-up notice mt-6 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> All {contractors.length} contractors paid - {contractors.length} test USDC sent, each verifiable on Base Sepolia.
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
          {contractors.map((c) => <Row key={c.id} c={c} status={statuses[c.id]} />)}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--text-faint)] mt-6">
        Each live transfer sends {PER_PERSON} test USDC; the figures shown are the real salaries. Real &amp; verifiable on Base Sepolia - only the funds are testnet.
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

function Row({ c, status }: { c: Contractor; status?: Status }) {
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
      <StatusCell s={status} />
      <div className="w-28 text-right">
        <div className="font-mono font-semibold">{formatUSD(c.monthlyAmount)}</div>
        <div className="text-[10px] text-[var(--text-faint)] uppercase">{c.currency} payout</div>
      </div>
    </div>
  );
}

function StatusCell({ s }: { s?: Status }) {
  if (!s || s.state === "idle") return <div className="hidden md:block w-36" />;
  const m: Record<Exclude<TxState, "idle">, { label: string; cls: string; icon: React.ReactNode }> = {
    queued: { label: "Queued", cls: "text-[var(--text-faint)]", icon: <Clock size={13} /> },
    signing: { label: "Sign in wallet", cls: "text-[#f5b14c]", icon: <Loader2 size={13} className="animate-spin" /> },
    pending: { label: "Confirming…", cls: "text-[#f5b14c]", icon: <Loader2 size={13} className="animate-spin" /> },
    confirmed: { label: "Paid", cls: "text-[var(--accent)]", icon: <CheckCircle2 size={13} /> },
    failed: { label: "Failed", cls: "text-[#ff6b6b]", icon: <XCircle size={13} /> },
  };
  const v = m[s.state];
  return (
    <div className={`hidden md:flex items-center gap-1.5 text-xs w-36 ${v.cls}`}>
      {v.icon}<span>{v.label}</span>
      {s.state === "confirmed" && s.hash && (
        <a href={`https://sepolia.basescan.org/tx/${s.hash}`} target="_blank" rel="noreferrer" className="opacity-80 hover:opacity-100"><ExternalLink size={12} /></a>
      )}
    </div>
  );
}