"use client";
import PaymentHistory from "@/components/payment-history";

export default function AdminPaymentsPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6">
                <div className="kicker">All clients</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Payments</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-md">Every payroll across every client — each tagged with its client and backed by on-chain proof.</p>
            </div>
            <PaymentHistory allowImport />
        </div>
    );
}
