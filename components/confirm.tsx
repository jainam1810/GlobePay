"use client";
// One confirmation dialog, used everywhere something is hard to undo.
//
// Built on Radix AlertDialog rather than window.confirm() or a hand-rolled
// overlay: it traps focus, restores it on close, wires the aria roles, and
// closes on Escape — all things a bare div gets wrong and nobody notices until
// someone is navigating by keyboard.
//
// Deliberately sparing. A dialog in front of every action trains people to click
// through them, which costs you the one place it mattered. These appear only
// where a mistake is expensive: money that has been queued, or a record that
// cannot be recovered.
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function Confirm({
    open, onOpenChange, title, body, confirmLabel = "Confirm", danger = false, onConfirm,
    extraAction,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    title: string;
    /** One sentence on what happens, in particular anything not obvious. */
    body: React.ReactNode;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
    /**
     * A second, stronger outcome alongside the first — "delete for everyone"
     * beside "delete for me". Only for cases where the two are genuinely
     * different actions rather than a yes/no; a dialog with three ways to say
     * yes is a dialog nobody reads.
     */
    extraAction?: { label: string; onClick: () => void | Promise<void>; danger?: boolean };
}) {
    const [busy, setBusy] = useState(false);

    async function go() {
        setBusy(true);
        try { await onConfirm(); onOpenChange(false); }
        finally { setBusy(false); }
    }

    async function goExtra() {
        if (!extraAction) return;
        setBusy(true);
        try { await extraAction.onClick(); onOpenChange(false); }
        finally { setBusy(false); }
    }

    return (
        <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
            <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]" />
                <AlertDialog.Content className="fixed z-[61] left-1/2 top-1/2 w-[min(calc(100vw-2rem),400px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
                    <AlertDialog.Title className="text-[15px] font-medium">{title}</AlertDialog.Title>
                    <AlertDialog.Description asChild>
                        <div className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">{body}</div>
                    </AlertDialog.Description>

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                        {/* Cancel first and visually quieter: the safe option should be
                            the easy one to hit, and the destructive one deliberate. */}
                        <AlertDialog.Cancel asChild>
                            <button disabled={busy}
                                className="px-3.5 py-2 text-[13px] rounded-lg border border-[var(--border-strong)] text-[var(--text-dim)] hover:text-[var(--text)] transition disabled:opacity-50">
                                Cancel
                            </button>
                        </AlertDialog.Cancel>
                        <button onClick={go} disabled={busy}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium rounded-lg transition disabled:opacity-50 ${danger
                                ? "bg-[var(--danger)] text-white hover:brightness-110"
                                : "bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110"}`}>
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            {confirmLabel}
                        </button>
                        {/* Last, and the strongest — the furthest-reaching outcome
                            sits at the end of the row rather than under the thumb. */}
                        {extraAction && (
                            <button onClick={goExtra} disabled={busy}
                                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-50 ${extraAction.danger
                                    ? "bg-[var(--danger)] text-white hover:brightness-110"
                                    : "bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110"}`}>
                                {extraAction.label}
                            </button>
                        )}
                    </div>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    );
}
