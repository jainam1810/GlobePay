import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/landing/nav";
import { HowItWorks } from "@/components/landing/how-it-works";

// Its own page rather than a section, so "How it works" in the nav is somewhere
// you can link to, bookmark and send to a colleague — not a scroll position that
// moves the next time a section is added above it. It also earns a title and a
// description of its own, which a hash fragment never gets.
export const metadata: Metadata = {
    title: "How GlobePay works — from your wallet to your team",
    description:
        "Five steps: connect your own wallet, fund it with USDC yourself, add who to pay, we check the run before you sign, and one signature pays everyone. GlobePay never holds your money.",
};

export default function HowItWorksPage() {
    return (
        <>
            <SiteNav />
            {/* pt-32 clears the fixed nav, matching /contact. */}
            <main className="relative z-[1] px-5 pb-24 pt-32 sm:px-8 md:pt-40">
                <HowItWorks />
            </main>
            <SiteFooter />
        </>
    );
}
