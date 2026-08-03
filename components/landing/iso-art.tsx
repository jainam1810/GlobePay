"use client";
// The hero object: two rounded plates lying in space, one frosted, one blue.
//
// Built in CSS rather than shipped as an image. A 3D transform stays sharp at
// any viewport, re-themes with the tokens, weighs nothing, and can respond to
// scroll — none of which a PNG does. The whole thing is one square rotated into
// isometric: rotateX tips it away from you, rotateZ turns the square into a
// diamond. Every plate shares that rotation, so they read as one plane.
import { motion, useReducedMotion } from "motion/react";

/** Tip and turn. Shared by every plate so they sit on the same plane. */
const ISO = "rotateX(56deg) rotateZ(45deg)";

function Plate({
    tone, size, offset, lift, delay, label,
}: {
    tone: "glass" | "accent";
    size: number;
    offset: { x: number; y: number };
    lift: number;
    delay: number;
    label?: boolean;
}) {
    const reduced = useReducedMotion();

    // Two nested elements on purpose. Motion composes `transform` from its own
    // properties, so an inline transform string on an animated element gets
    // overwritten the moment the animation starts — which silently flattens the
    // whole thing. The outer element owns the float, the inner owns the pose.
    return (
        <motion.div
            className="absolute left-1/2 top-1/2"
            style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                transformStyle: "preserve-3d",
            }}
            // A slow, tiny hover. Enough to say the object is floating rather
            // than printed; small enough that it never pulls the eye off the
            // headline sitting next to it.
            animate={reduced ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay }}
        >
            <div
                className="h-full w-full"
                style={{
                    transformStyle: "preserve-3d",
                    // translateZ does the stacking. Because the element is
                    // rotated, "up" here is out of the plane — which is why the
                    // plates separate along the diagonal rather than straight up.
                    transform: `translate3d(${offset.x}px, ${offset.y}px, ${lift}px) ${ISO}`,
                }}
            >
                <div
                className="relative h-full w-full overflow-hidden"
                style={{
                    borderRadius: size * 0.19,
                    ...(tone === "accent"
                        ? {
                            background: "linear-gradient(145deg, rgba(90,140,255,0.95), rgba(28,72,205,0.92) 55%, rgba(16,44,140,0.95))",
                            border: "1px solid rgba(150,185,255,0.45)",
                            boxShadow: "0 1px 0 rgba(255,255,255,0.35) inset, 0 60px 120px -40px rgba(21,54,160,0.85)",
                        }
                        : {
                            background: "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))",
                            border: "1px solid rgba(255,255,255,0.22)",
                            backdropFilter: "blur(26px)",
                            WebkitBackdropFilter: "blur(26px)",
                            boxShadow: "0 1px 0 rgba(255,255,255,0.34) inset, 0 60px 120px -45px rgba(0,0,0,0.9)",
                        }),
                }}
            >
                {/* A soft highlight where the light lands, so the plate has a
                    surface instead of being a flat fill. */}
                <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                        background: tone === "accent"
                            ? "radial-gradient(60% 55% at 26% 18%, rgba(255,255,255,0.42), transparent 70%)"
                            : "radial-gradient(62% 58% at 30% 16%, rgba(255,255,255,0.30), transparent 72%)",
                    }}
                />

                {/* The mark, debossed into the plate: a dark copy offset down and
                    a light copy offset up is the cheapest convincing engraving. */}
                {label && (
                    <span
                        aria-hidden
                        className="absolute select-none font-medium tracking-[-0.03em]"
                        style={{
                            right: size * 0.08,
                            bottom: size * 0.1,
                            fontSize: size * 0.19,
                            color: "transparent",
                            // Barely there on purpose. An emboss you can read
                            // as text has stopped being a surface treatment and
                            // become a label competing with the headline.
                            textShadow: tone === "accent"
                                ? "0 1px 0 rgba(255,255,255,0.16), 0 -1px 0 rgba(0,0,0,0.16)"
                                : "0 1px 0 rgba(255,255,255,0.13), 0 -1px 0 rgba(0,0,0,0.12)",
                        }}
                    >
                        GlobePay
                    </span>
                )}

                    {/* Badge. Lies flat on the plate rather than standing off it:
                        the clip needed for the rounded corners flattens 3D for
                        everything inside, so a translateZ here would do nothing
                        but cost a layer. */}
                    <div
                        className="absolute grid place-items-center"
                        style={{
                            left: size * 0.1,
                            top: size * 0.1,
                            width: size * 0.19,
                            height: size * 0.19,
                            borderRadius: size * 0.055,
                            background: tone === "accent" ? "#123AA8" : "rgba(255,255,255,0.20)",
                            border: "1px solid rgba(255,255,255,0.30)",
                            boxShadow: "0 10px 24px -10px rgba(0,0,0,0.7)",
                        }}
                    >
                        <svg viewBox="0 0 24 24" width={size * 0.1} height={size * 0.1} fill="none" aria-hidden>
                            <path d="M3 8h13a4 4 0 0 1 0 8H8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
                            <path d="M21 16H8a4 4 0 0 1 0-8h1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.62" />
                        </svg>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export function IsoArt({ className = "" }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={`relative ${className}`}
            style={{ perspective: 1500, perspectiveOrigin: "50% 40%", transformStyle: "preserve-3d" }}
        >
            {/* The light the plates are sitting in. */}
            <div
                className="absolute left-1/2 top-1/2 h-[80%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(43,107,255,0.72), rgba(43,107,255,0.22) 46%, transparent 70%)", filter: "blur(60px)" }}
            />
            <Plate tone="glass" size={300} offset={{ x: -8, y: -74 }} lift={120} delay={0} label />
            <Plate tone="accent" size={300} offset={{ x: 74, y: 42 }} lift={0} delay={1.4} label />
        </div>
    );
}
