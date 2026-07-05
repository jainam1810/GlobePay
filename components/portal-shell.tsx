"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Scale } from "lucide-react";
import ConnectButton from "@/components/connect-button";
import SignOutButton from "@/components/sign-out-button";
import { flagFor } from "@/lib/contractor-types";

const nav = [
    { href: "/portal", label: "Home", icon: Home },
    { href: "/portal/payments", label: "Payments", icon: History },
    { href: "/portal/ledger", label: "Tax ledger", icon: Scale },
];

export default function PortalShell({ children, companyName, homeCountry, email }:
    { children: React.ReactNode; companyName: string; homeCountry: string; email: string | null }) {
    const pathname = usePathname();
    const isActive = (href: string) => href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

    return (
        <div className="relative z-[1] flex min-h-screen">
            <aside className="hidden md:flex w-[252px] shrink-0 flex-col justify-between border-r border-[var(--border)] px-4 py-6">
                <div>
                    <Link href="/portal" className="flex items-center gap-2.5 px-2 mb-2">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-[#04130d] font-display font-bold text-lg shadow-[0_0_24px_var(--accent-glow)]">G</div>
                        <span className="font-display text-xl font-semibold tracking-tight">GlobePay</span>
                    </Link>
                    <div className="px-2 mb-7">
                        <span className="pill">{flagFor(homeCountry)} {companyName}</span>
                    </div>
                    <nav className="flex flex-col gap-1">
                        {nav.map((item) => (
                            <Link key={item.label} href={item.href} className={`nav-item ${isActive(item.href) ? "nav-item-active" : ""}`}>
                                <item.icon size={18} strokeWidth={1.8} />
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>
                <div>
                    {email && <div className="px-2 pb-2 text-[11px] font-mono text-[var(--text-faint)] truncate">{email}</div>}
                    <SignOutButton />
                </div>
            </aside>
            <div className="flex-1 flex flex-col min-w-0">
                <header className="flex items-center justify-between border-b border-[var(--border)] px-6 md:px-10 h-16">
                    <div className="md:hidden font-display text-lg font-semibold">{companyName}</div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-3">
                        <span className="pill"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Base Sepolia</span>
                        <ConnectButton />
                    </div>
                </header>
                <main className="flex-1 px-6 md:px-10 py-8 md:py-10">{children}</main>
            </div>
        </div>
    );
}
