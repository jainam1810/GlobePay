"use client";
// Marketing sections.
//
// Each one shows the product doing the thing it claims rather than describing
// it — the ledger rows, the payment run and the confirmation below are built
// from the same tokens as the real app, so what you see here is what you get.
//
// House rules for this page:
//   · Every number stated is one the product actually produces.
//   · No invented customers, logos or testimonials. The trust section is
//     verifiable facts with links, which is worth more than a fake quote.
//   · Motion arrives content and then stops. Nothing loops but the marquee.
import Link from "next/link";
import {
    ArrowRight, ArrowUpRight, Check, FileText, Layers, Lock,
    Receipt, ShieldCheck, Sparkles, Wallet,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem, Parallax, CountUp, Marquee, Tilt } from "@/components/ui/motion";
import { Button } from "@/components/ui/kit";
import { Accordion } from "@/components/ui/overlays";
import { IsoArt } from "@/components/landing/iso-art";

const DISPERSE = "0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897";
const SCAN = `https://sepolia.basescan.org/address/${DISPERSE}`;

/** Wallet addresses truncate in the middle — the ends are what people check. */
const addr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/* ── shared ─────────────────────────────────────────────────────────────── */

function Tag({ children }: { children: React.ReactNode }) {
    return <span className="tag">{children}</span>;
}

function Head({ tag, title, blurb, center = false }: {
    tag: string; title: React.ReactNode; blurb?: string; center?: boolean;
}) {
    return (
        <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
            <Reveal><Tag>{tag}</Tag></Reveal>
            <Reveal index={1}>
                <h2 className="text-gradient mt-5 text-[clamp(2rem,4.6vw,3.4rem)] font-medium leading-[1.06] tracking-[-0.035em]">
                    {title}
                </h2>
            </Reveal>
            {blurb && (
                <Reveal index={2}>
                    <p className={`mt-4 text-[15px] leading-relaxed text-[var(--text-dim)] ${center ? "mx-auto max-w-xl" : "max-w-lg"}`}>
                        {blurb}
                    </p>
                </Reveal>
            )}
        </div>
    );
}

/* ── 1. hero ────────────────────────────────────────────────────────────── */

const BUILT_ON = ["Base", "USDC", "Circle", "Supabase", "Next.js", "viem"];

export function Hero() {
    return (
        <section className="relative overflow-hidden px-5 pb-14 pt-28 sm:px-8 md:pb-20 md:pt-36">
            <div aria-hidden className="absolute inset-0 -z-10">
                <div className="grid-bg" />
                <div className="hero-glow-a left-[70%] top-[-24%] h-[560px] w-[560px] md:h-[780px] md:w-[780px]" />
                <div className="hero-glow-b left-[4%] top-[34%] h-[380px] w-[380px] md:h-[520px] md:w-[520px]" />
            </div>

            <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div>
                    <Reveal>
                        <a
                            href={SCAN}
                            target="_blank"
                            rel="noreferrer"
                            className="group inline-flex items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] py-1 pl-4 pr-1 text-[13px] text-[var(--text-dim)] transition hover:border-[var(--accent-line)]"
                        >
                            <span className="flex items-center gap-2">
                                <span className="dot dot-ok" /> Live on Base
                            </span>
                            <span aria-hidden className="hidden h-3 w-px bg-[var(--border-strong)] sm:block" />
                            <span className="hidden sm:inline">Contract verified</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-white">
                                View <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
                            </span>
                        </a>
                    </Reveal>

                    <Reveal index={1}>
                        <h1 className="text-gradient mt-7 text-[clamp(2.6rem,6.4vw,4.6rem)] font-medium leading-[1.03] tracking-[-0.04em]">
                            Payroll Built for<br />the Borderless<br />World
                        </h1>
                    </Reveal>

                    <Reveal index={2}>
                        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)] md:text-base">
                            Pay every international contractor in USDC — one transaction, one
                            signature, straight from your own wallet. GlobePay never holds your
                            funds or your keys.
                        </p>
                    </Reveal>

                    <Reveal index={3}>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Button asChild variant="ghost" size="lg">
                                <a href="#how">See how it works</a>
                            </Button>
                            <Button asChild size="lg">
                                <Link href="/login">Open the app <ArrowUpRight size={16} /></Link>
                            </Button>
                        </div>
                    </Reveal>

                    <Reveal index={4}>
                        <div className="mt-11 flex items-center gap-5">
                            <span className="shrink-0 text-[12px] text-[var(--text-faint)]">Built on</span>
                            <Marquee duration={30} fade="right" className="min-w-0 flex-1">
                                {BUILT_ON.map((n) => (
                                    <span key={n} className="px-6 text-[15px] font-medium tracking-[-0.01em] text-[var(--text-faint)]">
                                        {n}
                                    </span>
                                ))}
                            </Marquee>
                        </div>
                    </Reveal>
                </div>

                <Parallax distance={34} className="hidden lg:block">
                    <IsoArt className="h-[520px] w-full" />
                </Parallax>
            </div>
        </section>
    );
}

/* ── 2. global payroll ──────────────────────────────────────────────────── */

// Invented people. This page is public, and the roster in the database belongs
// to a real company — no name, wallet or amount from it appears here. The
// countries are real because they are the three GlobePay actually supports.
const PAYEES = [
    { name: "Amara Eze", note: "Backend engineer", flag: "🇳🇬", amount: "2,400.00" },
    { name: "Lucía Moreno", note: "Product designer", flag: "🇦🇷", amount: "1,850.00" },
    { name: "Miguel Santos", note: "QA engineer", flag: "🇵🇭", amount: "1,200.00" },
];

export function GlobalPayroll() {
    return (
        <section id="how" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
                <div>
                    <Head
                        tag="Global payroll"
                        title={<>Pay Every Country<br />on the Same Day</>}
                        blurb="No correspondent banks, no three-day wires, no wondering which intermediary took a cut. Contractors are paid in dollars they can hold, wherever they are."
                    />

                    <StaggerGroup className="mt-10 grid grid-cols-3 gap-6">
                        {[
                            { v: <CountUp to={1} />, l: "Transaction, however many contractors" },
                            { v: <CountUp to={0} />, l: "Custody — funds never touch us" },
                            { v: <CountUp to={3} />, l: "Countries with tax handled" },
                        ].map((s, i) => (
                            <StaggerItem key={i}>
                                <div className="text-[28px] font-medium tracking-[-0.03em] text-white">{s.v}</div>
                                <div className="mt-1.5 text-[12px] leading-snug text-[var(--text-faint)]">{s.l}</div>
                            </StaggerItem>
                        ))}
                    </StaggerGroup>
                </div>

                <Reveal index={1}>
                    <Tilt max={5}>
                        <div className="panel p-6 md:p-8">
                            <div aria-hidden className="grid-bg opacity-60" />
                            <div className="relative space-y-3">
                                {PAYEES.map((p) => (
                                    <div
                                        key={p.name}
                                        className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.05)] px-4 py-3.5 backdrop-blur-md"
                                    >
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgba(255,255,255,0.08)] text-[16px]">
                                            {p.flag}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[14px] font-medium">
                                                {p.name} <span className="font-normal text-[var(--text-faint)]">paid</span>
                                            </div>
                                            <div className="truncate text-[12px] text-[var(--text-faint)]">{p.note}</div>
                                        </div>
                                        <span className="font-mono text-[14px] text-[var(--accent-hi)]">${p.amount}</span>
                                    </div>
                                ))}
                            </div>

                            {/* The horizon: a wire globe implied by two arcs, which
                                is enough at this size and costs nothing. */}
                            <div aria-hidden className="relative mt-8 h-32 overflow-hidden">
                                <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full border border-[rgba(255,255,255,0.16)]" />
                                <div className="absolute left-1/2 top-0 h-64 w-40 -translate-x-1/2 rounded-full border border-[rgba(255,255,255,0.10)]" />
                                <div className="absolute left-1/2 top-8 h-48 w-64 -translate-x-1/2 rounded-[100%] border border-[rgba(255,255,255,0.08)]" />
                                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#080A11] to-transparent" />
                            </div>
                        </div>
                    </Tilt>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 3. platform ────────────────────────────────────────────────────────── */

export function Platform() {
    return (
        <section id="platform" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    tag="The platform"
                    title={<>Everything Payroll Needs,<br />Nothing It Doesn&rsquo;t</>}
                />

                <div className="mt-11 grid gap-4 lg:grid-cols-2">
                    <Reveal index={1}>
                        <div className="card card-lift h-full overflow-hidden p-6 md:p-8">
                            <h3 className="text-[19px] font-medium tracking-[-0.02em]">Non-Custodial by Design</h3>
                            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-dim)]">
                                USDC moves from your wallet to theirs. We prepare the run and keep the
                                records — we never hold a balance or a key.
                            </p>

                            <div className="mt-7 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-4">
                                <div className="flex items-center justify-between text-[12px] text-[var(--text-faint)]">
                                    <span>Payment route</span>
                                    <span className="flex items-center gap-1.5 text-[var(--ok)]"><Lock size={12} /> No custody</span>
                                </div>
                                <div className="mt-4 flex items-center gap-2.5">
                                    {[
                                        { icon: Wallet, label: "Your wallet" },
                                        { icon: Layers, label: "Disperse" },
                                        { icon: Receipt, label: "Contractors" },
                                    ].map((s, i, all) => (
                                        <div key={s.label} className="flex min-w-0 flex-1 items-center gap-2.5">
                                            <div className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-3 text-center">
                                                <s.icon size={15} className="mx-auto text-[var(--accent)]" />
                                                <div className="mt-1.5 truncate text-[11px] text-[var(--text-dim)]">{s.label}</div>
                                            </div>
                                            {i < all.length - 1 && <ArrowRight size={13} className="shrink-0 text-[var(--text-faint)]" />}
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-3 text-center font-mono text-[11px] text-[var(--text-faint)]">
                                    No admin key · no pause · no upgrade
                                </p>
                            </div>
                        </div>
                    </Reveal>

                    <Reveal index={2}>
                        <div className="card card-lift h-full overflow-hidden p-6 md:p-8">
                            <h3 className="text-[19px] font-medium tracking-[-0.02em]">Proof You Can Hand an Auditor</h3>
                            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-dim)]">
                                Every invoice links to the transaction that settled it, with the FX rate
                                and withholding frozen at the moment it was paid.
                            </p>

                            <div className="mt-7 rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] text-[var(--text-dim)]">Payment run</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok-soft)] px-2.5 py-1 text-[11px] text-[var(--ok)]">
                                        <Check size={11} /> Confirmed
                                    </span>
                                </div>
                                <div className="mt-3 font-mono text-[30px] font-medium tracking-[-0.03em]">$18,400.00</div>
                                <div className="mt-1 text-[13px] text-[var(--text-dim)]">12 contractors · 3 countries</div>

                                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                    {[["Gross", "$18,400"], ["Withheld", "$620"], ["Net", "$17,780"]].map(([k, v]) => (
                                        <div key={k} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2.5">
                                            <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{k}</div>
                                            <div className="mt-0.5 font-mono text-[13px]">{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ── 4. the payment run ─────────────────────────────────────────────────── */

export function PaymentRun() {
    return (
        <section className="relative overflow-hidden px-5 py-20 sm:px-8 md:py-28">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-glow)] opacity-25 blur-[140px]" />

            <div className="mx-auto max-w-4xl">
                <Head
                    center
                    tag="One signature"
                    title={<>Twelve Contractors,<br />One Transaction</>}
                    blurb="Approve USDC once. After that every run is a single signature, and the whole thing settles together — if one transfer fails, none of them happen."
                />

                <Reveal index={3}>
                    <div className="mt-11 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="card overflow-hidden">
                            <div className="border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                12 contractors · 3 countries
                            </div>
                            <div className="divide-y divide-[var(--border)]">
                                {PAYEES.map((p) => (
                                    <div key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                        <span className="truncate text-[13px] text-[var(--text-dim)]">{p.name}</span>
                                        <span className="font-mono text-[13px]">${p.amount}</span>
                                    </div>
                                ))}
                                <div className="px-4 py-2.5 text-[12px] text-[var(--text-faint)]">and 9 more…</div>
                            </div>
                        </div>

                        <div aria-hidden className="grid place-items-center py-2 text-[var(--text-faint)] md:py-0">
                            <ArrowRight size={20} className="rotate-90 md:rotate-0" />
                        </div>

                        <div className="card overflow-hidden border-[var(--accent-line)] bg-[var(--accent-soft)]">
                            <div className="px-5 py-5">
                                <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Confirm payment run</div>
                                <div className="mt-2 font-mono text-3xl font-medium tracking-[-0.02em]">$18,400.00</div>
                                <div className="mt-1 text-[13px] text-[var(--text-dim)]">to 12 contractors</div>

                                <div className="mt-5 space-y-2 text-[13px]">
                                    <div className="flex items-center gap-2 text-[var(--text-dim)]">
                                        <Check size={14} className="text-[var(--ok)]" /> USDC approved
                                    </div>
                                    <div className="flex items-center gap-2 text-[var(--text-dim)]">
                                        <Wallet size={14} className="text-[var(--accent)]" /> Paid from your wallet
                                    </div>
                                </div>

                                <Button className="mt-5 w-full">Send payment</Button>
                                <p className="mt-3 text-center text-[11px] text-[var(--text-faint)]">
                                    One signature · settles together or not at all
                                </p>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 5. invoices ────────────────────────────────────────────────────────── */

const FIELDS = [
    ["Contractor", "Amara Eze"],
    ["Invoice number", "INV-2026-014"],
    ["Amount", "$2,400.00"],
    ["Date", "31 July 2026"],
    ["Country", "Nigeria"],
    ["Wallet", "0x7a0e…93e5"],
];

export function InvoiceAI() {
    return (
        <section className="px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    tag="Invoices"
                    title={<>Send Us the Mess.<br />Get Back a Record.</>}
                    blurb="A photo, a PDF, a forwarded email. AI reads the fields; every number that touches money is then calculated in code, never guessed."
                />

                <div className="mt-11 grid gap-4 lg:grid-cols-2">
                    <Reveal index={1}>
                        <div className="card h-full overflow-hidden">
                            <div className="border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                invoice-scan.jpg
                            </div>
                            <div className="space-y-2.5 p-6 opacity-60">
                                {["33%", "66%", "50%", "83%", "60%"].map((w, i) => (
                                    <div key={i} className="h-2.5 rounded bg-[var(--surface-2)]" style={{ width: w }} />
                                ))}
                                <div className="mt-6 h-7 w-2/5 rounded bg-[var(--surface-2)]" />
                                <div className="h-2 w-1/4 rounded bg-[var(--surface-2)]" />
                            </div>
                        </div>
                    </Reveal>

                    <Reveal index={2}>
                        <div className="card h-full overflow-hidden">
                            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                <Sparkles size={13} className="text-[var(--accent)]" /> Extracted
                            </div>
                            <div className="divide-y divide-[var(--border)]">
                                {FIELDS.map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                                        <span className="text-[13px] text-[var(--text-dim)]">{label}</span>
                                        <span className="font-mono text-[13px] text-white">{value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-[var(--border)] px-4 py-3 text-[12px] text-[var(--text-faint)]">
                                You confirm every field before anything is saved.
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ── 6. pricing ─────────────────────────────────────────────────────────── */

const PLANS = [
    {
        name: "Testnet",
        price: "$0",
        unit: "/month",
        blurb: "The whole product on Base Sepolia. What the demo runs on.",
        features: ["Unlimited contractors", "Batch payment runs", "AI invoice extraction", "Tax ledger + audit pack", "Testnet USDC"],
        cta: "Open the app",
        href: "/login",
    },
    {
        name: "Mainnet",
        price: "TBD",
        unit: "",
        blurb: "Real USDC on Base. Pricing not set — you pay chain gas either way.",
        features: ["Everything in Testnet", "Mainnet USDC settlement", "Multi-client workspaces", "In-app messaging", "Priority support"],
        cta: "Join the waitlist",
        href: "/login",
        featured: true,
    },
    {
        name: "Enterprise",
        price: "Custom",
        unit: "",
        blurb: "For finance teams that need approvals and their own controls.",
        features: ["Safe multisig payouts", "Role-based access", "Custom tax jurisdictions", "Data export + retention", "Dedicated onboarding"],
        cta: "Talk to us",
        href: "/login",
    },
];

export function Pricing() {
    return (
        <section id="pricing" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    center
                    tag="Pricing"
                    title={<>Infrastructure That<br />Grows With You</>}
                    blurb="GlobePay is in testnet beta. Everything below is free to use today — mainnet pricing is not set, and this page will say so until it is."
                />

                <div className="mt-11 grid items-start gap-4 lg:grid-cols-3">
                    {PLANS.map((p, i) => (
                        <Reveal key={p.name} index={i + 1}>
                            <div
                                className={`relative h-full overflow-hidden rounded-[var(--radius-lg)] p-6 md:p-7 ${p.featured
                                    ? "panel-accent text-white shadow-[0_40px_90px_-40px_var(--accent-glow)]"
                                    : "card card-lift"
                                    }`}
                            >
                                {p.featured && (
                                    <span className="absolute right-5 top-5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] backdrop-blur-sm">
                                        Next up
                                    </span>
                                )}

                                <div className={`text-[15px] font-medium ${p.featured ? "text-white" : ""}`}>{p.name}</div>
                                <p className={`mt-2 min-h-[42px] max-w-[15rem] text-[13px] leading-relaxed ${p.featured ? "text-white/75" : "text-[var(--text-dim)]"}`}>
                                    {p.blurb}
                                </p>

                                <div className="mt-6 flex items-baseline gap-1">
                                    <span className="text-[38px] font-medium tracking-[-0.04em]">{p.price}</span>
                                    {p.unit && <span className={`text-[13px] ${p.featured ? "text-white/70" : "text-[var(--text-faint)]"}`}>{p.unit}</span>}
                                </div>

                                <ul className="mt-7 space-y-2.5">
                                    {p.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-[13px]">
                                            <Check size={14} className={`mt-0.5 shrink-0 ${p.featured ? "text-white" : "text-[var(--accent)]"}`} />
                                            <span className={p.featured ? "text-white/90" : "text-[var(--text-dim)]"}>{f}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    asChild
                                    variant={p.featured ? "ghost" : "subtle"}
                                    className={`mt-8 w-full ${p.featured ? "!bg-white !text-[var(--accent-deep)] hover:!bg-white/90 !border-transparent" : ""}`}
                                >
                                    <Link href={p.href}>{p.cta}</Link>
                                </Button>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── 7. proof ───────────────────────────────────────────────────────────────
   Where the reference puts customer testimonials. GlobePay does not have
   customers yet, and inventing them on a live site being shown to investors is
   not a trade worth making. These are checkable claims with links instead —
   which is the thing testimonials are a proxy for anyway. */

const PROOF = [
    {
        icon: ShieldCheck,
        title: "The contract has no owner",
        body: "No admin, no pause, no upgrade path. Twenty-five lines that move tokens and nothing else — so there is no privileged key that could ever be turned against you.",
        link: { label: "Read the source", href: `${SCAN}#code` },
    },
    {
        icon: Lock,
        title: "Funds never touch GlobePay",
        body: "USDC goes wallet to wallet. The database stores metadata about payments — never balances, never keys. There is no account here for us to freeze.",
    },
    {
        icon: Layers,
        title: "All or nothing settlement",
        body: "A run is one transaction. If a single transfer would fail, the whole thing reverts — a payroll can never land half-paid and leave you reconciling by hand.",
    },
    {
        icon: Receipt,
        title: "Per-contractor proof on chain",
        body: "Each recipient gets their own USDC Transfer event, matchable by wallet address. You can prove a specific person was paid without trusting our records.",
        link: { label: "View on Basescan", href: SCAN },
    },
    {
        icon: FileText,
        title: "Rates frozen at pay time",
        body: "FX and withholding are computed in code and stored as an immutable snapshot. Changing the rules later never rewrites what already happened.",
    },
    {
        icon: Sparkles,
        title: "AI reads, code calculates",
        body: "The model extracts fields from messy invoices and answers questions. Every figure it quotes is computed in code — a model never does the arithmetic.",
    },
];

export function Proof() {
    return (
        <section id="proof" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    center
                    tag="Why trust it"
                    title={<>Verifiable, Not<br />Just Reassuring</>}
                    blurb="Every claim on this page can be checked on chain or in the source. Nothing here asks you to take our word for it."
                />

                <StaggerGroup className="mt-11 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {PROOF.map((p) => (
                        <StaggerItem key={p.title}>
                            <div className="card card-lift h-full p-6">
                                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                                    <p.icon size={17} />
                                </div>
                                <h3 className="mt-4 text-[15px] font-medium tracking-[-0.01em]">{p.title}</h3>
                                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">{p.body}</p>
                                {p.link && (
                                    <a
                                        href={p.link.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-4 inline-flex items-center gap-1 text-[12px] text-[var(--accent)] transition hover:gap-1.5"
                                    >
                                        {p.link.label} <ArrowUpRight size={12} />
                                    </a>
                                )}
                            </div>
                        </StaggerItem>
                    ))}
                </StaggerGroup>

                <Reveal index={2}>
                    <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row">
                        <span className="text-[13px] text-[var(--text-dim)]">Disperse contract, verified on Base Sepolia</span>
                        <a
                            href={SCAN}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 font-mono text-[12px] text-[var(--accent)] transition hover:underline"
                        >
                            {addr(DISPERSE)} <ArrowUpRight size={12} />
                        </a>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 8. faq ─────────────────────────────────────────────────────────────── */

const FAQ = [
    {
        q: "Where does the money actually sit?",
        a: "In your wallet, until the moment it lands in your contractors'. GlobePay is non-custodial — we orchestrate the transfer and store the records, but we never hold a balance and never hold a key. There is no GlobePay account with your money in it.",
    },
    {
        q: "What happens if one payment fails?",
        a: "Nothing happens. A payment run is a single transaction, so if any transfer in it would fail, the entire run reverts and no one is paid. That is deliberate — a half-completed payroll is far worse to unpick than one you simply retry.",
    },
    {
        q: "How is withholding tax decided?",
        a: "By where you and the contractor are. Same country and it is domestic, so your jurisdiction's withholding applies and you see gross, withheld and net. Different countries and it is cross-border: no withholding, the contractor self-reports, and the payment is recorded as your operating expense. Nigeria, Argentina and the Philippines are supported today.",
    },
    {
        q: "Does the AI decide any of the numbers?",
        a: "No, and that split is enforced in code. The model reads messy invoices and answers questions in plain English; every amount, rate, conversion and total is computed by the application. Models are unreliable at arithmetic, so nothing financial is left to one.",
    },
    {
        q: "Is this on mainnet?",
        a: "Not yet. GlobePay runs on Base Sepolia, a testnet, using test USDC — so you can exercise the entire flow, including real signatures and real on-chain proof, without moving real money.",
    },
];

export function Faq() {
    return (
        <section id="faq" className="scroll-mt-24 px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <Head tag="FAQ" title={<>Questions,<br />Answered Plainly</>} />
                <Reveal index={1}>
                    <Accordion items={FAQ} />
                </Reveal>
            </div>
        </section>
    );
}

/* ── 9. closer ──────────────────────────────────────────────────────────── */

export function Closer() {
    return (
        <section className="px-5 pb-24 pt-4 sm:px-8 md:pb-28">
            <Reveal>
                <div className="panel-accent mx-auto max-w-6xl px-7 py-14 md:px-14 md:py-20">
                    <div aria-hidden className="grid-bg opacity-40" />
                    <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                        <div>
                            <span className="tag !border-white/25 !bg-white/10 !text-white/80">Get started</span>
                            <h2 className="mt-5 text-[clamp(2rem,4.6vw,3.3rem)] font-medium leading-[1.06] tracking-[-0.035em] text-white">
                                The Payroll Rail<br />for Borderless Teams
                            </h2>
                            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
                                Connect a wallet, add your contractors, and run payroll in a single
                                signature. Nothing to install, no funds to deposit.
                            </p>
                            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                                <Button asChild variant="ghost" size="lg" className="!border-white/25 !bg-white/10 !text-white hover:!bg-white/20">
                                    <a href="#how">See how it works</a>
                                </Button>
                                <Button asChild size="lg" className="!bg-white !text-[var(--accent-deep)] hover:!bg-white/90">
                                    <Link href="/login">Open the app <ArrowUpRight size={16} /></Link>
                                </Button>
                            </div>
                        </div>

                        <div className="hidden lg:block">
                            <IsoArt className="h-[340px] w-full" />
                        </div>
                    </div>
                </div>
            </Reveal>
        </section>
    );
}
