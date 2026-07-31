// Marketing home. The app itself lives behind /login → /route, which sends
// admins to /admin and clients to /portal.
//
// Scrolling is deliberately native. An earlier version eased the content toward
// the real scroll position (lerp), which trails the wheel by design and reads as
// lag however fast you spin it — and it breaks the platform's own momentum,
// trackpad and keyboard behaviour. The reveals below carry the motion instead.
import {
    Hero, Dashboard, PaymentRun, InvoiceAI, TaxAudit, Closer, SiteNav, SiteFooter,
} from "@/components/landing/sections";

export default function Home() {
    return (
        <>
            <SiteNav />
            <main className="relative z-[1]">
                <Hero />
                <Dashboard />
                <PaymentRun />
                <InvoiceAI />
                <TaxAudit />
                <Closer />
            </main>
            <SiteFooter />
        </>
    );
}
