"use client";
// Floating launcher, bottom right — the pattern everyone already recognises from
// support widgets, so nobody needs to be told what it is.
//
// It's the same AskBot as the full page, just reachable without leaving whatever
// you're looking at. That's the point: someone in a meeting wants a number
// without navigating away from the screen they're presenting.
import { useEffect, useState } from "react";
import { Resizable } from "re-resizable";
import { MessageCircle, X, Maximize2, Minimize2 } from "lucide-react";
import AskBot, { fetchSuggestions } from "@/components/ask-bot";

// Two presets. "Comfortable" is the default; "roomy" is for reading a long
// breakdown without scrolling. Free resizing sits on top of both.
const PRESETS = {
    normal: { width: 380, height: 520 },
    large: { width: 520, height: 660 },
};

// The panel must never fill the screen — you have to be able to see the page
// you're asking about, and something behind it to click back to.
const MIN = { width: 300, height: 340 };
const inset = { w: 32, h: 116 };   // gutter + the launcher's own footprint

export default function AskWidget() {
    const [open, setOpen] = useState(false);
    const [preset, setPreset] = useState<keyof typeof PRESETS>("normal");
    const [size, setSize] = useState(PRESETS.normal);
    const [max, setMax] = useState({ width: 9999, height: 9999 });

    // Recomputed on resize so the panel shrinks with the window rather than
    // hanging off the edge of a laptop screen someone just plugged in.
    useEffect(() => {
        const measure = () => setMax({
            width: Math.max(MIN.width, window.innerWidth - inset.w),
            height: Math.max(MIN.height, window.innerHeight - inset.h),
        });
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // The panel is only mounted once it's opened, so its starter questions would
    // otherwise be requested at the exact moment someone is looking at the empty
    // space they belong in. This launcher is mounted on every page, so asking
    // here means the answer is normally cached before the first click.
    useEffect(() => { void fetchSuggestions(); }, []);

    function togglePreset() {
        const next = preset === "normal" ? "large" : "normal";
        setPreset(next);
        setSize({
            width: Math.min(PRESETS[next].width, max.width),
            height: Math.min(PRESETS[next].height, max.height),
        });
    }

    const shown = {
        width: Math.min(size.width, max.width),
        height: Math.min(size.height, max.height),
    };

    return (
        <>
            {open && (
                <div className="no-print fixed z-50 bottom-20 right-4 sm:right-6">
                    <Resizable
                        size={shown}
                        minWidth={MIN.width}
                        minHeight={MIN.height}
                        maxWidth={max.width}
                        maxHeight={max.height}
                        // Handles on the top and left only. The panel is pinned to
                        // the bottom-right, so those are the edges that actually
                        // move; a bottom-right handle would grow it off-screen
                        // while the cursor went the other way.
                        enable={{ top: true, left: true, topLeft: true }}
                        onResizeStop={(_e, _dir, ref) => {
                            setSize({ width: ref.offsetWidth, height: ref.offsetHeight });
                        }}
                        handleStyles={{
                            topLeft: { width: 14, height: 14, left: 0, top: 0, cursor: "nwse-resize" },
                            top: { cursor: "ns-resize" },
                            left: { cursor: "ew-resize" },
                        }}
                        className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] overflow-hidden"
                    >
                        <div className="flex h-full flex-col">
                            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0">
                                <div className="min-w-0">
                                    <div className="text-[13px] font-medium truncate">Ask about your payments</div>
                                    <div className="text-[11px] text-[var(--text-faint)] truncate">Figures come from your records</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={togglePreset}
                                        aria-label={preset === "normal" ? "Make larger" : "Make smaller"}
                                        title={preset === "normal" ? "Make larger" : "Make smaller"}
                                        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition">
                                        {preset === "normal" ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                    </button>
                                    <button onClick={() => setOpen(false)} aria-label="Close"
                                        className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition">
                                        <X size={15} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 min-h-0">
                                <AskBot bare height="100%" />
                            </div>
                        </div>
                    </Resizable>
                </div>
            )}

            <button
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label={open ? "Close assistant" : "Ask about your payments"}
                className="no-print fixed z-50 bottom-5 right-4 sm:right-6 grid h-12 w-12 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_10px_30px_-6px_var(--accent-glow)] transition hover:brightness-110 active:scale-95"
            >
                {open ? <X size={20} /> : <MessageCircle size={20} />}
            </button>
        </>
    );
}
