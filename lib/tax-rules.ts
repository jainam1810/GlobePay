// Contractor withholding tax rules. Sourced May 2026 - see report.
// These are HEADLINE resident-contractor rates for the MVP. Real engine
// would handle progressive scales, registration status, thresholds-by-concept.
// AI never computes these — they are code. (Core constraint.)

export type TaxRule = {
    country: string;
    flag: string;
    currencyLocal: string;
    withholdingRate: number;        // headline resident professional-services rate
    withholdingLabel: string;
    thresholdNote: string;
    taxIdName: string;
    taxIdRegex: RegExp;
    taxIdPlaceholder: string;
    classificationSignals: string[];
    source: string;
    effectiveFrom: string;
};

export const taxRules: Record<string, TaxRule> = {
    Nigeria: {
        country: "Nigeria",
        flag: "🇳🇬",
        currencyLocal: "NGN",
        withholdingRate: 0.05,
        withholdingLabel: "5% WHT (professional services)",
        thresholdNote: "Exempt if payer turnover ≤ ₦25m and payment ≤ ₦2m with valid TIN.",
        taxIdName: "TIN",
        taxIdRegex: /^(\d{8}-\d{4}|\d{10})$/,
        taxIdPlaceholder: "12345678-0001",
        classificationSignals: [
            "Works fixed hours set by the company",
            "Uses company-supplied equipment",
            "Paid a fixed monthly wage (not per-invoice)",
            "Works exclusively for this company",
            "Integrated into the core team / org chart",
        ],
        source: "Nigeria Tax Act 2025 (eff. 1 Jan 2026); WHT Regulations 2024",
        effectiveFrom: "2026-01-01",
    },
    Argentina: {
        country: "Argentina",
        flag: "🇦🇷",
        currencyLocal: "ARS",
        withholdingRate: 0.05,
        withholdingLabel: "5%+ WHT (RG 830 scale, registered)",
        thresholdNote: "Applies above ARS 160,000/payment. Monotributistas exempt. Scale 5–31%.",
        taxIdName: "CUIT",
        taxIdRegex: /^\d{2}-\d{8}-\d$/,
        taxIdPlaceholder: "20-12345678-9",
        classificationSignals: [
            "Habitual, continuous personal service",
            "Employer supplies tools / email / business cards",
            "Works exclusively for this company",
            "Regular fixed monthly payment",
            "⚠ Argentina presumes EMPLOYMENT (LCT §23) — burden on company to disprove",
        ],
        source: "AFIP/ARCA RG 830 (RG 5423/2023, eff. 1 Oct 2023)",
        effectiveFrom: "2023-10-01",
    },
    Philippines: {
        country: "Philippines",
        flag: "🇵🇭",
        currencyLocal: "PHP",
        withholdingRate: 0.05,
        withholdingLabel: "5% EWT (≤ ₱3M, sworn declaration)",
        thresholdNote: "5% if gross ≤ ₱3M w/ sworn declaration; 10% if >₱3M; 15% if none filed.",
        taxIdName: "TIN",
        taxIdRegex: /^\d{3}-\d{3}-\d{3}(-\d{3,5})?$/,
        taxIdPlaceholder: "123-456-789",
        classificationSignals: [
            "Company controls how the work is done (method, not just result)",
            "Fixed schedule set by the company",
            "Economic dependence — no other clients",
            "Company-provided tools",
            "Power to dismiss / discipline",
        ],
        source: "BIR RR 11-2018 / RR 14-2023 (eff. 1 Jan 2024); Ditiangkin v. Lazada",
        effectiveFrom: "2024-01-01",
    },
};

export function getTaxRule(country: string): TaxRule | null {
    return taxRules[country] ?? null;
}

// Withholding computed in CODE, never by the AI.
export function computeWithholding(amount: number, country: string) {
    const rule = getTaxRule(country);
    if (!rule) return null;
    const withheld = Math.round(amount * rule.withholdingRate * 100) / 100;
    return {
        grossAmount: amount,
        withholdingRate: rule.withholdingRate,
        withheldAmount: withheld,
        netAmount: Math.round((amount - withheld) * 100) / 100,
        label: rule.withholdingLabel,
    };
}

export function validateTaxId(taxId: string, country: string): boolean {
    const rule = getTaxRule(country);
    if (!rule) return false;
    return rule.taxIdRegex.test(taxId.trim());
}