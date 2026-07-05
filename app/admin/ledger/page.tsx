"use client";
import TaxLedger from "@/components/tax-ledger";

export default function AdminLedgerPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6">
                <div className="kicker">All clients</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Tax ledger</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-md">Every tax entry across every client — treatment, withholding, and FX pinned at pay time, each tagged with its client.</p>
            </div>
            <TaxLedger />
        </div>
    );
}
