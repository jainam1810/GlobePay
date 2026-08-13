// Shared shapes for the invoice queue, and the one piece of judgement that must
// not live in a component: what to do with an invoice when it lands.
import type { ExtractedInvoice } from "@/lib/invoice-schema";

export type SubmissionStatus = "pending" | "accepted" | "needs_attention";

export type InvoiceSubmission = {
    id: string;
    created_at: string;
    client_id: string;
    client_name?: string | null;
    file_name: string;
    file_type: string | null;
    file_size: number | null;
    extracted: ExtractedInvoice | null;
    payee_name: string | null;
    payee_wallet: string | null;
    amount: number | null;
    currency: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    description: string | null;
    status: SubmissionStatus;
    review_note: string | null;
    contractor_id: string | null;
    reviewed_at: string | null;
    /** Set once a run has claimed this invoice — after that it cannot be reopened. */
    payroll_run_id: string | null;
    /** Every field GlobePay altered after it arrived, oldest first. */
    corrections?: { field: string; label: string; from: string; to: string; at: string; by: string }[] | null;
    /** For displaying in place. Minted per request, short-lived, never stored. */
    file_url?: string | null;
    /** Same object with Content-Disposition: attachment, for the Save link. */
    file_download_url?: string | null;
    /** Computed server-side for reviewers; null for a client's own view. */
    match?: Matched | null;
};

/** What the reviewer is being asked to decide about one row. */
export type Verdict = "match" | "new" | "conflict" | "duplicate";

export type Matched = {
    verdict: Verdict;
    contractorId: string | null;
    /** The roster figure, for comparison — never overwritten by an invoice. */
    rosterAmount: number | null;
    /**
     * The wallet already on file for whoever was matched.
     *
     * Offered only when the invoice's own wallet fails its checksum: an address
     * the client already vetted beats one a model read off a page. Never offered
     * against a *valid* address — that direction is the fraud vector.
     */
    rosterWallet?: string | null;
    /** One line explaining a verdict that isn't obvious. */
    reason: string;
};

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
/** Wallets are case-insensitive on chain; EIP-55 only encodes a checksum. */
const wallet = (s?: string | null) => norm(s);

/**
 * Decide what an incoming invoice means against the roster.
 *
 * Four outcomes, not two. "Matches an existing freelancer" and "is somebody new"
 * are the easy ones; the two that matter are the ones a naive name-or-wallet
 * check gets wrong:
 *
 *  · conflict — the name is on the roster but the wallet is different. That is
 *    what invoice fraud looks like: a real invoice with the payee's address
 *    swapped. Silently adding a second freelancer with the same name would pay
 *    the attacker and leave a roster that looks untouched, so this stops.
 *
 *  · duplicate — the same invoice number from the same wallet has already been
 *    accepted. On chain there is no reversal, so paying twice is permanent.
 *
 * Neither may be resolved in bulk.
 */
export function matchInvoice(
    inv: { payee_name: string | null; payee_wallet: string | null; invoice_number: string | null },
    roster: { id: string; name: string; wallet: string; monthly_amount: number | null }[],
    alreadyAccepted: { payee_wallet: string | null; invoice_number: string | null }[],
): Matched {
    const w = wallet(inv.payee_wallet);
    const n = norm(inv.payee_name);

    const dup = w && norm(inv.invoice_number) && alreadyAccepted.some(
        (a) => wallet(a.payee_wallet) === w && norm(a.invoice_number) === norm(inv.invoice_number),
    );
    if (dup) {
        return {
            verdict: "duplicate", contractorId: null, rosterAmount: null,
            reason: `Invoice ${inv.invoice_number} from this wallet has already been accepted.`,
        };
    }

    const byWallet = w ? roster.find((c) => wallet(c.wallet) === w) : undefined;
    const byName = n ? roster.find((c) => norm(c.name) === n) : undefined;

    // The wallet is the identity that matters — it is where the money goes.
    if (byWallet) {
        if (n && norm(byWallet.name) !== n) {
            return {
                verdict: "conflict", contractorId: byWallet.id, rosterAmount: byWallet.monthly_amount, rosterWallet: byWallet.wallet,
                reason: `That wallet is on file as ${byWallet.name}, not ${inv.payee_name}.`,
            };
        }
        return {
            verdict: "match", contractorId: byWallet.id, rosterAmount: byWallet.monthly_amount, rosterWallet: byWallet.wallet,
            reason: "",
        };
    }

    // Name on the roster, wallet we have never seen: the dangerous one.
    if (byName) {
        return {
            verdict: "conflict", contractorId: byName.id, rosterAmount: byName.monthly_amount, rosterWallet: byName.wallet,
            reason: `${byName.name} is on the roster with a different wallet. Confirm the change before paying.`,
        };
    }

    return { verdict: "new", contractorId: null, rosterAmount: null, reason: "Not on the roster yet." };
}

export const STATUS_COPY: Record<SubmissionStatus, { label: string; hint: string }> = {
    pending: { label: "Pending", hint: "With GlobePay for review." },
    accepted: { label: "Accepted", hint: "Checked and on the roster for the next run." },
    needs_attention: { label: "Needs attention", hint: "Something needs correcting before this can be paid." },
};
