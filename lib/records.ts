export type SavedRecord = {
    id: string;
    created_at: string;
    payee_name: string;
    payee_address: string | null;
    amount: number;
    currency: string;
    invoice_date: string | null;
    description: string | null;
    invoice_number: string | null;
    ai_confidence: "high" | "medium" | "low" | null;
    ai_notes: string | null;
    tx_hash: string | null;
    local_amount: number | null;
    local_currency: string | null;
    fx_rate: number | null;
    fx_pinned_at: string | null;
    tax_country: string | null;
    withholding_rate: number | null;
    withheld_amount: number | null;
    net_amount: number | null;
    contractor_tax_id: string | null;
    tax_treatment: string | null;   // 'domestic' | 'cross_border'
    company_country: string | null;
    client_id?: string | null;      // which client's ledger this row belongs to
    client_name?: string | null;    // attached by the API for admin views
};