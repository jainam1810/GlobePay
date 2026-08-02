"use client";
import Analytics from "@/components/analytics";

export default function PortalAnalyticsPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6">
                <div className="kicker">Analytics</div>
                <h1 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mt-2">Your payments at a glance</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    What you&rsquo;ve paid, where it went and to whom — over any period. Every chart has a table view,
                    and every figure comes from your own payment records.
                </p>
            </div>
            <Analytics />
        </div>
    );
}
