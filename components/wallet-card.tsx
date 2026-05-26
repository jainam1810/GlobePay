"use client";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { Wallet } from "lucide-react";
import { USDC_ADDRESS } from "@/lib/usdc";

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WalletCard() {
    const { address, isConnected } = useAccount();
    const { data: balance } = useReadContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    });

    const usdc = balance !== undefined ? Number(formatUnits(balance as bigint, 6)) : null;

    return (
        <div className="card p-4">
            <div className="flex items-center gap-2 text-(--text-dim) text-[0.7rem] tracking-wide mb-2">
                <Wallet size={13} /> COMPANY WALLET
            </div>
            {isConnected && address ? (
                <>
                    <div className="font-mono text-sm">{truncate(address)}</div>
                    <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-semibold text-(--accent)">
                            {usdc === null ? "…" : usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-(--text-dim)">USDC</span>
                    </div>
                </>
            ) : (
                <div className="text-sm text-(--text-faint)">Not connected</div>
            )}
        </div>
    );
}