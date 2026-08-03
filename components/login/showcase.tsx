"use client";
// The panel beside the sign-in form.
//
// Its job is to say what GlobePay is to someone staring at a password box, and
// to do it without leaking anything. Every figure and name here is invented or
// public: the contract address is on Basescan, and no client, freelancer,
// wallet or amount from the database appears on this screen. A sign-in page is
// visible to anyone who can reach the URL, including people who fail the login.
//
// The slider auto-advances, which makes it moving content that starts on its
// own and runs past five seconds — WCAG 2.2.2 requires a way to stop it. There
// is a pause button, it pauses on hover, and it pauses on keyboard focus, so
// nobody has to chase a card that is about to slide away.
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Layers, Pause, Play, Receipt, ShieldCheck } from "lucide-react";
import { IsoArt } from "@/components/landing/iso-art";

const SLIDE_MS = 7000;

const SLIDES = [
    {
        icon: Layers,
        title: "One signature pays everyone",
        body: "A payroll run is a single transaction, however many freelancers are in it. Approve USDC once, then every run afterwards is one signature.",
        stat: "1",
        statLabel: "transaction per payroll run",
    },
    {
        icon: ShieldCheck,
        title: "Your money never touches us",
        body: "USDC moves from your wallet straight to theirs. GlobePay holds no balances and no keys — there is no account here for anyone to freeze.",
        stat: "0",
        statLabel: "funds held by GlobePay",
    },
    {
        icon: Receipt,
        title: "The audit trail writes itself",
        body: "Every invoice links to the transaction that settled it, with the FX rate frozen at the moment of payment. Export a year in one click.",
        stat: "3",
        statLabel: "countries paid so far",
    },
];

export function Showcase() {
    const [i, setI] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduced = useReducedMotion();

    const go = useCallback((n: number) => setI((n + SLIDES.length) % SLIDES.length), []);

    useEffect(() => {
        // Reduced motion stops the carousel advancing on its own entirely —
        // the dots still work, so nothing becomes unreachable.
        if (paused || reduced) return;
        const t = setTimeout(() => setI((v) => (v + 1) % SLIDES.length), SLIDE_MS);
        return () => clearTimeout(t);
    }, [i, paused, reduced]);

    const slide = SLIDES[i];

    return (
        <aside
            aria-label="About GlobePay"
            // Square edges: the panel is one half of the window, not a card
            // floating in it, so a rounded corner here would just show a sliver
            // of page background and read as a mistake.
            className="panel relative hidden h-full flex-col justify-between overflow-hidden !rounded-none p-10 lg:flex xl:p-12"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
        >
            <div aria-hidden className="grid-bg" />

            <div className="relative">
                <span className="tag !border-white/20 !bg-white/10 !text-white/80">
                    <span className="dot dot-ok" /> Live on Base Sepolia
                </span>
            </div>

            {/* The art sits behind the copy, so the panel has depth without
                another image to load — pushed into the upper half and dimmed,
                with a scrim under it, because a headline competing with a
                bright plate for the same pixels is a headline nobody reads. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[6%] opacity-75">
                <IsoArt className="h-[380px] w-full" />
            </div>
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                style={{ background: "linear-gradient(to top, #080A11 12%, rgba(8,10,17,0.86) 46%, transparent)" }}
            />

            <div className="relative mt-auto">
                <div className="min-h-[232px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={i}
                            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -14 }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            // Announced as a group when it changes, rather than
                            // read out word by word as it animates in.
                            aria-live="polite"
                        >
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 text-white backdrop-blur-md">
                                <slide.icon size={20} />
                            </div>

                            <div className="mt-6 flex items-baseline gap-3">
                                <span className="text-[46px] font-medium leading-none tracking-[-0.04em] text-white">
                                    {slide.stat}
                                </span>
                                <span className="text-[13px] text-white/60">{slide.statLabel}</span>
                            </div>

                            <h2 className="mt-6 max-w-sm text-[26px] font-medium leading-[1.15] tracking-[-0.03em] text-white">
                                {slide.title}
                            </h2>
                            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/65">
                                {slide.body}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="mt-8 flex items-center gap-3">
                    {/* Dots are real buttons with real labels — a carousel you can
                        only wait for is a carousel that fails a keyboard user. */}
                    <div className="flex items-center gap-2" role="tablist" aria-label="Slides">
                        {SLIDES.map((s, n) => (
                            <button
                                key={s.title}
                                role="tab"
                                aria-selected={n === i}
                                aria-label={s.title}
                                onClick={() => go(n)}
                                className="group py-2"
                            >
                                <span
                                    className={`block h-1 rounded-full transition-all duration-500 ${n === i ? "w-8 bg-white" : "w-3 bg-white/30 group-hover:bg-white/60"
                                        }`}
                                />
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setPaused((p) => !p)}
                        aria-label={paused ? "Play slideshow" : "Pause slideshow"}
                        className="ml-auto grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/8 text-white/70 transition hover:bg-white/15 hover:text-white"
                    >
                        {paused ? <Play size={13} /> : <Pause size={13} />}
                    </button>
                </div>
            </div>
        </aside>
    );
}
