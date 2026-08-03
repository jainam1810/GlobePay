"use client";
// One search box for the whole product.
//
// Built on cmdk, the library shadcn's Command wraps, because the hard part of a
// palette is not the list — it is the scoring. cmdk ranks with command-score,
// which favours prefix and contiguous matches over letters scattered through a
// string, so typing "pay" puts Payments above "Nigeria payroll".
//
// Pages rank above everything else, and that is deliberate rather than a
// consequence of scoring. Someone typing three letters into a nav search is
// usually trying to go somewhere; the record they want is the rarer, more
// specific intent, and it arrives underneath — where it is still one arrow key
// away. cmdk sorts within a group but renders groups in DOM order, so ordering
// the groups is all it takes.
//
// Pages are matched locally because the list is fixed and known. Only the
// database half is fetched, debounced, and it never blocks the page list from
// responding to the first keystroke.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
    BarChart3, Building2, FileText, History, Home, LayoutDashboard,
    MessagesSquare, Receipt, Search, Settings, User, Wallet,
} from "lucide-react";
import Flag from "@/components/flag";
import type { SearchHit } from "@/app/api/search/route";

type Page = {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    /** Words someone might type that aren't in the label. */
    keywords?: string;
};

const PORTAL_PAGES: Page[] = [
    { href: "/portal", label: "Home", icon: Home, keywords: "payroll dashboard start" },
    { href: "/portal/analytics", label: "Analytics", icon: BarChart3, keywords: "charts spend trends" },
    { href: "/portal/payments", label: "Payments", icon: History, keywords: "history receipts paid transactions" },
    { href: "/portal/audit-pack", label: "Audit pack", icon: FileText, keywords: "records export pdf accountant invoices" },
    { href: "/portal/messages", label: "Messages", icon: MessagesSquare, keywords: "support contact chat" },
    { href: "/portal/settings", label: "Settings", icon: Settings, keywords: "account password email wallet company profile" },
];

const ADMIN_PAGES: Page[] = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, keywords: "dashboard start" },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3, keywords: "charts spend trends" },
    { href: "/admin/clients", label: "Clients", icon: Building2, keywords: "companies accounts freelancers roster" },
    { href: "/admin/payments", label: "All payments", icon: History, keywords: "history receipts paid transactions" },
    { href: "/admin/audit-pack", label: "Audit pack", icon: FileText, keywords: "records export pdf invoices" },
    { href: "/admin/messages", label: "Messages", icon: MessagesSquare, keywords: "support chat" },
    { href: "/admin/settings", label: "Settings", icon: Settings, keywords: "account password email" },
];

const KIND_ICON = { freelancer: User, record: Receipt, payment: Wallet } as const;
const KIND_GROUP = { freelancer: "Freelancers", record: "Invoices", payment: "Payments" } as const;
/** Groups render in this order; scoring only reorders rows inside one. */
const KIND_ORDER = ["freelancer", "record", "payment"] as const;

export default function CommandSearch({ role }: { role: "client" | "globepay_admin" }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [loading, setLoading] = useState(false);

    const pages = role === "globepay_admin" ? ADMIN_PAGES : PORTAL_PAGES;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const term = q.trim();
    // One character matches half the database, so the round trip only starts at
    // two. Below that the results are *derived* away rather than cleared with a
    // setState — deleting back to one letter would otherwise be a state update
    // in an effect body, and a render triggering another render.
    const active = term.length >= 2;

    const shownLoading = active && loading;

    // Debounced, and every response carries the query it answered so a slow
    // reply for "ak" can't overwrite the results for "akil".
    const seq = useRef(0);
    useEffect(() => {
        if (!active) return;
        const mine = ++seq.current;
        const t = setTimeout(() => {
            setLoading(true);
            fetch(`/api/search?q=${encodeURIComponent(term)}`)
                .then((r) => r.json())
                .then((j) => { if (seq.current === mine) setHits(j.hits ?? []); })
                .catch(() => { if (seq.current === mine) setHits([]); })
                .finally(() => { if (seq.current === mine) setLoading(false); });
        }, 180);
        return () => clearTimeout(t);
    }, [term, active]);

    const go = useCallback((href: string) => {
        setOpen(false);
        setQ("");
        router.push(href);
    }, [router]);

    const grouped = useMemo(
        () => (active ? KIND_ORDER
            .map((k) => [k, hits.filter((h) => h.kind === k)] as const)
            .filter(([, v]) => v.length > 0) : []),
        [hits, active],
    );

    const item = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--text-dim)] data-[selected=true]:bg-[var(--surface-2)] data-[selected=true]:text-[var(--text)]";

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="Search"
                className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-left text-[13px] text-[var(--text-faint)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-dim)]"
            >
                <Search size={14} className="shrink-0" />
                <span className="flex-1 truncate">Search</span>
                {/* The shortcut is on the control it triggers, which is where
                    people find out a product has one. */}
                <kbd className="hidden shrink-0 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] lg:block">
                    ⌘K
                </kbd>
            </button>

            <Command.Dialog
                open={open}
                onOpenChange={setOpen}
                label="Search GlobePay"
                shouldFilter={false}
                className="fixed left-1/2 top-[12vh] z-[90] w-[min(calc(100vw-2rem),560px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]"
                overlayClassName="fixed inset-0 z-[89] bg-black/60 backdrop-blur-[2px]"
            >
                <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4">
                    <Search size={15} className="shrink-0 text-[var(--text-faint)]" />
                    <Command.Input
                        value={q}
                        onValueChange={setQ}
                        placeholder="Search pages, freelancers, invoices…"
                        className="w-full bg-transparent py-3.5 text-[14px] outline-none placeholder:text-[var(--text-faint)]"
                    />
                </div>

                <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
                    <PageGroup pages={pages} q={q} onPick={go} itemCls={item} />

                    {grouped.map(([kind, rows]) => {
                        const Icon = KIND_ICON[kind];
                        return (
                            <Command.Group
                                key={kind}
                                heading={KIND_GROUP[kind]}
                                className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-faint)]"
                            >
                                {rows.map((h) => (
                                    <Command.Item key={h.id} value={h.id} onSelect={() => go(h.href)} className={item}>
                                        <Icon size={15} strokeWidth={1.8} className="shrink-0 text-[var(--text-faint)]" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{h.title}</span>
                                            {h.subtitle && (
                                                <span className="block truncate font-mono text-[11px] text-[var(--text-faint)]">{h.subtitle}</span>
                                            )}
                                        </span>
                                        {h.country && <Flag country={h.country} size={14} label={false} />}
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        );
                    })}

                    {active && (
                        <Command.Empty className="px-3 py-6 text-center text-[12px] text-[var(--text-faint)]">
                            {shownLoading ? "Searching…" : `Nothing matches “${q.trim()}”`}
                        </Command.Empty>
                    )}
                </Command.List>

                <div className="flex items-center gap-3 border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--text-faint)]">
                    <span><kbd className="font-mono">↑↓</kbd> move</span>
                    <span><kbd className="font-mono">↵</kbd> open</span>
                    <span><kbd className="font-mono">esc</kbd> close</span>
                </div>
            </Command.Dialog>
        </>
    );
}

/**
 * The page list, matched here rather than by cmdk's filter.
 *
 * cmdk's built-in filtering scores every item in the list against the query and
 * sorts globally, which would let a well-named invoice outrank a page. Filtering
 * pages ourselves and rendering them in their own group first keeps navigation
 * on top no matter what the database returns.
 */
function PageGroup({ pages, q, onPick, itemCls }: {
    pages: Page[];
    q: string;
    onPick: (href: string) => void;
    itemCls: string;
}) {
    const term = q.trim().toLowerCase();
    const shown = useMemo(() => {
        if (!term) return pages;
        const scored = pages
            .map((p) => {
                const label = p.label.toLowerCase();
                // A page you are part-way through typing beats one that merely
                // contains the letters, and both beat a keyword-only match.
                const rank = label.startsWith(term) ? 0
                    : label.includes(term) ? 1
                        : p.keywords?.includes(term) ? 2 : -1;
                return { p, rank };
            })
            .filter((x) => x.rank >= 0)
            .sort((a, b) => a.rank - b.rank);
        return scored.map((x) => x.p);
    }, [pages, term]);

    if (shown.length === 0) return null;

    return (
        <Command.Group
            heading="Pages"
            className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-faint)]"
        >
            {shown.map((p) => (
                <Command.Item key={p.href} value={p.href} onSelect={() => onPick(p.href)} className={itemCls}>
                    <p.icon size={15} strokeWidth={1.8} className="shrink-0 text-[var(--text-faint)]" />
                    <span className="flex-1 truncate">{p.label}</span>
                </Command.Item>
            ))}
        </Command.Group>
    );
}
