"use client";
import AuditPack from "@/components/audit-pack";

export default function PortalAuditPackPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6 no-print">
                <div className="kicker">Records</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Audit pack</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    Everything your accountant asks for — who you paid, how much, the exchange rate on the day, and a
                    public transaction anyone can verify. One click to a PDF.
                </p>
            </div>
            <AuditPack />
        </div>
    );
}
