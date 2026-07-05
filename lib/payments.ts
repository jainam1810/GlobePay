// A payment = one on-chain payroll run (one disperseToken transaction).
// Everything here is derived from the chain by code (lib/chain.ts) — the
// tx hash is the on-chain anchor, the DB row is a queryable snapshot of it.

export type PaymentRecipient = {
    wallet: string;
    amount: number;          // USDC, human units
    name: string | null;     // contractor name at time of ingest (snapshot)
    country: string | null;
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
};
