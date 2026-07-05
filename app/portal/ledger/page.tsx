"use client";
import TaxLedger from "@/components/tax-ledger";

export default function PortalLedgerPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6">
                <div className="kicker">Compliance</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Tax ledger</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-md">One entry per freelancer per payroll — tax treatment, withholding, and FX rate frozen at pay time. Audit-ready, year after year.</p>
            </div>
            <TaxLedger />
        </div>
    );
}
