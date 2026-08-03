"use client";
// The dropdown, replacing the native <select>.
//
// A native select can't be styled past its trigger: the option list is drawn by
// the OS, so it arrives as a white Windows menu in the middle of a dark product
// and there is no CSS that reaches it. Radix renders the list as real DOM, which
// is the only way to make it look like the rest of the app — while keeping the
// things a native select gets right for free and hand-rolled ones usually break:
// keyboard navigation, typeahead, focus return, escape-to-close, and screen
// reader semantics.
//
// Long lists get a filter box. Nine countries is fine to eyeball; a list of
// every client is not, and scrolling to find one is the slowest way to pick.
import * as RS from "@radix-ui/react-select";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type Option = { value: string; label: string; hint?: string };

/** Below this a filter box is noise; above it, scrolling is the bottleneck. */
const SEARCH_THRESHOLD = 8;

export function Select({
    value, onChange, options, label, placeholder = "Select…", className = "", searchable,
}: {
    value: string;
    onChange: (v: string) => void;
    options: Option[];
    /** Accessible name. There is no visible <label> on these in-line filters. */
    label: string;
    placeholder?: string;
    className?: string;
    /** Force the filter box on or off; defaults to on for long lists. */
    searchable?: boolean;
}) {
    const [q, setQ] = useState("");
    const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;

    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((o) =>
            o.label.toLowerCase().includes(needle) || o.hint?.toLowerCase().includes(needle));
    }, [options, q]);

    return (
        <RS.Root
            value={value}
            onValueChange={onChange}
            // Clear the filter on close, so reopening never starts mid-search.
            onOpenChange={(open) => { if (!open) setQ(""); }}
        >
            <RS.Trigger
                aria-label={label}
                className={`inline-flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-dim)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)] focus:outline-none focus-visible:border-[var(--accent)] data-[state=open]:border-[var(--accent)] data-[state=open]:text-[var(--text)] ${className}`}
            >
                <RS.Value placeholder={placeholder} />
                <RS.Icon asChild>
                    <ChevronDown size={14} className="shrink-0 opacity-70 transition-transform duration-200 data-[state=open]:rotate-180" />
                </RS.Icon>
            </RS.Trigger>

            <RS.Portal>
                <RS.Content
                    position="popper"
                    sideOffset={6}
                    collisionPadding={12}
                    className="anim-pop z-[80] max-h-[min(60vh,22rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)]"
                >
                    {withSearch && (
                        <div className="border-b border-[var(--border)] p-2">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search…"
                                    aria-label={`Search ${label}`}
                                    // Radix moves focus to the list and treats
                                    // typing as typeahead; both would fight the
                                    // input, so the keys stay with it.
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-7 pr-2 text-[12px] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <RS.Viewport className="max-h-[16rem] overflow-y-auto p-1">
                        {shown.length === 0 ? (
                            <div className="px-3 py-6 text-center text-[12px] text-[var(--text-faint)]">
                                Nothing matches “{q.trim()}”
                            </div>
                        ) : shown.map((o) => (
                            <RS.Item
                                key={o.value}
                                value={o.value}
                                className="relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-3 pr-8 text-[13px] text-[var(--text-dim)] outline-none data-[highlighted]:bg-[var(--surface-2)] data-[highlighted]:text-[var(--text)] data-[state=checked]:text-[var(--text)]"
                            >
                                <span className="min-w-0 flex-1">
                                    <RS.ItemText>{o.label}</RS.ItemText>
                                    {o.hint && <span className="block truncate text-[11px] text-[var(--text-faint)]">{o.hint}</span>}
                                </span>
                                <RS.ItemIndicator className="absolute right-2.5">
                                    <Check size={13} className="text-[var(--accent)]" />
                                </RS.ItemIndicator>
                            </RS.Item>
                        ))}
                    </RS.Viewport>
                </RS.Content>
            </RS.Portal>
        </RS.Root>
    );
}

/** Convenience for the common `[value, label]` tuples already in the codebase. */
export const toOptions = (pairs: [string, string][]): Option[] =>
    pairs.map(([value, label]) => ({ value, label }));
