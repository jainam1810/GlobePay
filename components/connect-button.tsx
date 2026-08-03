"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useSwitchChain, type Connector } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { Check, Copy } from "lucide-react";
import SafeLogo from "@/components/safe-logo";
import { Tooltip } from "@/components/ui/overlays";

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Plain-language labels for the two connectors that are ours to describe.
// Anything injected names itself — see pickable() below.
const LABELS: Record<string, { name: string; hint: string }> = {
    safe: { name: "Safe", hint: "Your company multisig" },
    walletConnect: { name: "Safe wallet", hint: "Scan a QR or approve in your Safe app" },
};

/**
 * The wallets worth offering, each named as itself.
 *
 * wagmi turns on EIP-6963 discovery by default, so every extension that
 * announces itself becomes its own connector — all with type "injected". The
 * old code looked its label up by *type*, so MetaMask, Rabby and Phantom all
 * rendered as the identical row "Browser wallet · MetaMask or similar
 * extension", three times, with no way to tell which was which.
 *
 * Discovered connectors carry the wallet's real name and icon, so use those.
 * Two more passes are needed on top:
 *
 *   · the generic injected() we register ourselves (id "injected") is a
 *     fallback for when nothing announced itself. Once anything has, it is a
 *     duplicate of a wallet already in the list, so it goes.
 *   · some extensions announce twice under different rdns; dedupe by name.
 */
function pickable(connectors: readonly Connector[]) {
    // Inside the Safe App the safe connector auto-connects, so the picker never
    // shows there. Elsewhere it can't connect at all.
    const usable = connectors.filter((c) => c.type !== "safe");
    const discovered = usable.some((c) => c.type === "injected" && c.id !== "injected");

    const seen = new Set<string>();
    return usable
        .filter((c) => !(discovered && c.id === "injected"))
        .filter((c) => {
            const key = c.type === "injected" ? c.name.toLowerCase() : c.type;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export default function ConnectButton({ label = "Connect Wallet", onConnected }: {
    /**
     * What the button says when nothing is connected. "Connect Wallet" is right
     * in the header; in settings, where a wallet is already on file, it needs to
     * say Reconnect instead — offering to "connect a wallet" to someone who has
     * one reads as though theirs had been forgotten.
     */
    label?: string;
    /** Fired once a connection lands, so the caller can save the address. */
    onConnected?: () => void;
} = {}) {
    const { address, isConnected, chainId } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { switchChain } = useSwitchChain();
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);

    const usable = pickable(connectors);

    useEffect(() => {
        if (!open) return;
        function onDown(e: MouseEvent) {
            if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    // Announce the address once per connection, not once per render — the
    // callback saves to the server, and a re-render is not a new connection.
    const announced = useRef<string | null>(null);
    useEffect(() => {
        if (!isConnected || !address) { announced.current = null; return; }
        if (announced.current === address) return;
        announced.current = address;
        onConnected?.();
    }, [isConnected, address, onConnected]);

    if (!isConnected) {
        // Only one way in — don't make them pick from a list of one.
        if (usable.length <= 1) {
            return (
                <button
                    onClick={() => usable[0] && connect({ connector: usable[0] })}
                    disabled={isPending || usable.length === 0}
                    className="rounded-full bg-(--accent) text-[var(--accent-ink)] px-4 py-2 text-sm font-semibold hover:brightness-105 transition disabled:opacity-60"
                >
                    {isPending ? "Connecting…" : label}
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
                    {isPending ? "Connecting…" : label}
                </button>
                {/* w-72, not w-64: adding a 24px logo pushed "approve in your
                    Safe app" into an ellipsis at the narrower width. */}
                {open && (
                    <div className="absolute right-0 mt-2 w-72 z-50 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-xl overflow-hidden">
                        {usable.map((c) => {
                            // An injected wallet names itself; only the two we
                            // register get copy of our own.
                            const l = LABELS[c.type] ?? { name: c.name, hint: "Browser extension" };
                            // Extensions announce their own artwork over EIP-6963;
                            // Safe arrives via WalletConnect, which announces none,
                            // so that row was the only one rendering iconless.
                            const isSafe = c.type === "walletConnect" || c.type === "safe";
                            return (
                                <button
                                    key={c.uid}
                                    onClick={() => { connect({ connector: c }); setOpen(false); }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)] border-b border-[var(--border)] last:border-0"
                                >
                                    {isSafe
                                        ? <SafeLogo size={24} className="shrink-0" />
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        : c.icon && <img src={c.icon} alt="" aria-hidden className="h-6 w-6 shrink-0 rounded-md" />}
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium truncate">{l.name}</span>
                                        {l.hint && <span className="block text-[11px] text-[var(--text-dim)] mt-0.5 truncate">{l.hint}</span>}
                                    </span>
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

    return <AddressChip address={address} />;
}

/**
 * The connected address, which copies when clicked.
 *
 * It used to disconnect. That is the wrong thing to put under the only control
 * that looks like a label: the address is the thing people reach for when they
 * want to paste it somewhere, and losing your session is a surprising price for
 * a misread. Disconnecting now lives in the account menu behind a confirmation,
 * which is where an action you have to redo deliberately belongs.
 */
function AddressChip({ address }: { address?: `0x${string}` }) {
    const [copied, setCopied] = useState(false);
    if (!address) return null;

    function copy() {
        navigator.clipboard.writeText(address!).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    }

    return (
        <Tooltip content={copied ? "Copied" : "Copy wallet address"}>
            <button
                onClick={copy}
                aria-label={`Copy wallet address ${address}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-3.5 py-2 font-mono text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            >
                {truncate(address)}
                {copied
                    ? <Check size={13} className="text-[var(--accent)]" />
                    : <Copy size={13} className="text-[var(--text-faint)]" />}
            </button>
        </Tooltip>
    );
}
