"use client";
import InvoiceQueue from "@/components/invoice-queue";
import ReadyToPay from "@/components/ready-to-pay";

export default function AdminInvoicesPage() {
    return (
        <div className="mx-auto max-w-4xl">
            <div className="fade-up mb-6">
                <div className="kicker">Review</div>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Invoices</h1>
                <p className="mt-2 max-w-lg text-[var(--text-dim)]">
                    Everything clients have sent, already read. Check each against the document, correct
                    anything the AI got wrong, and accept — nothing is paid until a run is confirmed.
                </p>
            </div>
            {/* Above the queue: what has already been checked and is waiting to
                be turned into a run. Nothing to show until something is accepted. */}
            <div className="fade-up delay-1 mb-6">
                <ReadyToPay />
            </div>
            <div className="fade-up delay-1">
                <InvoiceQueue />
            </div>
        </div>
    );
}
