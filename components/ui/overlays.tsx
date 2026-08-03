"use client";
// Radix primitives, wearing GlobePay's clothes.
//
// Radix supplies the parts that are genuinely hard and genuinely invisible:
// focus trapping, escape handling, aria wiring, typeahead, collision-aware
// positioning, and the ability to animate a panel *out* before it unmounts.
// Hand-rolled versions of these are where accessibility quietly dies. We only
// bring the styling.
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, X } from "lucide-react";

/* ── tooltip ────────────────────────────────────────────────────────────── */

/** Mounted once, high in the tree. Shared delay = tooltips feel like one system. */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
    return <TooltipPrimitive.Provider delayDuration={220} skipDelayDuration={400}>{children}</TooltipPrimitive.Provider>;
}

/**
 * A tooltip may only ever *add* detail. If the interface cannot be used without
 * reading one, the label on the control is wrong — fix that instead.
 */
export function Tooltip({ children, content, side = "top" }: {
    children: React.ReactNode;
    content: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
}) {
    return (
        <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                    side={side}
                    sideOffset={7}
                    collisionPadding={10}
                    className="anim-pop z-[100] max-w-[260px] rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] leading-snug text-[var(--text)] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)]"
                >
                    {content}
                    <TooltipPrimitive.Arrow className="fill-[var(--border-strong)]" width={10} height={5} />
                </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
    );
}

/* ── accordion ──────────────────────────────────────────────────────────── */

export function Accordion({ items }: { items: { q: string; a: React.ReactNode }[] }) {
    return (
        <AccordionPrimitive.Root type="single" collapsible className="divide-y divide-[var(--border)]">
            {items.map((it, i) => (
                <AccordionPrimitive.Item key={i} value={`i${i}`} className="group">
                    <AccordionPrimitive.Header>
                        <AccordionPrimitive.Trigger className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-white">
                            <span className="text-[15px] font-medium">{it.q}</span>
                            <ChevronDown
                                size={17}
                                className="shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-data-[state=open]:rotate-180"
                            />
                        </AccordionPrimitive.Trigger>
                    </AccordionPrimitive.Header>
                    {/* Radix measures the panel and exposes its height as a CSS
                        variable, which is what makes a real height transition
                        possible — `height: auto` cannot be animated. */}
                    <AccordionPrimitive.Content className="anim-accordion overflow-hidden">
                        <div className="pb-5 pr-8 text-[14px] leading-relaxed text-[var(--text-dim)]">{it.a}</div>
                    </AccordionPrimitive.Content>
                </AccordionPrimitive.Item>
            ))}
        </AccordionPrimitive.Root>
    );
}

/* ── progress ───────────────────────────────────────────────────────────── */

/**
 * Determinate progress. Use only when the total is genuinely known — a bar that
 * sits at 90% for a minute costs more trust than a spinner ever would.
 */
export function Progress({ value, label, className = "" }: {
    value: number; label?: string; className?: string;
}) {
    const v = Math.max(0, Math.min(100, value));
    return (
        <div className={className}>
            {label && (
                <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                    <span className="text-[var(--text-dim)]">{label}</span>
                    <span className="tabular-nums text-[var(--text-faint)]">{Math.round(v)}%</span>
                </div>
            )}
            <ProgressPrimitive.Root
                value={v}
                className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
            >
                <ProgressPrimitive.Indicator
                    className="h-full rounded-full bg-[var(--accent)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    style={{ transform: `translateX(-${100 - v}%)` }}
                />
            </ProgressPrimitive.Root>
        </div>
    );
}

/* ── sheet (mobile nav) ─────────────────────────────────────────────────── */

export function Sheet({ open, onOpenChange, title, children }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="anim-fade fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm" />
                <DialogPrimitive.Content className="anim-sheet-top fixed inset-x-0 top-0 z-[95] border-b border-[var(--border)] bg-[var(--bg-2)] p-5 shadow-2xl">
                    <div className="flex items-center justify-between">
                        <DialogPrimitive.Title className="text-[15px] font-medium">{title}</DialogPrimitive.Title>
                        <DialogPrimitive.Close className="rounded-lg p-1.5 text-[var(--text-dim)] transition hover:bg-[var(--surface-2)] hover:text-white">
                            <X size={18} />
                            <span className="sr-only">Close</span>
                        </DialogPrimitive.Close>
                    </div>
                    <div className="mt-5">{children}</div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
