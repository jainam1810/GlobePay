"use client";
import Analytics from "@/components/analytics";

export default function AdminAnalyticsPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6">
                <div className="kicker">Analytics</div>
                <h1 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mt-2">Across every client</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    Volume by month, country, contractor and client. Filter once at the top and every chart follows.
                </p>
            </div>
            <Analytics scopeLabel="all clients" />
        </div>
    );
}
