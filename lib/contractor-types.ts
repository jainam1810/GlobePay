export type DbContractor = {
    id: string;
    created_at: string;
    name: string;
    role: string | null;
    country: string;
    currency: string;
    wallet: string;
    monthly_amount: number;
    tax_id: string | null;
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