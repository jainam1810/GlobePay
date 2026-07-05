export type DbClient = {
    id: string;
    created_at: string;
    company_name: string;
    home_country: string;
    wallet_address: string | null;   // the wallet that signs their payrolls
    contact_email: string | null;
    notes: string | null;
};

// One freelancer inside a payroll run — snapshotted at prepare time.
export type PayrollLineItem = {
    contractor_id: string;
    name: string;
    wallet: string;
    country: string;
    amount: number;    // real USD amount (display/records); testnet sends 1 USDC per person
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
