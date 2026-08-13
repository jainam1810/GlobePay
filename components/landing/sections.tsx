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
import Flag from "@/components/flag";

// The deployed contract address is deliberately not shown anywhere in the UI.
// It is public on chain for anyone who goes looking, but putting it on the
// marketing page invites people to audit plumbing instead of reading what the
// product does — and anyone who genuinely wants it can ask on /contact.

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
        <section className="relative overflow-hidden px-5 pb-12 pt-24 sm:px-8 sm:pt-28 md:pb-20 md:pt-36">
            <div aria-hidden className="absolute inset-0 -z-10">
                <div className="grid-bg" />
                <div className="hero-glow-a left-[70%] top-[-24%] h-[560px] w-[560px] md:h-[780px] md:w-[780px]" />
                <div className="hero-glow-b left-[4%] top-[34%] h-[380px] w-[380px] md:h-[520px] md:w-[520px]" />
            </div>

            {/* minmax(0,…) on the mobile column too, not just at lg.
                A grid track sizes to its content's max-content by default, and
                the logo marquee is a max-content track — so on a 390px phone the
                single column computed to 1162px and the whole hero was laid out
                off-screen and clipped by the section's overflow-hidden. The text
                looked truncated mid-sentence and the buttons ran off the edge. */}
            <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div>
                    <Reveal>
                        <Link
                            href="/contact"
                            className="group inline-flex items-center gap-3 rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.04)] py-1 pl-4 pr-1 text-[13px] text-[var(--text-dim)] transition hover:border-[var(--accent-line)]"
                        >
                            <span className="flex items-center gap-2">
                                <span className="dot dot-ok" /> Live on Base
                            </span>
                            <span aria-hidden className="hidden h-3 w-px bg-[var(--border-strong)] sm:block" />
                            <span className="hidden sm:inline">Paid in USDC</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-white">
                                Talk to us <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
                            </span>
                        </Link>
                    </Reveal>

                    <Reveal index={1}>
                        <h1 className="text-gradient mt-7 text-[clamp(2.6rem,6.4vw,4.6rem)] font-medium leading-[1.03] tracking-[-0.04em]">
                            Payroll Built for<br />the Borderless<br />World
                        </h1>
                    </Reveal>

                    <Reveal index={2}>
                        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)] md:text-base">
                            Pay every international freelancer in USDC — one transaction, one
                            signature, straight from your own wallet. GlobePay never holds your
                            funds or your keys.
                        </p>
                    </Reveal>

                    <Reveal index={3}>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Button asChild variant="ghost" size="lg">
                                <Link href="/how-it-works">See how it works</Link>
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
    { name: "Amara Eze", role: "Backend engineer", country: "Nigeria", amount: "2,400.00" },
    { name: "Lucía Moreno", role: "Product designer", country: "Argentina", amount: "1,850.00" },
    { name: "Miguel Santos", role: "QA engineer", country: "Philippines", amount: "1,200.00" },
];

export function GlobalPayroll() {
    return (
        // #how belongs to the step-by-step walkthrough now. This section makes
        // the case for global payroll; it never answered "how does it work",
        // which is why the button that pointed here felt like it did nothing.
        <section id="global" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:py-28">
            <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
                <div>
                    <Head
                        tag="Global payroll"
                        title={<>Pay Every Country<br />on the Same Day</>}
                        blurb="No correspondent banks, no three-day wires, no wondering which intermediary took a cut. Freelancers are paid in dollars they can hold, wherever they are."
                    />

                    <StaggerGroup className="mt-10 grid grid-cols-3 gap-6">
                        {[
                            { v: <CountUp to={1} />, l: "Transaction, however many freelancers" },
                            { v: <CountUp to={0} />, l: "Custody — funds never touch us" },
                            { v: <CountUp to={3} />, l: "Countries paid so far" },
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
                                        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                                            <Flag country={p.country} label={false} size={22} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-[14px] font-medium">
                                                {p.name} <span className="font-normal text-[var(--text-faint)]">paid</span>
                                            </div>
                                            <div className="truncate text-[12px] text-[var(--text-faint)]">{p.role} · {p.country}</div>
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
        <section id="platform" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:py-28">
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
                                        { icon: Receipt, label: "Freelancers" },
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
                                frozen at the moment it was paid.
                            </p>

                            <div className="mt-7 rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[12px] text-[var(--text-dim)]">Payment run</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok-soft)] px-2.5 py-1 text-[11px] text-[var(--ok)]">
                                        <Check size={11} /> Confirmed
                                    </span>
                                </div>
                                <div className="mt-3 font-mono text-[30px] font-medium tracking-[-0.03em]">$18,400.00</div>
                                <div className="mt-1 text-[13px] text-[var(--text-dim)]">12 freelancers · 3 countries</div>

                                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                    {[["Freelancers", "12"], ["Countries", "3"], ["Signatures", "1"]].map(([k, v]) => (
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
        <section className="relative overflow-hidden px-5 py-14 sm:px-8 sm:py-20 md:py-28">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-glow)] opacity-25 blur-[140px]" />

            <div className="mx-auto max-w-4xl">
                <Head
                    center
                    tag="One signature"
                    title={<>Twelve Freelancers,<br />One Transaction</>}
                    blurb="Approve USDC once. Every run after that is a single signature, and the whole batch settles together. Wallet addresses are verified before a run is prepared, so the usual reason one payment goes wrong never reaches it."
                />

                <Reveal index={3}>
                    <div className="mt-11 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="card overflow-hidden">
                            <div className="border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                12 freelancers · 3 countries
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
                                <div className="mt-1 text-[13px] text-[var(--text-dim)]">to 12 freelancers</div>

                                <div className="mt-5 space-y-2 text-[13px]">
                                    <div className="flex items-center gap-2 text-[var(--text-dim)]">
                                        <Check size={14} className="text-[var(--ok)]" /> USDC approved
                                    </div>
                                    <div className="flex items-center gap-2 text-[var(--text-dim)]">
                                        <Wallet size={14} className="text-[var(--accent)]" /> Paid from your wallet
                                    </div>
                                </div>

                                {/* No button here. This card explains what a run is,
                                    and a control that looks live but isn't reads as
                                    broken software — the last impression a payments
                                    product wants. The section states the fact
                                    instead; the page already has real ways in. */}
                                <div className="mt-5 flex items-start gap-2 border-t border-[var(--accent-line)] pt-4 text-[12px] leading-relaxed text-[var(--text-dim)]">
                                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                                    <span>
                                        Sent with one signature, after every address has been
                                        checked against the chain.
                                    </span>
                                </div>
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
    ["Freelancer", "Amara Eze"],
    ["Invoice number", "INV-2026-014"],
    ["Amount", "$2,400.00"],
    ["Date", "31 July 2026"],
    ["Country", "Nigeria"],
    ["Wallet", "0x7a0e…93e5"],
];

export function InvoiceAI() {
    return (
        <section className="px-5 py-14 sm:px-8 sm:py-20 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    tag="Invoices"
                    title={<>Send Us the Mess.<br />Get Back a Record.</>}
                    blurb="A photo, a PDF, a forwarded email. AI reads the fields; every number that touches money is then calculated in code, never guessed."
                />

                <div className="mt-11 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
                    {/* Left: what actually arrives. A real-looking document rather
                        than grey bars — the point of the section is that the input
                        is messy, and a skeleton communicates "loading", not "mess". */}
                    <Reveal index={1}>
                        <div className="card h-full overflow-hidden">
                            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                <span>invoice-scan.jpg</span>
                                <span className="normal-case tracking-normal">what they sent</span>
                            </div>
                            <div className="p-5">
                                <div
                                    className="rounded-lg bg-[#EFEAE0] p-5 text-[#2A2722] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
                                    style={{ transform: "rotate(-0.7deg)" }}
                                >
                                    {/* Every field the panel on the right claims to have
                                        extracted has to be visibly present here — name,
                                        invoice number, date, country, amount, wallet.
                                        Otherwise the demo is showing the model inventing
                                        data, which is the opposite of the point. */}
                                    <div className="flex items-start justify-between gap-4 border-b border-[#CFC7B8] pb-3">
                                        <div>
                                            <div className="text-[15px] font-semibold tracking-tight">Amara Eze</div>
                                            <div className="text-[10px] text-[#6E675C]">Backend engineering · Lagos, Nigeria</div>
                                        </div>
                                        <div className="text-right text-[10px] text-[#6E675C]">
                                            <div>INVOICE</div>
                                            <div className="font-mono">INV-2026-014</div>
                                            <div className="mt-0.5 font-mono">31 July 2026</div>
                                        </div>
                                    </div>

                                    <div className="mt-3 space-y-1.5 text-[11px]">
                                        {[
                                            ["API integration — July", "1,600.00"],
                                            ["Bug fixes + on-call", "500.00"],
                                            ["Deployment support", "300.00"],
                                        ].map(([d, a]) => (
                                            <div key={d} className="flex justify-between gap-3">
                                                <span className="truncate text-[#4A443B]">{d}</span>
                                                <span className="font-mono">{a}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 flex justify-between border-t border-[#CFC7B8] pt-2 text-[13px] font-semibold">
                                        <span>Total due</span>
                                        <span className="font-mono">USD 2,400.00</span>
                                    </div>

                                    {/* The bit that makes it a mess: a wallet scrawled
                                        at the bottom, wrapping, easy to mistype. */}
                                    <div className="mt-3 border-t border-dashed border-[#CFC7B8] pt-2">
                                        <div className="text-[9px] uppercase tracking-wider text-[#8A8275]">pay to (usdc)</div>
                                        <div className="font-mono text-[10px] leading-snug break-all text-[#4A443B]">
                                            0x7a0e76dc321B5d44BcEa20527f4B93d13bfc93e5
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    <div aria-hidden className="grid place-items-center py-1 text-[var(--text-faint)] lg:py-0">
                        <ArrowRight size={20} className="rotate-90 lg:rotate-0" />
                    </div>

                    <Reveal index={2}>
                        <div className="card flex h-full flex-col overflow-hidden">
                            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                <span className="flex items-center gap-2">
                                    <Sparkles size={13} className="text-[var(--accent)]" /> Extracted
                                </span>
                                <span className="normal-case tracking-normal">what we file</span>
                            </div>
                            <div className="divide-y divide-[var(--border)]">
                                {FIELDS.map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                                        <span className="text-[13px] text-[var(--text-dim)]">{label}</span>
                                        <span className="flex items-center gap-2 font-mono text-[13px] text-white">
                                            {value}
                                            {label === "Wallet" && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ok-soft)] px-2 py-0.5 font-sans text-[10px] text-[var(--ok)]">
                                                    <Check size={10} /> verified
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* The safety net, stated without naming the mechanism. */}
                            <div className="mt-auto border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5">
                                <div className="flex items-start gap-2.5">
                                    <ShieldCheck size={15} className="mt-px shrink-0 text-[var(--ok)]" />
                                    <p className="text-[12px] leading-relaxed text-[var(--text-dim)]">
                                        <span className="text-[var(--text)]">A mistyped wallet can&rsquo;t get through.</span>{" "}
                                        Every address carries its own integrity check, and we run it before an
                                        address is saved or paid — change one character and it fails on the spot.
                                        So the AI can read a wallet off a photo without a slip becoming a payment
                                        to nowhere.
                                    </p>
                                </div>
                                <p className="mt-2.5 pl-[26px] text-[11px] text-[var(--text-faint)]">
                                    You still confirm every field before anything is saved.
                                </p>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    );
}

/* ── 6. pricing ─────────────────────────────────────────────────────────── */

// Two plans, not three. The research says three converts best, and it is right
// for products where the tiers are genuinely different products — but here the
// only real difference is whose money moves. Inventing a middle tier to hit the
// pattern would mean inventing a feature to withhold, and withholding a feature
// from a payroll tool is a strange thing to do on purpose.
//
// "Free" rather than "£0/month": zero is a price, and a price implies a
// downgrade. What is actually on offer is the whole product with play money,
// which is a sensible thing to do before trusting anyone with payroll.
//
// Everything in Free is in Pro. The paid plan is not a bigger version — it is
// the same thing pointed at real money.
const PLANS = [
    {
        name: "Free",
        price: "Free",
        unit: "",
        blurb: "The entire product, running on test money. No card, no limits, no expiry.",
        features: [
            "Every feature below, in full",
            "Unlimited freelancers and payment runs",
            "AI invoice reading and review queue",
            "Audit pack, FX pinning, on-chain proof",
            "Test USDC on Base Sepolia",
        ],
        cta: "Start testing",
        // Contact rather than straight into the app: accounts are provisioned by
        // GlobePay, so sending someone to a login they have no credentials for
        // is a dead end dressed up as a call to action.
        href: "/contact",
    },
    {
        name: "Pro",
        price: "£26.99",
        unit: "/month",
        blurb: "The same product, settling in real USDC on Base. One price, however many you pay.",
        features: [
            "Everything in Free, on mainnet",
            "Real USDC, wallet to wallet",
            "Unlimited freelancers and countries",
            "Safe multisig payouts",
            "Priority support",
        ],
        cta: "Go to mainnet",
        href: "/contact",
        featured: true,
    },
];

export function Pricing() {
    return (
        <section id="pricing" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    center
                    tag="Pricing"
                    title={<>Try It All Free.<br />Pay When It&rsquo;s Real.</>}
                    blurb="One flat price when you move real money — not per freelancer, not per payment, not a slice of what you send. Test everything first with play money for as long as you like."
                />

                <div className="mx-auto mt-11 grid max-w-3xl items-start gap-4 sm:grid-cols-2">
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
                                        For real payroll
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
    },
    {
        icon: Lock,
        title: "Funds never touch GlobePay",
        body: "USDC goes wallet to wallet. The database stores metadata about payments — never balances, never keys. There is no account here for us to freeze.",
    },
    {
        icon: Layers,
        title: "Nobody waits on somebody else",
        body: "Before you sign, every wallet in the run is checked against the chain. If any of them can't receive, we name them and offer to pay everyone else — so one blocked wallet never holds up the other ninety-nine, and you never sign a run that was going to fail.",
    },
    {
        icon: Receipt,
        title: "Per-freelancer proof on chain",
        body: "Each recipient gets their own USDC transfer, matchable by wallet address. You can prove a specific person was paid without trusting our records.",
    },
    {
        icon: FileText,
        title: "Rates frozen at pay time",
        body: "FX is computed in code and stored as an immutable snapshot. Changing the rules later never rewrites what already happened.",
    },
    {
        icon: Sparkles,
        title: "AI reads, code calculates",
        body: "The model extracts fields from messy invoices and answers questions. Every figure it quotes is computed in code — a model never does the arithmetic.",
    },
];

export function Proof() {
    return (
        <section id="proof" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:py-28">
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
                            </div>
                        </StaggerItem>
                    ))}
                </StaggerGroup>

                <Reveal index={2}>
                    <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row">
                        <span className="text-[13px] text-[var(--text-dim)]">
                            Want the contract address, or a walk through how settlement works?
                        </span>
                        <Link
                            href="/contact"
                            className="flex items-center gap-1.5 text-[13px] text-[var(--accent)] transition hover:gap-2"
                        >
                            Get in touch <ArrowUpRight size={13} />
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 7b. what's coming ──────────────────────────────────────────────────────
   A roadmap earns trust only if it is honest about what is not built yet, so
   every step is staged and nothing claims to exist.

   Drawn as a timeline rather than another card grid, because the section above
   it IS a card grid, and two identical layouts back to back read as one long
   list nobody finishes. A timeline also carries meaning the cards couldn't:
   these are ordered, and they get less certain the further out you look —
   which is exactly what the connecting line does as it fades. */

const ROADMAP = [
    {
        stage: "Live",
        title: "Pay your team in USDC",
        body: "Batch payroll from your own wallet, one signature, with every wallet checked against the chain before you sign.",
        icon: Check,
    },
    {
        stage: "Next",
        title: "USDT alongside USDC",
        body: "Some freelancers already get paid in USDT and don't want to change. Our payment contract works with any standard token, so adding USDT is a matter of switching it on and testing it — not building something new.",
        icon: Layers,
    },
    {
        stage: "Next",
        title: "Buy USDC from GlobePay",
        body: "Today you bring your own stablecoin — funding your wallet on an exchange first. The on-ramp lets you top up in your own currency from inside GlobePay and pay out the same afternoon.",
        icon: Wallet,
    },
    {
        stage: "Later",
        title: "Payouts to a local bank",
        body: "Not every freelancer wants to hold a stablecoin. The off-ramp lets them take it to their own bank in their own currency, while you keep paying exactly the same way.",
        icon: Receipt,
    },
] as const;

const NODE = {
    Live: "border-[var(--ok)] bg-[var(--ok)] text-[#07130C]",
    Next: "border-[var(--accent)] bg-[var(--accent)] text-white",
    Later: "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-faint)]",
};

const STAGE_TEXT = {
    Live: "text-[var(--ok)]",
    Next: "text-[var(--accent)]",
    Later: "text-[var(--text-faint)]",
};

const HALO = {
    Live: "0 0 0 5px color-mix(in srgb, var(--ok) 16%, transparent)",
    Next: "0 0 0 5px color-mix(in srgb, var(--accent) 16%, transparent)",
    Later: undefined,
};

export function Roadmap() {
    return (
        <section id="roadmap" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:py-28">
            <div className="mx-auto max-w-6xl">
                <Head
                    center
                    tag="What's coming"
                    title={<>Built to Go<br />Further Than This</>}
                    blurb="GlobePay pays your team today. Here's the order we're building in — and we'll say plainly which parts aren't live yet."
                />

                <div className="relative mt-14">
                    {/* The spine. Solid where the product is real, fading out as
                        the steps get further away and less certain. Down the left
                        on a phone, across the top on desktop. */}
                    <div
                        aria-hidden
                        className="pointer-events-none absolute bottom-3 left-[15px] top-3 w-px md:bottom-auto md:left-0 md:right-0 md:top-[15px] md:h-px md:w-auto"
                        style={{
                            background:
                                "linear-gradient(to bottom, var(--ok) 0%, var(--accent) 26%, var(--accent) 58%, color-mix(in srgb, var(--accent) 30%, transparent) 82%, transparent 100%)",
                        }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-[15px] hidden h-px md:block"
                        style={{
                            background:
                                "linear-gradient(to right, var(--ok) 0%, var(--accent) 26%, var(--accent) 58%, color-mix(in srgb, var(--accent) 30%, transparent) 82%, transparent 100%)",
                        }}
                    />

                    <StaggerGroup className="relative grid gap-9 md:grid-cols-4 md:gap-6">
                        {ROADMAP.map((r) => (
                            <StaggerItem key={r.title}>
                                <div className="relative pl-11 md:pl-0">
                                    <span
                                        className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border-2 md:relative md:mb-6 ${NODE[r.stage]}`}
                                        style={{ boxShadow: HALO[r.stage] }}
                                    >
                                        <r.icon size={14} />
                                    </span>

                                    <div className={`text-[10px] font-medium uppercase tracking-[0.16em] ${STAGE_TEXT[r.stage]}`}>
                                        {r.stage === "Live" ? "Live today" : r.stage}
                                    </div>
                                    <h3 className="mt-2 text-[15px] font-medium tracking-[-0.01em]">{r.title}</h3>
                                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">{r.body}</p>
                                </div>
                            </StaggerItem>
                        ))}
                    </StaggerGroup>
                </div>

                <Reveal index={2}>
                    <div className="mt-14 flex flex-col items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row">
                        <span className="text-[13px] text-[var(--text-dim)]">
                            Want anything else or one of these sooner? Tell us — what customers ask for is what gets built first.
                        </span>
                        <Link
                            href="/contact"
                            className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[var(--accent)] transition hover:gap-2"
                        >
                            Tell us what you need <ArrowUpRight size={13} />
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 8. faq ─────────────────────────────────────────────────────────────── */

const FAQ = [
    {
        q: "Where does my money sit?",
        a: "In your wallet, right up until it lands in your freelancers'. GlobePay never holds your money and never holds your keys — there is no GlobePay account with your balance in it.",
    },
    {
        q: "If one of 100 freelancers can't be paid, do the other 99 wait?",
        a: "No. Before you sign anything, we check every wallet in the run. If any of them can't receive the payment, we stop and show you exactly who — and you can pay everyone else with one click. The ones we couldn't reach stay on our books, and we prepare a fresh run for them once their wallet is sorted.",
    },
    {
        q: "Why check first instead of just trying?",
        a: "Because a batch is one transaction: if one payment would fail, the whole thing fails. Checking first costs nothing and takes about a second. Trying first costs you a transaction fee and pays nobody.",
    },
    {
        q: "What if I don't have enough to cover the run?",
        a: "The same check catches that, and tells you exactly how much you're short before you sign. No failed transaction, no wasted fee.",
    },
    {
        q: "What stops a typo in a wallet address?",
        a: "Wallet addresses have a built-in integrity check, and we run it before an address is ever saved or paid. Change one character and it fails on the spot. So the AI can read a wallet off a photo without a slip becoming a payment to nowhere. The one thing no check can catch is a valid address belonging to the wrong person — which is why you confirm every run before signing.",
    },
    {
        q: "How do you know the wallet really belongs to that freelancer?",
        a: "We ask them to prove it, the same way your bank checks a name against a sort code and account number before it lets you send. We send the freelancer a link, and they sign a short sentence — \"I am Ada, this wallet is mine\" — using the wallet itself. Only the person holding that wallet can produce that signature, so it can't be faked by someone who merely knows the address. Once they've signed, the wallet shows as Verified on your roster. Signing costs nothing and moves no money.",
    },
    {
        q: "What if a wallet hasn't been verified yet?",
        a: "You can still pay it — it's a badge, not a barrier. But an unverified address only means it's correctly formed, not that anyone has proved it's theirs. Verified means the freelancer signed for that exact address, so if it's ever edited afterwards the badge drops and you'll see it before you pay.",
    },
    {
        q: "What does it cost?",
        a: "Free while you're on the test network — the whole product, no card, no expiry, paid with play money. When you're ready to move real money it's £26.99 a month, flat. Not per freelancer, not per payment, and not a percentage of what you send. The only other cost is the network fee for the transaction itself, which goes to the blockchain rather than to us — on Base that's typically a fraction of a penny.",
    },
    {
        q: "Is the free version cut down?",
        a: "No. It's the same product with test money instead of real money — every feature, no limits on freelancers or payment runs. That's deliberate: you shouldn't have to pay to find out whether a payroll tool works for you.",
    },
    {
        q: "Do you support USDC or USDT?",
        a: "USDC today. USDT is on the roadmap — the payment contract already accepts any standard token, so it's a matter of adding and testing it rather than rebuilding anything. We started with USDC because it's the most widely held and most liquid stablecoin on Base.",
    },
    {
        q: "Does the AI decide any of the numbers?",
        a: "No. The AI reads messy invoices and answers questions in plain English. Every amount, rate and total is worked out in code. AI is unreliable at arithmetic, so nothing about your money is left to it.",
    },
];

export function Faq() {
    return (
        <section id="faq" className="scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 md:py-28">
            <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <Head tag="FAQ" title={<>Questions,<br />Answered Plainly</>} />
                <Reveal index={1}>
                    <Accordion items={FAQ} />
                </Reveal>
            </div>
        </section>
    );
}
