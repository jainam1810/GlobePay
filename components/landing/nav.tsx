"use client";
// Site chrome for the marketing page.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu } from "lucide-react";
import { Sheet } from "@/components/ui/overlays";
import { Button } from "@/components/ui/kit";

// Anchors resolve against the home page, so they still work from /contact.
const LINKS = [
    { href: "/#how", label: "How it works" },
    { href: "/#platform", label: "Platform" },
    { href: "/#proof", label: "Proof" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#roadmap", label: "Roadmap" },
    { href: "/#faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
];

export function Logo({ size = 32 }: { size?: number }) {
    return (
        <span className="flex items-center gap-2.5">
            <span
                className="grid shrink-0 place-items-center rounded-[10px] text-white"
                style={{
                    width: size, height: size,
                    background: "linear-gradient(145deg, var(--accent-hi), var(--accent) 55%, var(--accent-deep))",
                    boxShadow: "0 1px 0 rgba(255,255,255,0.28) inset, 0 8px 20px -8px var(--accent-glow)",
                }}
            >
                <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none" aria-hidden>
                    <path d="M3 8h13a4 4 0 0 1 0 8H8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                    <path d="M21 16H8a4 4 0 0 1 0-8h1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
                </svg>
            </span>
            <span className="text-[17px] font-medium tracking-[-0.02em]">GlobePay</span>
        </span>
    );
}

export function SiteNav() {
    const [solid, setSolid] = useState(false);
    const [open, setOpen] = useState(false);

    // Transparent over the hero, then a real bar once you have left it. A
    // permanently opaque header steals 60px from the first impression.
    useEffect(() => {
        const onScroll = () => setSolid(window.scrollY > 24);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={`fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300 ${solid
                ? "border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_78%,transparent)] backdrop-blur-xl"
                : "border-b border-transparent"
                }`}
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-8">
                <Link href="/" aria-label="GlobePay home" className="-my-2 py-2"><Logo /></Link>

                <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">
                    {LINKS.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            className="rounded-lg px-3 py-2 text-[14px] text-[var(--text-dim)] transition-colors hover:text-white"
                        >
                            {l.label}
                        </a>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <Button asChild size="sm" className="hidden sm:inline-flex">
                        <Link href="/login">Open the app <ArrowUpRight size={15} /></Link>
                    </Button>
                    <button
                        onClick={() => setOpen(true)}
                        aria-label="Open menu"
                        className="-mr-1 rounded-lg p-3 text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-white lg:hidden"
                    >
                        <Menu size={20} />
                    </button>
                </div>
            </div>

            <Sheet open={open} onOpenChange={setOpen} title="Menu">
                <nav className="flex flex-col" aria-label="Sections">
                    {LINKS.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            onClick={() => setOpen(false)}
                            className="border-b border-[var(--border)] py-3.5 text-[15px] text-[var(--text-dim)] transition hover:text-white"
                        >
                            {l.label}
                        </a>
                    ))}
                </nav>
                <Button asChild className="mt-5 w-full">
                    <Link href="/login" onClick={() => setOpen(false)}>Open the app <ArrowUpRight size={15} /></Link>
                </Button>
            </Sheet>
        </header>
    );
}

const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
    {
        title: "Product",
        links: [
            { label: "How it works", href: "#how" },
            { label: "Platform", href: "#platform" },
            { label: "Pricing", href: "#pricing" },
            { label: "Open the app", href: "/login" },
        ],
    },
    {
        title: "Built on",
        links: [
            { label: "Base", href: "https://base.org" },
            { label: "USDC", href: "https://www.circle.com/usdc" },
        ],
    },
    {
        title: "Trust",
        links: [
            { label: "Non-custodial", href: "#proof" },
            { label: "Audit pack", href: "#platform" },
            { label: "Contact us", href: "/contact" },
        ],
    },
];

export function SiteFooter() {
    return (
        <footer className="border-t border-[var(--border)] px-5 pb-10 pt-14 sm:px-8">
            <div className="mx-auto max-w-6xl">
                <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
                    <div className="max-w-xs">
                        <Logo size={30} />
                        <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-dim)]">
                            Non-custodial payroll for international freelancers. Paid in USDC, from your
                            own wallet, with the audit trail written as you go.
                        </p>
                    </div>

                    {FOOTER.map((col) => (
                        <div key={col.title}>
                            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">
                                {col.title}
                            </div>
                            <ul className="mt-4 space-y-2.5">
                                {col.links.map((l) => (
                                    <li key={l.label}>
                                        <a
                                            href={l.href}
                                            target={l.href.startsWith("http") ? "_blank" : undefined}
                                            rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                                            className="text-[13px] text-[var(--text-dim)] transition-colors hover:text-white"
                                        >
                                            {l.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-6 text-[12px] text-[var(--text-faint)] sm:flex-row sm:items-center">
                    <span>© {new Date().getFullYear()} GlobePay. Not a bank. Funds move wallet to wallet.</span>
                    <span className="flex items-center gap-2">
                        <span className="dot dot-pending" /> Running on Base Sepolia testnet
                    </span>
                </div>
            </div>
        </footer>
    );
}
