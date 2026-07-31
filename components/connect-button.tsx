"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Plain-language labels: clients are finance people, not crypto people.
const LABELS: Record<string, { name: string; hint: string }> = {
    safe: { name: "Safe", hint: "Your company multisig" },
    walletConnect: { name: "Safe / mobile wallet", hint: "Scan a QR or approve in your Safe app" },
    injected: { name: "Browser wallet", hint: "MetaMask or similar extension" },
};

export default function ConnectButton() {
    const { address, isConnected, chainId } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();
    const { switchChain } = useSwitchChain();
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);

    // Inside the Safe App the safe connector auto-connects, so the picker never
    // shows there. Elsewhere it's hidden because it can't connect at all.
    const usable = connectors.filter((c) => c.type !== "safe");

    useEffect(() => {
        if (!open) return;
        function onDown(e: MouseEvent) {
            if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    if (!isConnected) {
        // Only one way in — don't make them pick from a list of one.
        if (usable.length <= 1) {
            return (
                <button
                    onClick={() => usable[0] && connect({ connector: usable[0] })}
                    disabled={isPending || usable.length === 0}
                    className="rounded-full bg-(--accent) text-[var(--accent-ink)] px-4 py-2 text-sm font-semibold hover:brightness-105 transition disabled:opacity-60"
                >
                    {isPending ? "Connecting…" : "Connect Wallet"}
                </button>
            );
        }
        return (
            <div className="relative" ref={wrap}>
                <button
                    onClick={() => setOpen(!open)}
                    disabled={isPending}
                    className="rounded-full bg-(--accent) text-[var(--accent-ink)] px-4 py-2 text-sm font-semibold hover:brightness-105 transition disabled:opacity-60"
                >
                    {isPending ? "Connecting…" : "Connect Wallet"}
                </button>
                {open && (
                    <div className="absolute right-0 mt-2 w-64 z-50 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl overflow-hidden">
                        {usable.map((c) => {
                            const l = LABELS[c.type] ?? { name: c.name, hint: "" };
                            return (
                                <button
                                    key={c.uid}
                                    onClick={() => { connect({ connector: c }); setOpen(false); }}
                                    className="w-full text-left px-4 py-3 hover:bg-[var(--surface-2)] transition border-b border-[var(--border)] last:border-0"
                                >
                                    <div className="text-sm font-medium">{l.name}</div>
                                    {l.hint && <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{l.hint}</div>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (chainId !== baseSepolia.id) {
        return (
            <button
                onClick={() => switchChain({ chainId: baseSepolia.id })}
                className="rounded-full border border-[var(--warn-line)] bg-[var(--warn-soft)] text-[var(--warn)] px-4 py-2 text-sm font-medium hover:bg-[var(--warn-soft)] transition"
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
