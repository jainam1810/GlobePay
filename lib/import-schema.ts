// AI onboarding importer: Gemini reads the client's messy freelancer list
// (pasted email, spreadsheet export, PDF) and returns structured rows.
// The AI only READS — every row is re-validated in code before anything
// touches the database (wallet checksum, country, amount, tax-id format).

export type ImportedFreelancer = {
    name: string;
    role: string;            // "" if absent
    country: string;         // freelancer's country as written
    wallet: string;          // "" if absent
    monthly_amount: number;  // 0 if absent
    tax_id: string;          // "" if absent
    notes: string;           // anything ambiguous about THIS row
};

export type ImportExtraction = {
    freelancers: ImportedFreelancer[];
    confidence: "high" | "medium" | "low";
    notes: string;
};

export const importSchema = {
    type: "object",
    properties: {
        freelancers: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Freelancer's full name" },
                    role: { type: "string", description: "Their role/job if stated, empty string if absent" },
                    country: { type: "string", description: "Their country, English name (e.g. Nigeria, Argentina, Philippines)" },
                    wallet: { type: "string", description: "Their 0x wallet address exactly as written, empty string if absent" },
                    monthly_amount: { type: "number", description: "Monthly pay in USD, number only. 0 if absent" },
                    tax_id: { type: "string", description: "Their tax ID if stated (TIN, CUIT, etc.), empty string if absent" },
                    notes: { type: "string", description: "Anything ambiguous about this row, empty string if none" },
                },
                required: ["name", "role", "country", "wallet", "monthly_amount", "tax_id", "notes"],
            },
        },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        notes: { type: "string", description: "Anything about the list overall a human should check, empty string if none" },
    },
    required: ["freelancers", "confidence", "notes"],
};
