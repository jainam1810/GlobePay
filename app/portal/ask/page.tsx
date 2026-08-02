"use client";
import AskBot from "@/components/ask-bot";

export default function PortalAskPage() {
    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Ask</div>
                <h1 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mt-2">Ask about your payments</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    &ldquo;How much went to Argentina last year?&rdquo; — answered from your own records, in a sentence.
                    Every figure is calculated from the payments themselves, not written by a model.
                </p>
            </div>
            <div className="fade-up delay-1">
                <AskBot />
            </div>
        </div>
    );
}
