export type Contractor = {
    id: string;
    name: string;
    role: string;
    country: string;
    flag: string;
    currency: string;
    wallet: string;
    monthlyAmount: number;     // in USDC
    avatar: [string, string];  // gradient stops
};

export const contractors: Contractor[] = [
    { id: "1", name: "Chidi Okafor", role: "Senior Developer", country: "Nigeria", flag: "🇳🇬", currency: "NGN", wallet: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", monthlyAmount: 1000, avatar: ["#34e2b0", "#1a9e74"] },
    { id: "2", name: "Sofia Ramírez", role: "Product Designer", country: "Argentina", flag: "🇦🇷", currency: "ARS", wallet: "0x3A1b6C9eF2D4a8B7c5E0f1A2b3C4d5E6F7081920", monthlyAmount: 1200, avatar: ["#7cc4ff", "#3b82f6"] },
    { id: "3", name: "Liza Santos", role: "Content Writer", country: "Philippines", flag: "🇵🇭", currency: "PHP", wallet: "0x9F8e7D6c5B4a39281706f5E4d3C2b1A09f8e7D6c", monthlyAmount: 800, avatar: ["#f5b14c", "#e8893b"] },
    { id: "4", name: "Arjun Mehta", role: "Backend Engineer", country: "India", flag: "🇮🇳", currency: "INR", wallet: "0x2b3C4d5E6f70819203A1b6C9eF2D4a8B7c5E0f1A", monthlyAmount: 1500, avatar: ["#c4a6ff", "#8b5cf6"] },
    { id: "5", name: "Diego Alves", role: "QA Engineer", country: "Brazil", flag: "🇧🇷", currency: "BRL", wallet: "0x5E6f70819203A1b6C9eF2D4a8B7c2b3C4d5E6f70", monthlyAmount: 950, avatar: ["#7ff0c2", "#16b886"] },
];

export const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const formatUSD = (n: number) => `$${n.toLocaleString("en-US")}`;