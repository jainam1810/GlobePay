"use client";
// Accepted invoices, turned into a payroll run.
//
// The step that was missing: accepting an invoice recorded what was owed, and
// then somebody retyped it into a run by hand. This carries the figures across.
//
// Preparing a run is where the client finally hears from us — it is the thing
// that emails them and puts a payroll on their dashboard to approve — so it sits
// behind a confirmation and says plainly what it is about to do. Accepting an
// invoice, by contrast, is silent on purpose.
import { useCallback, useEffect, useState } from "react";
import { Check, Send, TriangleAlert } from "lucide-react";
import type { OwedClient, OwedLine } from "@/app/api/invoices/ready/route";
import { Button } from "@/components/ui/kit";
import Confirm from "@/components/confirm";

const money = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * One line per freelancer, not one per invoice.
 *
 * A run has a single amount per person, so two invoices from the same
 * freelancer in the same month have to be added together — otherwise the second
 * one silently replaces the first and somebody is underpaid.
 */
export function toRun(g: OwedClient) {
    const byContractor = new Map<string, { amount: number; numbers: string[]; dates: string[]; descriptions: string[] }>();
    for (const l of g.lines) {
        if (!l.contractor_id) continue;
        const e = byContractor.get(l.contractor_id) ?? { amount: 0, numbers: [], dates: [], descriptions: [] };
        e.amount += Number(l.amount ?? 0);
        if (l.invoice_number) e.numbers.push(l.invoice_number);
        if (l.invoice_date) e.dates.push(l.invoice_date);
        if (l.description) e.descriptions.push(l.description);
        byContractor.set(l.contractor_id, e);
    }

    const contractorIds = [...byContractor.keys()];
    const amounts: Record<string, number> = {};
    const invoices: Record<string, { number?: string; date?: string; description?: string }> = {};
    for (const [id, e] of byContractor) {
        amounts[id] = Number(e.amount.toFixed(2));
        invoices[id] = {
            number: e.numbers.join(", ") || undefined,
            // Earliest, so the record dates from when the work was billed.
            date: e.dates.sort()[0] || undefined,
            description: e.descriptions.join(" · ") || undefined,
        };
    }
    return {
        clientId: g.client_id,
        contractorIds,
        amounts,
        invoices,
        submissionIds: g.lines.map((l) => l.id),
        people: contractorIds.length,
    };
}

export default function ReadyToPay({ onPrepared }: { onPrepared?: () => void }) {
    const [groups, setGroups] = useState<OwedClient[] | null>(null);
    const [asking, setAsking] = useState<OwedClient | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/invoices/ready");
            const j = await r.json();
            setGroups(r.ok ? (j.clients ?? []) : []);
        } catch { setGroups([]); }
    }, []);

    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const r = await fetch("/api/invoices/ready");
                const j = await r.json();
                if (live) setGroups(r.ok ? (j.clients ?? []) : []);
            } catch { if (live) setGroups([]); }
        })();
        return () => { live = false; };
    }, []);

    async function prepare(g: OwedClient) {
        setBusy(true); setMsg(null);
        try {
            const r = await fetch("/api/payroll-runs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toRun(g)),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "That run couldn't be prepared");
            setMsg({
                ok: true,
                text: `${g.client_name} has a payroll waiting for approval${j.notification?.sent ? " and has been emailed" : ""}.`,
            });
            await load();
            onPrepared?.();
        } catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : "That run couldn't be prepared" });
        } finally { setBusy(false); setAsking(null); }
    }

    if (groups === null) {
        return <div className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-2)]" />;
    }

    if (!groups.length && !msg) return null;

    return (
        <div className="space-y-3">
            {msg && (
                <p className={`flex items-start gap-2 text-[12px] ${msg.ok ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
                    {msg.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <TriangleAlert size={13} className="mt-0.5 shrink-0" />}
                    {msg.text}
                </p>
            )}

            {groups.map((g) => {
                const r = toRun(g);
                return (
                    <div key={g.client_id} className="rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[14px] font-medium">{g.client_name}</div>
                                <div className="mt-0.5 text-[12px] text-[var(--text-dim)]">
                                    {g.lines.length} accepted invoice{g.lines.length === 1 ? "" : "s"}
                                    {r.people !== g.lines.length && ` · ${r.people} freelancer${r.people === 1 ? "" : "s"}`}
                                    {" · "}<span className="font-mono">{money(g.total)}</span> owed
                                </div>
                            </div>
                            <Button size="sm" onClick={() => setAsking(g)} loading={busy && asking?.client_id === g.client_id}>
                                <Send size={14} /> Prepare payroll
                            </Button>
                        </div>

                        <ul className="mt-3 space-y-1">
                            {g.lines.map((l: OwedLine) => (
                                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12px] text-[var(--text-dim)]">
                                    <span>
                                        {l.payee_name}
                                        {l.invoice_number && <span className="ml-2 font-mono text-[11px] text-[var(--text-faint)]">{l.invoice_number}</span>}
                                    </span>
                                    <span className="font-mono">{money(Number(l.amount ?? 0))}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}

            <Confirm
                open={!!asking}
                onOpenChange={(v) => !v && setAsking(null)}
                title={`Prepare payroll for ${asking?.client_name ?? ""}?`}
                confirmLabel="Prepare it"
                onConfirm={async () => { if (asking) await prepare(asking); }}
                body={
                    <>
                        {asking && (
                            <>
                                {toRun(asking).people} freelancer{toRun(asking).people === 1 ? "" : "s"},{" "}
                                <span className="font-mono text-[var(--text)]">{money(asking.total)}</span> in total.
                                <span className="mt-2 block">
                                    This puts a payroll on {asking.client_name}&rsquo;s dashboard and emails them to approve it.
                                    No money moves until they sign — and these invoices stop showing as owed.
                                </span>
                            </>
                        )}
                    </>
                }
            />
        </div>
    );
}
