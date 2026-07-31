"use client";
// Marketing home. The app itself lives behind /login → /route, which sends
// admins to /admin and clients to /portal.
import { useSmoothScroll } from "@/components/landing/motion";
import {
    Hero, Dashboard, PaymentRun, InvoiceAI, TaxAudit, Closer, SiteNav, SiteFooter,
} from "@/components/landing/sections";

export default function Home() {
    // Eases the page toward the real scroll position. No-ops on touch, small
    // screens and reduced-motion, where it would fight the platform instead of
    // helping — see components/landing/motion.tsx.
    const scroller = useSmoothScroll();

    return (
        <>
            <SiteNav />
            <div ref={scroller}>
                <main className="relative z-[1]">
                    <Hero />
                    <Dashboard />
                    <PaymentRun />
                    <InvoiceAI />
                    <TaxAudit />
                    <Closer />
                </main>
                <SiteFooter />
            </div>
        </>
    );
}
