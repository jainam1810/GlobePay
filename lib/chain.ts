// Server-side chain reader. Given a tx hash, rebuilds the full payment from
// on-chain data (receipt + the USDC contract's own Transfer events) — so what
// we store and show is proven chain data, never client-supplied numbers.
import { createPublicClient, http, parseEventLogs, formatUnits, formatEther, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";
import { USDC_ADDRESS, USDC_DECIMALS } from "@/lib/usdc";
import { DISPERSE_ADDRESS } from "@/lib/disperse";
import { getSupabase } from "@/lib/supabase";
import type { PaymentRecipient } from "@/lib/payments";
import type { DbContractor } from "@/lib/contractor-types";

export function getChainClient() {
    return createPublicClient({
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
    });
}

// Row shape for the `payments` table, minus DB-generated columns.
export type PaymentRow = {
    tx_hash: string;
    block_number: number;
    paid_at: string;
    from_address: string;
    token_address: string;
    token_symbol: string;
    total_amount: number;
    recipient_count: number;
    fee_eth: number;
    recipients: PaymentRecipient[];
};

// Rebuild a payment from the chain. Throws with a human-readable message if
// the tx isn't a successful GlobePay payroll run.
export async function buildPaymentRow(txHash: `0x${string}`): Promise<PaymentRow> {
    if (!DISPERSE_ADDRESS) throw new Error("Disperse contract address not configured");
    const client = getChainClient();

    const receipt = await client.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error("That transaction failed on-chain — nothing was paid.");
    if (receipt.to?.toLowerCase() !== DISPERSE_ADDRESS.toLowerCase()) {
        throw new Error("That transaction is not a GlobePay payroll run.");
    }

    // The USDC contract's own Transfer events are the per-recipient source of
    // truth (one per recipient, emitted by transferFrom inside the batch).
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
        .filter((log) => log.address.toLowerCase() === USDC_ADDRESS.toLowerCase())
        .filter((log) => log.args.from.toLowerCase() === receipt.from.toLowerCase());
    if (transfers.length === 0) throw new Error("No USDC transfers found in that transaction.");

    const block = await client.getBlock({ blockNumber: receipt.blockNumber });

    // Snapshot contractor names by wallet so receipts stay readable even if
    // the roster changes later (same immutability rule as invoice records).
    const { data } = await getSupabase().from("contractors").select("*");
    const byWallet = new Map<string, DbContractor>(
        ((data as DbContractor[]) || []).map((c) => [c.wallet.toLowerCase(), c])
    );

    const recipients: PaymentRecipient[] = transfers.map((log) => {
        const c = byWallet.get(log.args.to.toLowerCase());
        return {
            wallet: log.args.to,
            amount: Number(formatUnits(log.args.value, USDC_DECIMALS)),
            name: c?.name ?? null,
            country: c?.country ?? null,
        };
    });
    const total = recipients.reduce((s, r) => s + r.amount, 0);

    return {
        tx_hash: txHash,
        block_number: Number(receipt.blockNumber),
        paid_at: new Date(Number(block.timestamp) * 1000).toISOString(),
        from_address: receipt.from,
        token_address: USDC_ADDRESS,
        token_symbol: "USDC",
        total_amount: Math.round(total * 100) / 100,
        recipient_count: recipients.length,
        fee_eth: Number(formatEther(receipt.gasUsed * receipt.effectiveGasPrice)),
        recipients,
    };
}
