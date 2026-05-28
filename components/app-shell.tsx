"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Send, Users, FileText, Database, Download } from "lucide-react";
import ConnectButton from "@/components/connect-button";
import WalletCard from "@/components/wallet-card";
import CompanyBadge from "@/components/company-badge";

const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/", label: "Payroll", icon: Send },
    { href: "/contractors", label: "Contractors", icon: Users },
    { href: "/invoices", label: "Invoices", icon: FileText },
    { href: "/records", label: "Records", icon: Database },
    { href: "/export", label: "Export", icon: Download },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <div className="relative z-[1] flex min-h-screen">
            <aside className="hidden md:flex w-[252px] shrink-0 flex-col justify-between border-r border-[var(--border)] px-4 py-6">
                <div>
                    <Link href="/" className="flex items-center gap-2.5 px-2 mb-9">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-[#04130d] font-display font-bold text-lg shadow-[0_0_24px_var(--accent-glow)]">G</div>
                        <span className="font-display text-xl font-semibold tracking-tight">GlobePay</span>
                    </Link>
                    <nav className="flex flex-col gap-1">
                        {nav.map((item) => (
                            <Link key={item.label} href={item.href} className={`nav-item ${isActive(item.href) ? "nav-item-active" : ""}`}>
                                <item.icon size={18} strokeWidth={1.8} />
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>
                <WalletCard />
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="flex items-center justify-between border-b border-[var(--border)] px-6 md:px-10 h-16">
                    <div className="md:hidden font-display text-lg font-semibold">GlobePay</div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-3">
                        <CompanyBadge />
                        <span className="pill"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Base Sepolia</span>
                        <ConnectButton />
                    </div>
                </header>
                <main className="flex-1 px-6 md:px-10 py-8 md:py-10">{children}</main>
            </div>
        </div>
    );
}