"use client";
import InvoiceUpload from "@/components/invoice-upload";

export default function PortalInvoicesPage() {
    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Invoices</div>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Send us invoices</h1>
                <p className="mt-2 max-w-lg text-[var(--text-dim)]">
                    Upload a whole month at once. We read each one, check it against your roster, and it
                    joins the next payment run — you approve that, as always, with one signature.
                </p>
            </div>
            <div className="fade-up delay-1">
                <InvoiceUpload />
            </div>
        </div>
    );
}
