"use client";
// Marketing sections. Each one shows the product doing the thing it claims,
// rather than describing it — the dashboard, the payment run and the ledger
// below are built from the same tokens as the real app.
import Link from "next/link";
import { ArrowRight, Check, FileText, Sparkles, Wallet } from "lucide-react";
import { Reveal } from "@/components/landing/motion";

/* ── shared bits ─────────────────────────────────────────────────────────── */

// Wallet addresses truncate in the middle: the first and last characters are
// what people actually check against.
const addr = (a: string) => `${a.slice(0, 5)}…${a.slice(-3)}`;

function Kicker({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent)]">
            {children}
        </div>
    );
}

function SectionHead({ kicker, title, blurb }: { kicker: string; title: React.ReactNode; blurb: string }) {
    return (
        <div className="max-w-2xl">
            <Reveal><Kicker>{kicker}</Kicker></Reveal>
            <Reveal index={1}>
                <h2 className="mt-3 text-[clamp(2rem,4.4vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.03em]">
                    {title}
                </h2>
            </Reveal>
            <Reveal index={2}>
                <p className="mt-4 text-[15px] md:text-base leading-relaxed text-[var(--text-dim)]">{blurb}</p>
            </Reveal>
        </div>
    );
}

/* ── 1. hero ─────────────────────────────────────────────────────────────── */

export function Hero() {
    return (
        <section className="relative overflow-hidden px-5 sm:px-8 pt-28 pb-24 md:pt-40 md:pb-36">
            <div aria-hidden className="absolute inset-0 -z-10">
                <div className="hero-glow-a left-1/2 top-[-18%] h-[520px] w-[520px] -translate-x-1/2 md:h-[720px] md:w-[720px]" />
                <div className="hero-glow-b left-[62%] top-[6%] h-[380px] w-[380px] md:h-[520px] md:w-[520px]" />
            </div>

            <div className="mx-auto max-w-5xl text-center">
                <Reveal>
                    <span className="pill mx-auto">
                        <span className="dot dot-ok" /> Live on Base
                    </span>
                </Reveal>

                <Reveal index={1}>
                    <h1 className="mt-7 text-[clamp(2.5rem,7vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.03em] text-white/90">
                        Pay your whole team.{" "}
                        <span className="text-[var(--accent)]">One signature.</span>
                    </h1>
                </Reveal>

                <Reveal index={2}>
                    <p className="mx-auto mt-6 max-w-xl text-[15px] md:text-base leading-relaxed text-[var(--text-dim)]">
                        Every contractor paid in USDC, in a single transaction, from your own wallet.
                        Non-custodial — funds never leave your wallet until they land in theirs.
                    </p>
                </Reveal>

                <Reveal index={3}>
                    <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link href="/login" className="btn-primary w-full sm:w-auto justify-center">
                            Start a payment run <ArrowRight size={16} />
                        </Link>
                        <a
                            href="#dashboard"
                            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-[14px] border border-[var(--border-strong)] px-5 py-[0.85rem] text-[0.95rem] font-medium text-[var(--text-dim)] transition hover:text-white hover:border-[var(--accent-line)]"
                        >
                            See how it works
                        </a>
                    </div>
                </Reveal>

                <Reveal index={4}>
                    <dl className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
                        {[
                            ["1", "transaction, however many contractors"],
                            ["0", "custody — we never hold your funds"],
                            ["3", "countries with tax handled automatically"],
                        ].map(([n, label]) => (
                            <div key={label} className="bg-[var(--surface)] px-5 py-6">
                                <dt className="font-mono text-3xl font-medium text-white">{n}</dt>
                                <dd className="mt-1.5 text-[13px] leading-snug text-[var(--text-dim)]">{label}</dd>
                            </div>
                        ))}
                    </dl>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 2. dashboard, light, in browser chrome ──────────────────────────────── */

const CONTRACTORS = [
    { name: "Chidi Okatar", role: "Backend engineer", country: "Nigeria", wallet: "0x7a0e76dc321B5d44BcEa20527f4B93d13bfc93e5", amount: "2,400.00", status: "Paid", dot: "dot-ok" },
    { name: "Akil Shaikh", role: "Product designer", country: "Argentina", wallet: "0x59B2f1870A3F2357C081d098276D40d397766EED", amount: "1,850.00", status: "Paid", dot: "dot-ok" },
    { name: "Jainam Varia", role: "QA engineer", country: "Philippines", wallet: "0xaFBbdB8Af6E7E562c9D85E592CD9B889f19a21Bb", amount: "1,200.00", status: "Awaiting signature", dot: "dot-pending" },
];

export function Dashboard() {
    return (
        <section id="dashboard" className="px-5 sm:px-8 py-24 md:py-32">
            <div className="mx-auto max-w-6xl">
                <SectionHead
                    kicker="Console"
                    title={<>Every contractor, <span className="text-[var(--accent)]">one screen.</span></>}
                    blurb="Who you pay, what they're owed, and where each payment got to. No spreadsheet, no chasing wallet addresses over email."
                />

                <Reveal index={3}>
                    <div className="mt-12 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
                        {/* browser chrome */}
                        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                            <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
                            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
                            <div className="ml-3 hidden flex-1 sm:block">
                                <div className="mx-auto w-fit rounded-md bg-[var(--bg)] px-3 py-1 font-mono text-[11px] text-[var(--text-faint)]">
                                    app.globepay.io/contractors
                                </div>
                            </div>
                        </div>

                        {/* light app */}
                        <div className="flex bg-[var(--l-bg)] text-[#101319]">
                            <aside className="hidden w-[200px] shrink-0 border-r border-[var(--l-border)] bg-[var(--l-card)] p-4 md:block">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[13px] font-semibold text-white">G</div>
                                    <span className="text-[15px] font-medium tracking-[-0.02em]">GlobePay</span>
                                </div>
                                <nav className="mt-6 space-y-0.5">
                                    {["Overview", "Contractors", "Payment runs", "Tax ledger", "Audit pack"].map((l, i) => (
                                        <div key={l} className={`rounded-lg px-3 py-2 text-[13px] ${i === 1 ? "bg-[var(--l-bg)] font-medium text-[#101319]" : "text-[#6B7280]"}`}>
                                            {l}
                                        </div>
                                    ))}
                                </nav>
                            </aside>

                            <div className="min-w-0 flex-1 p-5 md:p-7">
                                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                    {[
                                        ["Contractors", "12"],
                                        ["Due this run", "$18,400"],
                                        ["Paid this month", "$54,200"],
                                        ["Countries", "3"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-xl border border-[var(--l-border)] bg-[var(--l-card)] p-4">
                                            <div className="text-[11px] uppercase tracking-wider text-[#6B7280]">{label}</div>
                                            <div className="mt-1.5 font-mono text-xl font-medium tracking-[-0.02em]">{value}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 overflow-hidden rounded-xl border border-[var(--l-border)] bg-[var(--l-card)]">
                                    <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.8fr] gap-4 border-b border-[var(--l-border)] px-4 py-2.5 text-[11px] uppercase tracking-wider text-[#6B7280] sm:grid">
                                        <span>Contractor</span><span>Wallet</span><span className="text-right">Amount</span><span>Status</span>
                                    </div>
                                    {CONTRACTORS.map((c) => (
                                        <div key={c.name} className="grid grid-cols-1 gap-1 border-b border-[var(--l-border)] px-4 py-3 last:border-0 sm:grid-cols-[1.6fr_1fr_1fr_0.8fr] sm:items-center sm:gap-4">
                                            <div className="min-w-0">
                                                <div className="truncate text-[14px] font-medium">{c.name}</div>
                                                <div className="truncate text-[12px] text-[#6B7280]">{c.role} · {c.country}</div>
                                            </div>
                                            <div className="font-mono text-[12px] text-[#6B7280]">{addr(c.wallet)}</div>
                                            <div className="font-mono text-[14px] sm:text-right">${c.amount}</div>
                                            <div className="flex items-center gap-2 text-[12px] text-[#3F4753]">
                                                <span className={`dot ${c.dot}`} />{c.status}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 3. the payment run — the signature moment ───────────────────────────── */

export function PaymentRun() {
    return (
        <section className="relative overflow-hidden px-5 sm:px-8 py-24 md:py-32">
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-glow)] blur-[130px] opacity-30" />

            <div className="mx-auto max-w-4xl">
                <div className="text-center">
                    <Reveal><Kicker>Payment run</Kicker></Reveal>
                    <Reveal index={1}>
                        <h2 className="mx-auto mt-3 max-w-2xl text-[clamp(2rem,4.8vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
                            Twelve contractors collapse into{" "}
                            <span className="text-[var(--accent)]">one transaction.</span>
                        </h2>
                    </Reveal>
                    <Reveal index={2}>
                        <p className="mx-auto mt-4 max-w-lg text-[15px] md:text-base leading-relaxed text-[var(--text-dim)]">
                            Approve USDC once. After that every run is a single signature, and the whole
                            thing settles together — if one transfer fails, none of them happen.
                        </p>
                    </Reveal>
                </div>

                <Reveal index={3}>
                    <div className="mt-14 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        {/* the list */}
                        <div className="card overflow-hidden">
                            <div className="border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                12 contractors · 3 countries
                            </div>
                            <div className="divide-y divide-[var(--border)]">
                                {CONTRACTORS.map((c) => (
                                    <div key={c.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                        <span className="truncate text-[13px] text-[var(--text-dim)]">{c.name}</span>
                                        <span className="font-mono text-[13px]">${c.amount}</span>
                                    </div>
                                ))}
                                <div className="px-4 py-2.5 text-[12px] text-[var(--text-faint)]">and 9 more…</div>
                            </div>
                        </div>

                        <div aria-hidden className="grid place-items-center py-2 text-[var(--text-faint)] md:py-0">
                            <ArrowRight size={20} className="rotate-90 md:rotate-0" />
                        </div>

                        {/* the single confirmation */}
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

                                <button className="btn-primary mt-5 w-full justify-center">Send payment</button>
                                <p className="mt-3 text-center text-[11px] text-[var(--text-faint)]">
                                    One signature · settles together or not at all
                                </p>
                            </div>
                        </div>
                    </div>
                </Reveal>

                <Reveal index={4}>
                    <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3.5 text-center text-[13px] text-[var(--text-dim)]">
                        <span className="font-mono text-[var(--ok)]">~92%</span>
                        less gas than paying each contractor individually
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── 4. invoice AI ───────────────────────────────────────────────────────── */

const FIELDS = [
    ["Contractor", "Chidi Okatar"],
    ["Invoice number", "INV-2026-014"],
    ["Amount", "$2,400.00"],
    ["Date", "31 July 2026"],
    ["Country", "Nigeria"],
    ["Wallet", "0x7a0…3e5"],
];

export function InvoiceAI() {
    return (
        <section className="px-5 sm:px-8 py-24 md:py-32">
            <div className="mx-auto max-w-6xl">
                <SectionHead
                    kicker="Invoices"
                    title={<>Send us the mess. <span className="text-[var(--accent)]">Get back a record.</span></>}
                    blurb="A photo, a PDF, a forwarded email. AI reads the fields; every number that touches money is then calculated in code, never guessed."
                />

                <div className="mt-12 grid gap-4 lg:grid-cols-2">
                    <Reveal index={3}>
                        <div className="card h-full overflow-hidden">
                            <div className="border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                                invoice-scan.jpg
                            </div>
                            <div className="space-y-2.5 p-6 opacity-60">
                                <div className="h-2.5 w-1/3 rounded bg-[var(--surface-2)]" />
                                <div className="h-2 w-2/3 rounded bg-[var(--surface-2)]" />
                                <div className="mt-6 h-2 w-1/2 rounded bg-[var(--surface-2)]" />
                                <div className="h-2 w-5/6 rounded bg-[var(--surface-2)]" />
                                <div className="h-2 w-3/5 rounded bg-[var(--surface-2)]" />
                                <div className="mt-6 h-7 w-2/5 rounded bg-[var(--surface-2)]" />
                                <div className="h-2 w-1/4 rounded bg-[var(--surface-2)]" />
                            </div>
                        </div>
                    </Reveal>

                    <div className="card overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                            <Sparkles size={13} className="text-[var(--accent)]" /> Extracted
                        </div>
                        <div className="divide-y divide-[var(--border)]">
                            {FIELDS.map(([label, value], i) => (
                                <Reveal key={label} index={i} className="flex items-center justify-between gap-4 px-4 py-3">
                                    <span className="text-[13px] text-[var(--text-dim)]">{label}</span>
                                    <span className="font-mono text-[13px] text-white">{value}</span>
                                </Reveal>
                            ))}
                        </div>
                        <div className="border-t border-[var(--border)] px-4 py-3 text-[12px] text-[var(--text-faint)]">
                            You confirm every field before anything is saved.
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ── 5. tax + audit ──────────────────────────────────────────────────────── */

const LEDGER = [
    { name: "Chidi Okatar", country: "Nigeria", treatment: "Domestic", note: "5% withheld", amount: "2,400.00", tx: "0x7af79091220b0cf6eaaf2874f546634897a56a68" },
    { name: "Akil Shaikh", country: "Argentina", treatment: "Cross-border", note: "Paid in full", amount: "1,850.00", tx: "0x1aafa633c83793941d09e1d54a82f36f4877d10c" },
    { name: "Jainam Varia", country: "Philippines", treatment: "Cross-border", note: "Paid in full", amount: "1,200.00", tx: "0x0297d57d818a9f42debbec4fe2a8f59f0e19e496" },
];

export function TaxAudit() {
    return (
        <section className="px-5 sm:px-8 py-24 md:py-32">
            <div className="mx-auto max-w-6xl">
                <SectionHead
                    kicker="Tax and audit"
                    title={<>Every payment, <span className="text-[var(--accent)]">already filed.</span></>}
                    blurb="Each line links an invoice to the transaction that settled it. Withholding applies when you and the contractor are in the same country; pay someone abroad and it records as an operating expense, with the contractor reporting locally."
                />

                <Reveal index={3}>
                    <div className="card mt-12 overflow-hidden">
                        <div className="hidden grid-cols-[1.4fr_1.2fr_0.9fr_1.4fr] gap-4 border-b border-[var(--border)] px-5 py-3 text-[11px] uppercase tracking-wider text-[var(--text-faint)] md:grid">
                            <span>Contractor</span><span>Treatment</span><span className="text-right">Amount</span><span>Proof on chain</span>
                        </div>
                        {LEDGER.map((r) => (
                            <div key={r.name} className="grid grid-cols-1 gap-2 border-b border-[var(--border)] px-5 py-4 last:border-0 md:grid-cols-[1.4fr_1.2fr_0.9fr_1.4fr] md:items-center md:gap-4">
                                <div>
                                    <div className="text-[14px] font-medium">{r.name}</div>
                                    <div className="text-[12px] text-[var(--text-faint)]">{r.country}</div>
                                </div>
                                <div className="text-[13px] text-[var(--text-dim)]">
                                    {r.treatment}
                                    <span className="text-[var(--text-faint)]"> · {r.note}</span>
                                </div>
                                <div className="font-mono text-[14px] md:text-right">${r.amount}</div>
                                <div className="flex items-center gap-2 truncate font-mono text-[12px] text-[var(--accent)]">
                                    <span className="dot dot-ok" />{addr(r.tx)}
                                </div>
                            </div>
                        ))}
                        <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-3.5 text-[12px] text-[var(--text-dim)]">
                            <FileText size={14} className="text-[var(--text-faint)]" />
                            Export the whole year as an audit pack — country by country, with rates frozen at pay time.
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

/* ── close ───────────────────────────────────────────────────────────────── */

export function Closer() {
    return (
        <section className="px-5 sm:px-8 pb-28 pt-8 md:pb-40">
            <div className="mx-auto max-w-3xl text-center">
                <Reveal>
                    <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.03em]">
                        Your money never touches us.
                    </h2>
                </Reveal>
                <Reveal index={1}>
                    <p className="mx-auto mt-4 max-w-lg text-[15px] md:text-base leading-relaxed text-[var(--text-dim)]">
                        GlobePay prepares the run and keeps the records. The USDC goes straight from your
                        wallet to your contractors&rsquo; wallets — we hold no funds and no keys.
                    </p>
                </Reveal>
                <Reveal index={2}>
                    <Link href="/login" className="btn-primary mt-9 inline-flex">
                        Start a payment run <ArrowRight size={16} />
                    </Link>
                </Reveal>
            </div>
        </section>
    );
}

export function SiteNav() {
    return (
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-[15px] font-semibold text-[var(--accent-ink)]">G</div>
                    <span className="text-[17px] font-medium tracking-[-0.02em]">GlobePay</span>
                </Link>
                <Link
                    href="/login"
                    className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-[14px] font-medium text-[var(--text-dim)] transition hover:border-[var(--accent-line)] hover:text-white"
                >
                    Sign in
                </Link>
            </div>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="border-t border-[var(--border)] px-5 sm:px-8 py-10">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-[13px] text-[var(--text-faint)] sm:flex-row">
                <div className="flex items-center gap-2">
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent)] text-[11px] font-semibold text-[var(--accent-ink)]">G</div>
                    GlobePay
                </div>
                <div className="flex items-center gap-2">
                    <span className="dot dot-pending" /> Running on Base Sepolia testnet
                </div>
            </div>
        </footer>
    );
}
