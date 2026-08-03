import type { PublicClient } from "viem";
import { erc20Abi, isAddress, zeroAddress } from "viem";

// Check a payroll run before anyone signs it.
//
// A batch is one transaction, so if any single transfer would revert the whole
// run reverts — which is the right accounting (nobody wants a payroll that
// half-landed) but a terrible surprise to discover *after* paying gas for a
// failed transaction. So we ask the chain first. It costs nothing: these are
// view calls, no gas and no signature.
//
// Why we can name the exact freelancer rather than hunting for them: USDC is
// not a plain ERC-20. It is Circle's FiatToken, which keeps a blacklist, and a
// blacklisted address can neither send nor *receive* — so a transfer to one
// reverts and takes the batch with it. That flag is a public view function, so
// instead of bisecting a hundred simulations we simply read it for everybody.
//
// Multicall3 is deployed on Base (and essentially every chain), so the whole
// check — balance, allowance, and one blacklist read per recipient — is a
// single RPC round trip regardless of how many people are being paid.

const blacklistAbi = [{
    type: "function",
    name: "isBlacklisted",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
}] as const;

/** One freelancer who cannot be paid, and why, in words a person can act on. */
export type Blocked = {
    index: number;
    wallet: string;
    /** "blocked" = the token itself refuses this address. "invalid" = not an address at all. */
    kind: "blocked" | "invalid";
    reason: string;
};

export type Preflight = {
    /** True when the run would go through exactly as prepared. */
    ok: boolean;
    total: bigint;
    balance: bigint;
    allowance: bigint;
    /** How much more USDC is needed. 0 when funded. */
    shortfall: bigint;
    /** How much more must be approved. 0 when sufficient. */
    allowanceGap: bigint;
    /** The paying wallet is itself blocked — nothing can be sent at all. */
    senderBlocked: boolean;
    /** Recipients that would revert. Empty in the normal case. */
    blocked: Blocked[];
    /** False when the token exposes no blacklist, so that class wasn't checked. */
    checkedBlocklist: boolean;
};

export async function preflight(
    client: PublicClient,
    opts: {
        token: `0x${string}`;
        /** The contract that will pull the tokens — the allowance is checked against this. */
        spender: `0x${string}`;
        sender: `0x${string}`;
        recipients: readonly string[];
        amounts: readonly bigint[];
    },
): Promise<Preflight> {
    const { token, spender, sender, recipients, amounts } = opts;
    const total = amounts.reduce((a, b) => a + b, 0n);

    // Anything that isn't an address can't be asked about on chain — catch those
    // here so the multicall below only ever sees real addresses.
    const blocked: Blocked[] = [];
    const askable: { index: number; wallet: `0x${string}` }[] = [];
    recipients.forEach((w, index) => {
        if (!isAddress(w)) {
            blocked.push({ index, wallet: w, kind: "invalid", reason: "That isn't a valid wallet address" });
        } else if (w.toLowerCase() === zeroAddress) {
            blocked.push({ index, wallet: w, kind: "invalid", reason: "Payments can't be sent to the zero address" });
        } else {
            askable.push({ index, wallet: w as `0x${string}` });
        }
    });

    const contracts = [
        { address: token, abi: erc20Abi, functionName: "balanceOf", args: [sender] } as const,
        { address: token, abi: erc20Abi, functionName: "allowance", args: [sender, spender] } as const,
        { address: token, abi: blacklistAbi, functionName: "isBlacklisted", args: [sender] } as const,
        ...askable.map((r) => (
            { address: token, abi: blacklistAbi, functionName: "isBlacklisted", args: [r.wallet] } as const
        )),
    ];

    // allowFailure so a token without a blacklist degrades to "not checked"
    // rather than throwing and blocking a payroll that would have been fine.
    const res = await client.multicall({ contracts, allowFailure: true });

    const balance = res[0].status === "success" ? (res[0].result as bigint) : 0n;
    const allowance = res[1].status === "success" ? (res[1].result as bigint) : 0n;
    const senderBlocked = res[2].status === "success" && res[2].result === true;
    const checkedBlocklist = res[2].status === "success";

    if (checkedBlocklist) {
        askable.forEach((r, i) => {
            const cell = res[3 + i];
            if (cell.status === "success" && cell.result === true) {
                blocked.push({
                    index: r.index,
                    wallet: r.wallet,
                    kind: "blocked",
                    reason: "This wallet can't receive USDC right now",
                });
            }
        });
    }

    blocked.sort((a, b) => a.index - b.index);

    const shortfall = balance >= total ? 0n : total - balance;
    const allowanceGap = allowance >= total ? 0n : total - allowance;

    return {
        ok: !senderBlocked && blocked.length === 0 && shortfall === 0n,
        total, balance, allowance, shortfall, allowanceGap,
        senderBlocked, blocked, checkedBlocklist,
    };
}

/**
 * The allowance gap is deliberately not part of `ok`.
 *
 * Not having approved enough is not a problem with the run — it is a step the
 * flow already performs, and treating it as a failure would stop a payroll that
 * was always going to work.
 */
export const needsApproval = (p: Preflight) => p.allowanceGap > 0n;
