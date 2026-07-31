"use client";
// Motion for the marketing page, kept in one place so timings can't drift.
//
// Two behaviours, both of which stop completely once they've arrived:
//   useSmoothScroll — eases the page toward the real scroll position (lerp .08)
//   Reveal          — fades a block up 32px once, on first entry
//
// Nothing loops, nothing idles. Movement is a transition between two resting
// states, not decoration.
import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Native scroll still drives layout and the scrollbar; we only translate the
 * content toward the target so it arrives slightly behind the wheel. Falls back
 * to plain scrolling for reduced motion, touch, and small screens — on a phone
 * the offset fights momentum scrolling and feels broken rather than smooth.
 */
export function useSmoothScroll(enabled = true) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || !enabled || prefersReducedMotion()) return;
        if (window.matchMedia("(hover: none), (max-width: 900px)").matches) return;

        let current = window.scrollY;
        let raf = 0;
        let running = true;

        const setBodyHeight = () => {
            document.body.style.height = `${el.scrollHeight}px`;
        };
        setBodyHeight();

        const ro = new ResizeObserver(setBodyHeight);
        ro.observe(el);

        el.style.position = "fixed";
        el.style.inset = "0";
        el.style.willChange = "transform";

        const tick = () => {
            if (!running) return;
            const target = window.scrollY;
            current += (target - current) * 0.08;
            // Snap the last fraction of a pixel, otherwise it never settles and
            // the compositor keeps a layer alive forever.
            if (Math.abs(target - current) < 0.1) current = target;
            el.style.transform = `translate3d(0, ${-current}px, 0)`;
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            running = false;
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.body.style.height = "";
            el.style.position = "";
            el.style.inset = "";
            el.style.transform = "";
            el.style.willChange = "";
        };
    }, [enabled]);

    return ref;
}

/**
 * Reveals its children once. `index` staggers siblings by 80ms — enough to read
 * as a sequence, short enough not to feel slow.
 */
export function Reveal({
    children,
    index = 0,
    className = "",
    as: Tag = "div",
}: {
    children: React.ReactNode;
    index?: number;
    className?: string;
    as?: "div" | "section" | "li" | "tr";
}) {
    const ref = useRef<HTMLElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // Reduced motion is handled in CSS, which forces .reveal to opacity:1
        // with !important and beats the inline style below. Nothing to do here.

        const io = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                setShown(true);
                io.disconnect();   // once only — re-revealing on scroll-up is nauseating
            },
            { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <Tag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={ref as any}
            className={`reveal ${className}`}
            style={{
                opacity: shown ? 1 : 0,
                transform: shown ? "none" : "translateY(32px)",
                transition: `opacity var(--reveal-duration) var(--ease-out-expo) ${index * 80}ms, transform var(--reveal-duration) var(--ease-out-expo) ${index * 80}ms`,
            }}
        >
            {children}
        </Tag>
    );
}
