"use client";
// The walkthrough — five steps from an empty wallet to a paid team, in the
// order you actually do them.
//
// A page of its own rather than a section, because it answers a different
// question from the rest of the marketing site. Everything on the home page
// argues that you should want this; this explains how it is done. It also means
// "How it works" in the nav is a destination someone can link to, return to and
// send to a colleague, instead of a scroll position that changes whenever a
// section is added above it.
//
// The cinema is one scroll-linked rail that fills as you read, so the sequence
// advances with you rather than playing on a timer you can't keep up with.
// Everything else arrives once and stops, which is the house rule for this site.
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import {
    ArrowRight, Check, CircleDollarSign, PenLine, PlayCircle, ShieldCheck,
    Users, Wallet, X,
} from "lucide-react";
import { Reveal } from "@/components/ui/motion";
import { Button } from "@/components/ui/kit";

/**
 * Drop a file at public/how-it-works.mp4 and this becomes a real player.
 *
 * Self-hosted deliberately: the site's Content-Security-Policy allows media
 * from our own origin, so a file in /public plays with no change. A YouTube or
 * Vimeo embed would be blocked until frame-src is widened to that host — worth
 * knowing before recording somewhere it has to be re-uploaded from.
 */
const VIDEO_SRC = "/how-it-works.mp4";
const VIDEO_POSTER = "";     // optional still frame, e.g. "/how-it-works.jpg"
const VIDEO_READY = false;   // flip to true once the file is in place

type Step = {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    kicker: string;
    title: string;
    body: string;
    /** The reassurance that belongs with this step, not a feature bullet. */
    note?: string;
};

// Written to be read aloud in ten seconds each. Every claim here is one the
// product actually makes elsewhere — non-custody, the pre-flight check, one
// signature — so the walkthrough and the FAQ cannot drift apart.
const STEPS: Step[] = [
    {
        icon: Wallet,
        kicker: "Step one",
        title: "Connect your own wallet",
        body: "Sign in and connect the wallet your company already uses. It stays yours — GlobePay never holds it, and never sees your keys.",
        note: "Works with MetaMask, or a Safe multisig if payments need two people to agree.",
    },
    {
        icon: CircleDollarSign,
        kicker: "Step two",
        title: "Put USDC in it, your way",
        body: "Buy USDC wherever you already buy it — your exchange, your bank rails, your treasury desk — and send it to your wallet. GlobePay is never in that path.",
        note: "USDC is a dollar stablecoin: one USDC is one dollar. Nothing is converted behind your back.",
    },
    {
        icon: Users,
        kicker: "Step three",
        title: "Tell us who to pay",
        body: "Add your freelancers once — name, country, wallet, amount. Or drop their invoice in and let the AI read it, then check what it found.",
        note: "A wallet address is checked the moment it is typed, so a mistyped one is refused rather than paid.",
    },
    {
        icon: ShieldCheck,
        kicker: "Step four",
        title: "We check the run before you sign",
        body: "Every wallet in the payroll is tested first: enough balance, the right permissions, nobody who can't receive it. If someone is a problem, you see exactly who — before a single fee is spent.",
        note: "And you can pay everyone else in one click while that one gets sorted.",
    },
    {
        icon: PenLine,
        kicker: "Step five",
        title: "One signature pays everyone",
        body: "Approve once. One transaction pays the whole team at the same moment, straight from your wallet to theirs. It either all goes through or none of it does — a payroll can never half-pay.",
        note: "The receipt, the exchange rate and the proof anyone can verify are written for you as it happens.",
    },
];

export function HowItWorks() {
    const rail = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();

    // The rail fills against the section's own scroll progress rather than the
    // page's, so it reads as "you are three steps in" instead of "you are a
    // third of the way down the site".
    const { scrollYProgress } = useScroll({
        target: rail,
        offset: ["start 65%", "end 60%"],
    });
    const fill = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });
    const height = useTransform(fill, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`);

    return (
        <div className="mx-auto max-w-5xl">
            <div>
                <div className="max-w-2xl">
                    <Reveal><span className="tag">How it works</span></Reveal>
                    <Reveal index={1}>
                        {/* h1: this is the page's subject now, not a section of
                            somebody else's page. */}
                        <h1 className="text-gradient mt-5 text-[clamp(2rem,4.6vw,3.4rem)] font-medium leading-[1.06] tracking-[-0.035em]">
                            From empty wallet<br />to everyone paid
                        </h1>
                    </Reveal>
                    <Reveal index={2}>
                        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--text-dim)]">
                            Five steps, in the order you actually do them. Your money never leaves your
                            hands until the moment it reaches your team.
                        </p>
                    </Reveal>
                    <Reveal index={3}>
                        <div className="mt-7 flex flex-wrap items-center gap-3">
                            <WatchButton />
                            {/* Absolute, not "#faq": the FAQ lives on the home
                                page, and a bare hash here scrolls nowhere. */}
                            <Button asChild variant="outline" size="md">
                                <Link href="/#faq">Read the FAQ <ArrowRight size={15} /></Link>
                            </Button>
                        </div>
                    </Reveal>
                </div>

                {/* The steps. The rail sits behind them on a track of its own so
                    the fill can be absolutely positioned without disturbing the
                    flow of the list beside it. */}
                <div ref={rail} className="relative mt-14 sm:mt-16">
                    <div
                        aria-hidden
                        className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--border)] sm:left-[27px]"
                    >
                        <motion.div
                            className="w-px origin-top bg-[var(--accent)]"
                            style={{
                                height: reduced ? "100%" : height,
                                boxShadow: "0 0 12px var(--accent-glow)",
                            }}
                        />
                    </div>

                    <ol className="space-y-9 sm:space-y-12">
                        {STEPS.map((s, i) => (
                            <Step key={s.title} step={s} n={i + 1} />
                        ))}
                    </ol>
                </div>

                <Reveal>
                    <div className="mt-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-7">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                            <Check size={16} className="shrink-0 text-[var(--accent)]" />
                            <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-[var(--text-dim)]">
                                At no point does GlobePay hold your money. There is no account here with a
                                balance in it — the USDC goes from your wallet to your freelancers&rsquo;, and
                                everything else is the paperwork written around it.
                            </p>
                        </div>
                    </div>
                </Reveal>

                {/* A page needs somewhere to go next; a section had the rest of
                    the page underneath it and did not. */}
                <Reveal index={1}>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Button asChild size="md">
                            <Link href="/login">Open the app <ArrowRight size={15} /></Link>
                        </Button>
                        <Button asChild variant="outline" size="md">
                            <Link href="/contact">Talk to us</Link>
                        </Button>
                    </div>
                </Reveal>
            </div>
        </div>
    );
}

function Step({ step, n }: { step: Step; n: number }) {
    const Icon = step.icon;
    return (
        <li>
            <Reveal>
                <div className="flex gap-4 sm:gap-6">
                    {/* The marker sits on the rail, opaque so the line passes
                        behind it rather than through the number. */}
                    <div className="relative z-[1] shrink-0">
                        <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] sm:h-14 sm:w-14">
                            <Icon size={17} strokeWidth={1.7} className="text-[var(--accent)]" />
                        </span>
                    </div>

                    <div className="min-w-0 flex-1 pt-1 sm:pt-2.5">
                        <div className="flex items-baseline gap-2.5">
                            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
                                {step.kicker}
                            </span>
                            <span aria-hidden className="font-mono text-[11px] text-[var(--text-faint)] opacity-50">
                                0{n}
                            </span>
                        </div>
                        <h3 className="mt-2 text-[19px] font-medium leading-snug tracking-[-0.01em] sm:text-[22px]">
                            {step.title}
                        </h3>
                        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--text-dim)] sm:text-[15px]">
                            {step.body}
                        </p>
                        {step.note && (
                            <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-[var(--text-faint)]">
                                {step.note}
                            </p>
                        )}
                    </div>
                </div>
            </Reveal>
        </li>
    );
}

/* ── the walkthrough video ───────────────────────────────────────────────── */

function WatchButton() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button size="md">
                    <PlayCircle size={16} />
                    Watch the walkthrough
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm data-[state=open]:animate-[fadeIn_.2s_ease]" />
                <Dialog.Content
                    className="fixed left-1/2 top-1/2 z-[96] w-[min(calc(100vw-2rem),980px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
                    // The video is the content; a screen reader still needs the
                    // dialog to announce itself as something.
                    aria-label="How GlobePay works — video walkthrough"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                        <Dialog.Title className="text-[14px] font-medium">How GlobePay works</Dialog.Title>
                        <Dialog.Close asChild>
                            <button
                                aria-label="Close"
                                className="rounded-lg p-1 text-[var(--text-faint)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                            >
                                <X size={16} />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* 16:9 whether or not there is a file yet, so the modal never
                        changes size the day the video is added. */}
                    <div className="relative aspect-video w-full bg-black">
                        {VIDEO_READY ? (
                            <video
                                className="h-full w-full"
                                controls
                                autoPlay
                                playsInline
                                preload="metadata"
                                poster={VIDEO_POSTER || undefined}
                                src={VIDEO_SRC}
                            />
                        ) : (
                            <div className="absolute inset-0 grid place-items-center px-6 text-center">
                                <div>
                                    <PlayCircle size={30} className="mx-auto text-[var(--text-faint)]" />
                                    <p className="mt-3 text-[14px] text-[var(--text-dim)]">
                                        The walkthrough is being recorded.
                                    </p>
                                    <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-[var(--text-faint)]">
                                        In the meantime the five steps above are the whole of it — and the FAQ
                                        answers the questions people ask next.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
