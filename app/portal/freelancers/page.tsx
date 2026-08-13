"use client";
import FreelancerRoster from "@/components/freelancer-roster";

export default function PortalFreelancersPage() {
    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up mb-6">
                <div className="kicker">Your team</div>
                <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">Freelancers</h1>
                <p className="mt-2 max-w-lg text-[var(--text-dim)]">
                    Everyone you pay, and whether they&rsquo;ve confirmed their wallet is theirs.
                </p>
            </div>
            <div className="fade-up delay-1">
                <FreelancerRoster />
            </div>
        </div>
    );
}
