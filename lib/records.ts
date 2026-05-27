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
};