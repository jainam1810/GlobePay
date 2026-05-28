"use client";
import { useEffect, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { COMPANY_COUNTRIES, flagFor } from "@/lib/contractor-types";

export default function CompanyBadge() {
    const [country, setCountry] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        fetch("/api/company").then((r) => r.json()).then((j) => setCountry(j?.company?.home_country ?? null)).catch(() => { });
    }, []);

    async function choose(c: string) {
        setCountry(c); setOpen(false);
        await fetch("/api/company", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ home_country: c }) });
    }

    return (
        <div className="relative">
            <button onClick={() => setOpen((o) => !o)} className="pill hover:bg-[var(--surface-2)] transition-colors">
                <Building2 size={13} /> HQ {country ? flagFor(country) : "…"}
                <ChevronDown size={12} className="opacity-60" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 card p-1.5 z-50 max-h-72 overflow-auto">
                        {COMPANY_COUNTRIES.map((c) => (
                            <button key={c} onClick={() => choose(c)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-[var(--surface-2)] transition ${c === country ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`}>
                                <span>{flagFor(c)}</span> {c}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}