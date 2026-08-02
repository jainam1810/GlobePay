"use client";
import Conversation from "@/components/conversation";

export default function PortalMessagesPage() {
    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Messages</div>
                <h1 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mt-2">Talk to GlobePay</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    Send an invoice, ask about a payment, or flag a change to your team — here rather than by email.
                    Everything stays attached to your account, so nothing gets lost in someone&rsquo;s inbox.
                </p>
            </div>
            <div className="fade-up delay-1">
                <Conversation me="client" />
            </div>
        </div>
    );
}
