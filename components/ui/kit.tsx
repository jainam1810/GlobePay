"use client";
// The small pieces every screen is assembled from.
//
// One definition each, so a button in the payroll run and a button on the
// marketing page are the same object. Anything that needs to be a link renders
// through Radix's Slot, which means `asChild` gives you the styling without a
// nested <a> inside a <button>.
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

/* ── button ─────────────────────────────────────────────────────────────── */

type Variant = "primary" | "ghost" | "outline" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
    primary: "btn-fill",
    ghost: "btn-ghost",
    outline: "border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-white hover:border-[var(--accent-line)] bg-transparent",
    subtle: "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-dim)] hover:text-white hover:border-[var(--border-strong)]",
    danger: "bg-[var(--danger-soft)] border border-[var(--danger-line)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
};

const SIZE: Record<Size, string> = {
    sm: "text-[13px] px-3.5 py-2 gap-1.5",
    md: "text-[14px] px-5 py-2.5",
    lg: "text-[15px] px-6 py-3",
};

export const Button = forwardRef<HTMLButtonElement, {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    asChild?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
    { variant = "primary", size = "md", loading, asChild, className = "", children, disabled, ...rest }, ref,
) {
    const Comp = asChild ? Slot : "button";
    return (
        <Comp
            ref={ref}
            // A loading button stays disabled: the whole point is that the
            // action is already in flight and must not be fired twice.
            disabled={asChild ? undefined : disabled || loading}
            aria-busy={loading || undefined}
            className={`btn-pill ${VARIANT[variant]} ${SIZE[size]} disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none ${className}`}
            {...rest}
        >
            {asChild ? children : (
                <>
                    {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
                    {children}
                </>
            )}
        </Comp>
    );
});

/* ── spinner ────────────────────────────────────────────────────────────── */

/**
 * For waits with no shape to predict — a signature, a chain confirmation.
 * When the shape *is* known, use a skeleton instead: it tells you what is
 * coming, where a spinner only tells you to wait.
 */
export function Spinner({ size = 16, className = "", label }: {
    size?: number; className?: string; label?: string;
}) {
    return (
        <span className={`inline-flex items-center gap-2 ${className}`} role="status">
            <Loader2 size={size} className="animate-spin text-[var(--accent)]" aria-hidden />
            {label ? <span className="text-[13px] text-[var(--text-dim)]">{label}</span> : null}
            <span className="sr-only">{label ?? "Loading"}</span>
        </span>
    );
}

/** Fills its container. For a panel that has nothing to show yet. */
export function SpinnerBlock({ label = "Loading" }: { label?: string }) {
    return (
        <div className="grid min-h-[180px] place-items-center">
            <Spinner size={20} label={label} />
        </div>
    );
}

/* ── skeleton ───────────────────────────────────────────────────────────── */

/**
 * A placeholder must match what replaces it. If the skeleton is 20px tall and
 * the real row is 44px, the page jumps when data lands — which is worse than
 * having shown nothing.
 */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return <div className={`skeleton ${className}`} style={style} aria-hidden />;
}

/** Varying widths, because real text does not end in the same place twice. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
    const widths = ["92%", "78%", "85%", "64%", "88%"];
    return (
        <div className={`space-y-2 ${className}`} aria-hidden>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} className="h-3" style={{ width: widths[i % widths.length] }} />
            ))}
        </div>
    );
}

/** Table rows, at the real row height so nothing reflows on arrival. */
export function SkeletonRows({ rows = 5, cols = 4, className = "" }: {
    rows?: number; cols?: number; className?: string;
}) {
    return (
        <div className={`divide-y divide-[var(--border)] ${className}`} role="status" aria-label="Loading rows">
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="grid items-center gap-4 px-4 py-3.5"
                    style={{ gridTemplateColumns: `1.6fr ${Array.from({ length: cols - 1 }).map(() => "1fr").join(" ")}` }}>
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton key={c} className="h-3.5" style={{ width: c === 0 ? "70%" : "48%" }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div className={`card p-5 ${className}`} role="status" aria-label="Loading">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-4 h-2.5 w-full" />
        </div>
    );
}

/* ── empty state ────────────────────────────────────────────────────────── */

/**
 * The screen someone sees most often on their first day. It should say what
 * goes here and offer the action that fills it — never just "No data".
 */
export function Empty({ icon: Icon, title, body, action }: {
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    title: string;
    body?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="grid place-items-center px-6 py-16 text-center">
            <div>
                {Icon && (
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                        <Icon size={20} />
                    </div>
                )}
                <div className="text-[15px] font-medium">{title}</div>
                {body && <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--text-dim)]">{body}</p>}
                {action && <div className="mt-5 flex justify-center">{action}</div>}
            </div>
        </div>
    );
}
