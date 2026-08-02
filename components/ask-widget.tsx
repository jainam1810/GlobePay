"use client";
// Floating launcher, bottom right — the pattern everyone already recognises from
// support widgets, so nobody needs to be told what it is.
//
// It's the same AskBot as the full page, just reachable without leaving whatever
// you're looking at. That's the point: someone in a meeting wants a number
// without navigating away from the screen they're presenting.
import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import AskBot from "@/components/ask-bot";

export default function AskWidget() {
    const [open, setOpen] = useState(false);

    // Escape closes it, like every other overlay on the platform.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    return (
        <>
            {open && (
                <div className="no-print fixed z-50 bottom-20 right-4 sm:right-6 w-[min(calc(100vw-2rem),380px)]">
                    <div className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--bg)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] overflow-hidden">
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
                            <div>
                                <div className="text-[13px] font-medium">Ask about your payments</div>
                                <div className="text-[11px] text-[var(--text-faint)]">Figures come from your records</div>
                            </div>
                            <button onClick={() => setOpen(false)} aria-label="Close"
                                className="text-[var(--text-faint)] hover:text-[var(--text)] transition">
                                <X size={16} />
                            </button>
                        </div>
                        <AskBot bare height="min(58vh, 460px)" />
                    </div>
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
