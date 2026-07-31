"use client";
// Motion for the marketing page, kept in one place so timings can't drift.
//
// Scroll itself is native. A lerp-based smooth scroll was tried and removed:
// easing the content toward the real scroll position means it always trails the
// wheel, which reads as lag rather than smoothness, and it overrides the
// momentum, trackpad and keyboard behaviour the OS already gets right.
//
// What's left is a single reveal that runs once per block and then stops. No
// loops, no idle animation — movement is a transition between two resting
// states, not decoration.
import { useEffect, useRef, useState } from "react";

/**
 * Fades a block up 32px the first time it enters the viewport. `index` staggers
 * siblings by 80ms — enough to read as a sequence, short enough not to feel slow.
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
