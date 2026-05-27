export type Confidence = "high" | "medium" | "low";

export type ExtractedInvoice = {
    payeeName: string;
    payeeAddress: string;   // "" if absent
    amount: number;
    currency: string;       // 3-letter ISO
    date: string;           // ISO YYYY-MM-DD
    description: string;
    invoiceNumber: string;  // "" if absent
    confidence: Confidence;
    notes: string;          // anything unclear, "" if none
};

// Forced JSON schema for Gemini's structured output mode
export const invoiceSchema = {
    type: "object",
    properties: {
        payeeName: { type: "string", description: "Contractor/vendor being paid" },
        payeeAddress: { type: "string", description: "Their billing address, empty string if absent" },
        amount: { type: "number", description: "Total payable — number only, no symbol" },
        currency: { type: "string", description: "3-letter ISO code: USD, EUR, GBP, NGN, INR, ARS, PHP, BRL, etc." },
        date: { type: "string", description: "Invoice date in ISO YYYY-MM-DD" },
        description: { type: "string", description: "One-sentence summary of what the invoice is for" },
        invoiceNumber: { type: "string", description: "Invoice ID, empty string if absent" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        notes: { type: "string", description: "Anything ambiguous or worth a human flag - empty string if none" },
    },
    required: ["payeeName", "payeeAddress", "amount", "currency", "date", "description", "invoiceNumber", "confidence", "notes"],
};