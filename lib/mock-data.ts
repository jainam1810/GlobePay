export type Contractor = {
    id: string;
    name: string;
    role: string;
    country: string;
    flag: string;
    currency: string;
    wallet: string;
    monthlyAmount: number;
    avatar: [string, string];
    taxId: string;          // contractor's tax ID (TIN / CUIT)
};

export const contractors: Contractor[] = [
    { id: "1", name: "Chidi Okafor", role: "Senior Developer", country: "Nigeria", flag: "🇳🇬", currency: "NGN", wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", monthlyAmount: 1000, avatar: ["#34e2b0", "#1a9e74"], taxId: "12345678-0001" },
    { id: "2", name: "Sofia Ramírez", role: "Product Designer", country: "Argentina", flag: "🇦🇷", currency: "ARS", wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", monthlyAmount: 1200, avatar: ["#7cc4ff", "#3b82f6"], taxId: "27-35876543-2" },
    { id: "3", name: "Liza Santos", role: "Content Writer", country: "Philippines", flag: "🇵🇭", currency: "PHP", wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", monthlyAmount: 800, avatar: ["#f5b14c", "#e8893b"], taxId: "234-567-890" },
    { id: "4", name: "Arjun Mehta", role: "Backend Engineer", country: "India", flag: "🇮🇳", currency: "INR", wallet: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", monthlyAmount: 1500, avatar: ["#c4a6ff", "#8b5cf6"], taxId: "ABCDE1234F" },
    { id: "5", name: "Diego Alves", role: "QA Engineer", country: "Brazil", flag: "🇧🇷", currency: "BRL", wallet: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", monthlyAmount: 950, avatar: ["#7ff0c2", "#16b886"], taxId: "123.456.789-09" },
];

export const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const formatUSD = (n: number) => `$${n.toLocaleString("en-US")}`;