"use client";
// Contact. Same split as the sign-in page — form on the left, context on the
// right — because a stranger writing to a payments company wants to know who
// is going to read it before they type.
import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/landing/nav";
import { Button } from "@/components/ui/kit";
import { Reveal } from "@/components/ui/motion";

const field =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14px] " +
    "transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none " +
    "focus:ring-2 focus:ring-[var(--accent-soft)]";

const REASONS = [
    {
        icon: MessageSquare,
        title: "Using GlobePay for your team",
        body: "How onboarding works, what a payment run looks like end to end, and what we would need from you to get started.",
    },
    {
        icon: ShieldCheck,
        title: "Security and the technical detail",
        body: "The contract address, how settlement works, how addresses are verified — anything you or your auditor want to check before trusting it with payroll.",
    },
    {
        icon: Mail,
        title: "Anything else",
        body: "Partnerships, press, or a question that doesn't fit a box. It reaches a person, not a queue.",
    },
];

export default function ContactPage() {
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true); setErr(null);
        const fd = new FormData(e.currentTarget);
        try {
            const r = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fd.get("name"), email: fd.get("email"),
                    company: fd.get("company"), message: fd.get("message"),
                    website: fd.get("website"),   // honeypot
                }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(j?.error || "Couldn't send that");
            setSent(true);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Couldn't send that");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <SiteNav />
            <main className="relative z-[1] px-5 pb-24 pt-32 sm:px-8 md:pt-40">
                <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
                    <div>
                        <Reveal>
                            <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-dim)] transition hover:text-white">
                                <ArrowLeft size={14} /> Back
                            </Link>
                            <h1 className="text-gradient mt-5 text-[clamp(2.2rem,4.6vw,3.2rem)] font-medium leading-[1.06] tracking-[-0.035em]">
                                Talk to us
                            </h1>
                            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)]">
                                Whether you&rsquo;re evaluating GlobePay for your payroll or reviewing how it
                                works underneath, tell us what you need and you&rsquo;ll get a direct,
                                specific answer — usually within one business day.
                            </p>
                        </Reveal>

                        <Reveal index={1}>
                            {sent ? (
                                <div className="card mt-9 flex items-start gap-3 p-6">
                                    <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                                    <div>
                                        <div className="text-[15px] font-medium">Message sent</div>
                                        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--text-dim)]">
                                            Thanks — it landed. We reply to the address you gave us, usually within
                                            a day.
                                        </p>
                                        <Button variant="subtle" size="sm" className="mt-5" onClick={() => setSent(false)}>
                                            Send another
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={submit} className="mt-9" noValidate>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="name" className="mb-1.5 block text-[13px] font-medium text-[var(--text-dim)]">
                                                Your name
                                            </label>
                                            <input id="name" name="name" required autoComplete="name"
                                                placeholder="Alex Mercer" className={field} />
                                        </div>
                                        <div>
                                            <label htmlFor="company" className="mb-1.5 block text-[13px] font-medium text-[var(--text-dim)]">
                                                Company <span className="text-[var(--text-faint)]">(optional)</span>
                                            </label>
                                            <input id="company" name="company" autoComplete="organization"
                                                placeholder="Northwind Ltd" className={field} />
                                        </div>
                                    </div>

                                    <label htmlFor="email" className="mb-1.5 mt-4 block text-[13px] font-medium text-[var(--text-dim)]">
                                        Your email
                                    </label>
                                    <input id="email" name="email" type="email" required autoComplete="email"
                                        placeholder="you@company.com" className={field} />

                                    <label htmlFor="message" className="mb-1.5 mt-4 block text-[13px] font-medium text-[var(--text-dim)]">
                                        Message
                                    </label>
                                    <textarea id="message" name="message" required rows={6}
                                        placeholder="What would you like to know?"
                                        className={`${field} resize-y min-h-[140px]`} />

                                    {/* Honeypot. Hidden from people, irresistible to bots. */}
                                    <input
                                        type="text" name="website" tabIndex={-1} autoComplete="off"
                                        aria-hidden className="absolute left-[-9999px] h-0 w-0 opacity-0"
                                    />

                                    <div aria-live="polite">
                                        {err && (
                                            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-[var(--danger)]">
                                                <AlertCircle size={15} className="mt-px shrink-0" />
                                                <span>{err}</span>
                                            </div>
                                        )}
                                    </div>

                                    <Button type="submit" loading={busy} size="lg" className="mt-6 w-full sm:w-auto">
                                        {busy ? "Sending…" : "Send message"}
                                    </Button>

                                    <p className="mt-4 text-[12px] leading-relaxed text-[var(--text-faint)]">
                                        We use your address to reply and nothing else — no list, no
                                        newsletter, no passing it on.
                                    </p>
                                </form>
                            )}
                        </Reveal>
                    </div>

                    <Reveal index={2}>
                        <div className="lg:sticky lg:top-28">
                            <div className="panel p-6 md:p-7">
                                <div aria-hidden className="grid-bg opacity-50" />
                                <div className="relative space-y-6">
                                    {REASONS.map((r) => (
                                        <div key={r.title} className="flex gap-3.5">
                                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white backdrop-blur-md">
                                                <r.icon size={16} />
                                            </div>
                                            <div>
                                                <div className="text-[14px] font-medium">{r.title}</div>
                                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-dim)]">{r.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                                <span className="dot dot-pending" />
                                <span className="text-[12px] text-[var(--text-dim)]">
                                    Running on Ethereum Layer 2 &mdash; Base
                                </span>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
