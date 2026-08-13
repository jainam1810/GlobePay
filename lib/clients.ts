export type DbClient = {
    id: string;
    created_at: string;
    company_name: string;
    home_country: string;
    wallet_address: string | null;   // the wallet that signs their payrolls
    contact_email: string | null;
    notes: string | null;
};

// What POST /api/clients and PATCH /api/clients/[id] accept off the wire.
// All optional because the payload is untrusted — the route decides what's required.
export type ClientInput = {
    company_name?: string;
    home_country?: string;
    wallet_address?: string | null;
    contact_email?: string | null;
    notes?: string | null;
};

// One freelancer inside a payroll run — snapshotted at prepare time.
export type PayrollLineItem = {
    contractor_id: string;
    name: string;
    wallet: string;
    country: string;
    amount: number;    // USD, and the same figure sent in USDC — a dollar is a USDC
    // Set when this line came from a contractor's invoice, so the payment that
    // settles it can be traced back to the document that asked for it. Carried
    // into the ledger record on execution.
    invoice_number?: string | null;
    invoice_date?: string | null;
    invoice_description?: string | null;
};

export type PayrollRun = {
    id: string;
    created_at: string;
    client_id: string;
    status: "draft" | "pending_confirmation" | "executed" | "cancelled";
    line_items: PayrollLineItem[];
    total_amount: number;
    note: string | null;
    confirmed_at: string | null;
    tx_hash: string | null;
};
