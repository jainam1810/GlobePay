"use client";
// Motion primitives.
//
// One file so timings cannot drift apart. Everything here obeys three rules:
//
//   1. Movement is a transition between two resting states, never decoration.
//      Nothing loops except the marquee, which is a deliberate exception.
//   2. Reveals run once. Re-animating a block every time it re-enters the
//      viewport makes a long page feel like it is fighting you.
//   3. Reduced motion is honoured by *not moving*, not by moving less. Every
//      component here checks it and falls back to a plain opacity change.
//
// Scroll itself stays native. An earlier version eased content toward the real
// scroll position, which trails the wheel by definition and reads as lag.
import { useEffect, useRef, useState } from "react";
import {
    motion, useInView, useReducedMotion, useScroll, useSpring, useTransform,
    type Variants,
} from "motion/react";

/** The house curve, matched to --ease-out-expo. Leaves fast, settles slow. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Fade a block up as it arrives.
 *
 * `index` staggers siblings by 70ms — enough to read as a sequence, short
 * enough that the last item does not feel like it is waiting its turn.
 */
export function Reveal({
    children, index = 0, className = "", y = 26, once = true, duration = 0.7,
}: {
    children: React.ReactNode;
    index?: number;
    className?: string;
    y?: number;
    once?: boolean;
    duration?: number;
}) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: reduced ? 0 : y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once, amount: 0.18, margin: "0px 0px -6% 0px" }}
            transition={{ duration: reduced ? 0.25 : duration, ease: EASE, delay: index * 0.07 }}
        >
            {children}
        </motion.div>
    );
}

/** Stagger a list without hand-numbering every child. */
export const stagger: Variants = {
    hidden: {},
    shown: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 22 },
    shown: { opacity: 1, y: 0, transition: { duration: 0.66, ease: EASE } },
};

export function StaggerGroup({ children, className = "", amount = 0.15 }: {
    children: React.ReactNode; className?: string; amount?: number;
}) {
    return (
        <motion.div
            className={className}
            variants={stagger}
            initial="hidden"
            whileInView="shown"
            viewport={{ once: true, amount }}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({ children, className = "" }: {
    children: React.ReactNode; className?: string;
}) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            className={className}
            variants={reduced ? { hidden: { opacity: 0 }, shown: { opacity: 1 } } : staggerItem}
        >
            {children}
        </motion.div>
    );
}

/**
 * Drift a layer as the page scrolls past it.
 *
 * Parallax earns its keep on one thing — the hero art — where it separates
 * foreground from background. Spring-smoothed, because raw scroll values are
 * quantised by the wheel and step visibly.
 */
export function Parallax({ children, distance = 60, className = "" }: {
    children: React.ReactNode; distance?: number; className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
    const y = useSpring(raw, { stiffness: 90, damping: 26, mass: 0.4 });

    return (
        <div ref={ref} className={className}>
            <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
        </div>
    );
}

/**
 * Count up to a number when it first comes into view.
 *
 * Only for figures whose *magnitude* is the message — "132 countries" lands
 * harder counting. Never use it for money a user has to read and trust: a
 * balance that spins is a balance nobody can copy down.
 */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "", duration = 1400 }: {
    to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    const reduced = useReducedMotion();
    const [n, setN] = useState(0);

    useEffect(() => {
        // Reduced motion skips the effect entirely and renders the final value
        // below — setting it from here would be a synchronous setState in an
        // effect body, which cascades renders.
        if (!inView || reduced) return;
        let frame = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            // Same expo-out shape as the CSS, so it decelerates like everything else.
            setN(to * (1 - Math.pow(1 - t, 4)));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [inView, to, duration, reduced]);

    const shown = reduced ? to : n;
    return (
        <span ref={ref} className="tabular-nums">
            {prefix}{shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
        </span>
    );
}

/**
 * Tilt a card toward the pointer.
 *
 * Kept to a few degrees. Enough to say the surface is glass and responds to
 * you; past about 8° it stops looking premium and starts looking like a toy.
 * Disabled outright for touch, where there is no hover to justify it.
 */
export function Tilt({ children, className = "", max = 6 }: {
    children: React.ReactNode; className?: string; max?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const [t, setT] = useState({ x: 0, y: 0 });

    if (reduced) return <div className={className}>{children}</div>;

    return (
        <div
            ref={ref}
            className={className}
            style={{ perspective: 1200 }}
            onPointerMove={(e) => {
                if (e.pointerType !== "mouse") return;
                const b = ref.current?.getBoundingClientRect();
                if (!b) return;
                setT({
                    x: (((e.clientY - b.top) / b.height) - 0.5) * -2 * max,
                    y: (((e.clientX - b.left) / b.width) - 0.5) * 2 * max,
                });
            }}
            onPointerLeave={() => setT({ x: 0, y: 0 })}
        >
            <motion.div
                animate={{ rotateX: t.x, rotateY: t.y }}
                transition={{ type: "spring", stiffness: 150, damping: 18, mass: 0.5 }}
                style={{ transformStyle: "preserve-3d" }}
            >
                {children}
            </motion.div>
        </div>
    );
}

/**
 * An endlessly scrolling row.
 *
 * The children are rendered twice and the track slides exactly -50%, so the
 * second copy is in the first copy's place at the moment it resets. Hovering
 * pauses it — a logo you cannot stop to read is a logo nobody reads.
 */
export function Marquee({ children, duration = 38, fade = "both", className = "" }: {
    children: React.ReactNode;
    duration?: number;
    /** "right" when a label sits immediately to the left — fading there would
     *  swallow the first item before anyone reads it. */
    fade?: "both" | "right";
    className?: string;
}) {
    return (
        <div className={`marquee ${fade === "both" ? "edge-fade" : "edge-fade-r"} overflow-hidden ${className}`}>
            <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
                <div className="flex shrink-0 items-center">{children}</div>
                <div className="flex shrink-0 items-center" aria-hidden>{children}</div>
            </div>
        </div>
    );
}
