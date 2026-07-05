"use client";
import PaymentHistory from "@/components/payment-history";

export default function PortalPaymentsPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6">
                <div className="kicker">Your history</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Payments</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-md">Every payroll you&rsquo;ve confirmed — a plain-language receipt for each, backed by proof on the blockchain.</p>
            </div>
            <PaymentHistory />
        </div>
    );
}
