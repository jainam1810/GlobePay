"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function ConnectButton() {
    const { address, isConnected, chainId } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const { switchChain } = useSwitchChain();

    if (!isConnected) {
        return (
            <button
                onClick={() => connect({ connector: connectors[0] })}
                disabled={isPending}
                className="rounded-full bg-(--accent) text-[#04130d] px-4 py-2 text-sm font-semibold hover:brightness-105 transition disabled:opacity-60"
            >
                {isPending ? "Connecting…" : "Connect Wallet"}
            </button>
        );
    }

    if (chainId !== baseSepolia.id) {
        return (
            <button
                onClick={() => switchChain({ chainId: baseSepolia.id })}
                className="rounded-full border border-[rgba(245,177,76,0.4)] bg-[rgba(245,177,76,0.1)] text-[#f5b14c] px-4 py-2 text-sm font-medium hover:bg-[rgba(245,177,76,0.16)] transition"
            >
                Switch to Base Sepolia
            </button>
        );
    }

    return (
        <button
            onClick={() => disconnect()}
            title="Disconnect"
            className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium font-mono hover:bg-[var(--surface-2)] transition-colors"
        >
            {address ? truncate(address) : ""}
        </button>
    );
}