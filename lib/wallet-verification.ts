// Proving a freelancer holds the wallet we're about to pay.
//
// A wallet address carries its own integrity check, so a typo is caught before
// it is ever saved. What no check can catch is an address that is valid but
// belongs to somebody else — the crypto equivalent of a correct-looking sort
// code and account number for the wrong person.
//
// UK banking answers that with Confirmation of Payee: the bank matches the name
// against the account and tells you whether it agrees. This is the same idea,
// and stronger, because it is cryptographic rather than a database lookup: the
// freelancer signs a sentence with the wallet they claim, and only the holder of
// that private key can produce the signature. If a client mistyped into a valid
// address belonging to a stranger, the real freelancer cannot sign for it, so it
// never becomes verified.
//
// It is the same mechanism regulated firms use to evidence wallet ownership for
// the Travel Rule. No key is exposed; the signature proves consent to this exact
// sentence and nothing else.

/** How long a verification link stays usable. */
export const VERIFY_TOKEN_TTL_HOURS = 72;

/**
 * The sentence being signed.
 *
 * Deliberately readable, because the freelancer sees this in their wallet and
 * should be able to tell what they are agreeing to. It names all three parties
 * and pins the address, so a signature captured from one context can't be
 * replayed to vouch for a different wallet or a different company.
 */
export function verificationMessage(opts: {
    name: string;
    company: string;
    wallet: string;
    issuedAt: string;
}) {
    return [
        "GlobePay — confirm your payout wallet",
        "",
        `I am ${opts.name}.`,
        `I confirm this wallet is mine and authorise ${opts.company} to pay me at it through GlobePay.`,
        "",
        `Wallet: ${opts.wallet}`,
        `Issued: ${opts.issuedAt}`,
        "",
        "Signing costs nothing and moves no funds.",
    ].join("\n");
}

/** How much a payer should trust the address in front of them. */
export type WalletTrust = "verified" | "recognised" | "unverified";

export type TrustInput = {
    wallet: string | null;
    verified_wallet?: string | null;
    wallet_verified_at?: string | null;
    /** A Basename / ENS name the address resolves to, when it has one. */
    name?: string | null;
};

/**
 * Verified only when the signature was for *this* address.
 *
 * The comparison matters: if the roster address is edited after verification,
 * the stored proof no longer covers what we are about to pay, and the badge has
 * to fall back. A green tick against an address nobody signed for would be
 * worse than no tick at all.
 */
export function walletTrust(c: TrustInput): WalletTrust {
    const w = c.wallet?.toLowerCase();
    if (!w) return "unverified";
    if (c.wallet_verified_at && c.verified_wallet?.toLowerCase() === w) return "verified";
    if (c.name) return "recognised";
    return "unverified";
}

export const TRUST_COPY: Record<WalletTrust, { label: string; hint: string }> = {
    verified: {
        label: "Verified",
        hint: "The freelancer signed for this wallet, so it is provably theirs.",
    },
    recognised: {
        label: "Recognised",
        hint: "This address has a public name attached. That makes it readable, but it isn't proof of who owns it.",
    },
    unverified: {
        label: "Unverified",
        hint: "The address is correctly formed, but nobody has proved it belongs to this freelancer.",
    },
};
