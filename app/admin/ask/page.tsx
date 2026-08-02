"use client";
// Same assistant, across every client's payments. Admins get the whole book;
// scoping happens server-side from the session, not from anything sent here.
import AskBot from "@/components/ask-bot";

export default function AdminAskPage() {
    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Ask</div>
                <h1 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mt-2">Ask about payments</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    Totals by period, country or contractor across every client. Each answer says how many records it
                    counted, so the number can be traced back.
                </p>
            </div>
            <div className="fade-up delay-1">
                <AskBot />
            </div>
        </div>
    );
}
