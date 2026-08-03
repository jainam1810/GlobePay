export type DbContractor = {
    id: string;
    created_at: string;
    client_id?: string | null;   // which client this freelancer belongs to
    name: string;
    role: string | null;
    country: string;
    currency: string;
    wallet: string;
    monthly_amount: number;
    tax_id: string | null;
    // Wallet ownership proof — see lib/wallet-verification.ts. Null until the
    // freelancer has signed for the address.
    wallet_verified_at?: string | null;
    verified_wallet?: string | null;
    verify_token?: string | null;
};

// What POST /api/contractors and PATCH /api/contractors/[id] accept off the
// wire. Every field is optional here because the payload is untrusted — the
// route's validate() is what decides which ones are actually required.
export type ContractorInput = {
    name?: string;
    role?: string | null;
    country?: string;
    currency?: string;
    wallet?: string;
    monthly_amount?: number | null;
    tax_id?: string | null;
    client_id?: string | null;
};

export const SUPPORTED_COUNTRIES = ["Nigeria", "Argentina", "Philippines"] as const;

export const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const formatUSD = (n: number) => `$${n.toLocaleString("en-US")}`;

const FLAGS: Record<string, string> = {
    Nigeria: "🇳🇬", Argentina: "🇦🇷", Philippines: "🇵🇭",
    "United Kingdom": "🇬🇧", "United States": "🇺🇸",
    India: "🇮🇳", Germany: "🇩🇪", Singapore: "🇸🇬", Brazil: "🇧🇷",
};
export const flagFor = (c: string) => FLAGS[c] ?? "🌐";

export const COMPANY_COUNTRIES = [
    "United Kingdom", "United States", "Nigeria", "Argentina",
    "Philippines", "India", "Germany", "Singapore", "Brazil",
];

// A company's home currency — used to show network fees in money the payer
// actually recognises instead of raw ETH.
const COMPANY_CURRENCY: Record<string, string> = {
    "United Kingdom": "GBP", "United States": "USD", Nigeria: "NGN",
    Argentina: "ARS", Philippines: "PHP", India: "INR",
    Germany: "EUR", Singapore: "SGD", Brazil: "BRL",
};
export const currencyForCountry = (country: string | null | undefined) =>
    (country && COMPANY_CURRENCY[country]) || "USD";
// deterministic gradient avatar from a name
export function avatarFor(name: string): [string, string] {
    const palettes: [string, string][] = [
        ["#34e2b0", "#1a9e74"], ["#7cc4ff", "#3b82f6"], ["#f5b14c", "#e8893b"],
        ["#c4a6ff", "#8b5cf6"], ["#7ff0c2", "#16b886"], ["#ffd27c", "#f5b14c"],
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palettes[h % palettes.length];
}