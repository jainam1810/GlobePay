// A payment = one on-chain payroll run (one disperseToken transaction).
// Everything here is derived from the chain by code (lib/chain.ts) — the
// tx hash is the on-chain anchor, the DB row is a queryable snapshot of it.

export type PaymentRecipient = {
    wallet: string;
    amount: number;          // USDC actually moved on-chain (testnet: a flat 1)
    name: string | null;     // contractor name at time of ingest (snapshot)
    country: string | null;
    // Real USD this person was owed, from the payroll run behind this tx.
    // null when no run is linked (payments imported straight from the chain).
    intended_amount?: number | null;
};

export type SavedPayment = {
    id: string;
    created_at: string;
    tx_hash: string;
    block_number: number | null;
    paid_at: string | null;      // block timestamp — when the chain confirmed it
    from_address: string;        // the company wallet that signed
    token_address: string;
    token_symbol: string;
    total_amount: number;        // USDC, human units
    recipient_count: number;
    fee_eth: number | null;      // network fee actually paid
    recipients: PaymentRecipient[];
    client_id?: string | null;    // which client this payroll belongs to
    client_name?: string | null;  // attached by the API for admin views
    client_country?: string | null; // paying client's HQ — picks the fiat for fees
    // Attached by the API from the linked payroll run, when there is one.
    intended_total?: number | null;
    run_note?: string | null;
};
