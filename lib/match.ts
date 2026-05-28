import { contractors, type Contractor } from "@/lib/mock-data";

export function findContractorByName(payeeName: string): Contractor | null {
    if (!payeeName) return null;
    const needle = payeeName.toLowerCase().trim();

    for (const c of contractors) {
        if (c.name.toLowerCase() === needle) return c;
    }
    for (const c of contractors) {
        const parts = c.name.toLowerCase().split(" ");
        if (parts.some((p) => p.length >= 3 && needle.includes(p))) return c;
    }
    return null;
}