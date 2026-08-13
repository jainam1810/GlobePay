"use client";
// The reviewer's screen: every invoice every client has sent, in one table.
//
// The job it replaces was download, open, re-upload, retype. So the row shows
// what the model read *and* a link to the page it read it from, side by side —
// checking a reading against the source is the whole of the work, and it should
// not cost a round trip through the downloads folder.
//
// Every field is editable, because the model is a first draft and the reviewer
// is the author. Nothing here moves money; accepting only puts the freelancer on
// the roster and records which invoice they are owed for.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    CheckCircle2, Clock, Download, ExternalLink, FileText, TriangleAlert, UserPlus, X,
} from "lucide-react";
import { STATUS_COPY, type InvoiceSubmission, type Verdict } from "@/lib/invoice-submissions";
import { SUPPORTED_COUNTRIES } from "@/lib/contractor-types";
import { Button, SkeletonRows, Empty } from "@/components/ui/kit";
import { Select, toOptions } from "@/components/ui/select";

const money = (n: number | null, ccy: string | null) =>
    n === null ? "—" : `${ccy && ccy !== "USD" ? ccy + " " : "$"}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
    match: { label: "On roster", cls: "text-[var(--accent)] border-[var(--accent-line)] bg-[var(--accent-soft)]" },
    new: { label: "New freelancer", cls: "text-[var(--warn)] border-[var(--warn-line)] bg-[var(--warn-soft)]" },
    conflict: { label: "Wallet conflict", cls: "text-[var(--danger)] border-[var(--danger-line)] bg-[var(--danger-soft)]" },
    duplicate: { label: "Duplicate", cls: "text-[var(--danger)] border-[var(--danger-line)] bg-[var(--danger-soft)]" },
};

type Tab = "pending" | "accepted" | "needs_attention";

export default function InvoiceQueue() {
    const [rows, setRows] = useState<InvoiceSubmission[] | null>(null);
    const [tab, setTab] = useState<Tab>("pending");
    const [err, setErr] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const r = await fetch("/api/invoices");
            const j = await r.json();
            setRows(r.ok ? (j.submissions ?? []) : []);
        } catch { setRows([]); }
    }, []);

    // Fetched inline rather than by calling load() straight from the effect
    // body, with a liveness flag so a reply that lands after unmount is dropped.
    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const r = await fetch("/api/invoices");
                const j = await r.json();
                if (live) setRows(r.ok ? (j.submissions ?? []) : []);
            } catch { if (live) setRows([]); }
        })();
        return () => { live = false; };
    }, []);

    const counts = useMemo(() => ({
        pending: rows?.filter((r) => r.status === "pending").length ?? 0,
        accepted: rows?.filter((r) => r.status === "accepted").length ?? 0,
        needs_attention: rows?.filter((r) => r.status === "needs_attention").length ?? 0,
    }), [rows]);

    const shown = rows?.filter((r) => r.status === tab) ?? [];

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
                {(["pending", "needs_attention", "accepted"] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${tab === t
                            ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--text)]"
                            : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}
                    >
                        {STATUS_COPY[t].label}
                        <span className="ml-1.5 font-mono text-[11px] text-[var(--text-faint)]">{counts[t]}</span>
                    </button>
                ))}
            </div>

            {err && (
                <p className="flex items-start gap-2 text-[12px] text-[var(--danger)]">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />{err}
                </p>
            )}

            {rows === null ? (
                <SkeletonRows rows={4} cols={5} />
            ) : shown.length === 0 ? (
                <Empty
                    icon={FileText}
                    title={tab === "pending" ? "Nothing waiting" : `No ${STATUS_COPY[tab].label.toLowerCase()} invoices`}
                    body={tab === "pending"
                        ? "Invoices clients upload land here, already read, ready to check."
                        : STATUS_COPY[tab].hint}
                />
            ) : (
                <ul className="space-y-3">
                    {shown.map((r) => (
                        <Card key={r.id} row={r} onChanged={load} onError={setErr} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function Card({ row, onChanged, onError }: {
    row: InvoiceSubmission;
    onChanged: () => Promise<void>;
    onError: (m: string | null) => void;
}) {
    const [f, setF] = useState({
        payee_name: row.payee_name ?? "",
        payee_wallet: row.payee_wallet ?? "",
        amount: row.amount === null ? "" : String(row.amount),
        currency: row.currency ?? "USD",
        invoice_number: row.invoice_number ?? "",
        invoice_date: row.invoice_date ?? "",
    });
    const [country, setCountry] = useState<string>(SUPPORTED_COUNTRIES[0]);
    const [note, setNote] = useState("");
    const [rejecting, setRejecting] = useState(false);
    const [busy, setBusy] = useState<"save" | "accept" | "reject" | null>(null);

    const v = row.match?.verdict ?? null;
    const dirty =
        f.payee_name !== (row.payee_name ?? "") ||
        f.payee_wallet !== (row.payee_wallet ?? "") ||
        f.amount !== (row.amount === null ? "" : String(row.amount)) ||
        f.currency !== (row.currency ?? "USD") ||
        f.invoice_number !== (row.invoice_number ?? "") ||
        f.invoice_date !== (row.invoice_date ?? "");

    // A conflict or a duplicate is never one click away. Correcting the fields
    // and saving re-runs the verdict; that is the deliberate path through.
    const blocked = v === "conflict" || v === "duplicate";

    async function act(action: "save" | "accept" | "reject") {
        setBusy(action); onError(null);
        try {
            const body: Record<string, unknown> = { action };
            if (action === "save") Object.assign(body, f, { amount: f.amount === "" ? null : Number(f.amount) });
            if (action === "accept" && v === "new") body.country = country;
            if (action === "reject") body.note = note;

            const r = await fetch(`/api/invoices/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "That didn't work");
            setRejecting(false); setNote("");
            await onChanged();
        } catch (e) {
            onError(e instanceof Error ? e.message : "That didn't work");
        } finally { setBusy(null); }
    }

    const input = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[13px] focus:border-[var(--accent)] focus:outline-none";
    const label = "block text-[11px] text-[var(--text-faint)] mb-1";

    return (
        <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    {row.client_name && (
                        <span className="pill text-[11px]">{row.client_name}</span>
                    )}
                    {v && (
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${VERDICT[v].cls}`}>
                            {VERDICT[v].label}
                        </span>
                    )}
                    <span className="text-[11px] text-[var(--text-faint)]">
                        {new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                </div>

                {/* The source document, one click away — checking the reading
                    against the page is the job. */}
                {row.file_url && (
                    <a
                        href={row.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--accent)] hover:underline"
                    >
                        <Download size={13} /> {row.file_name} <ExternalLink size={11} />
                    </a>
                )}
            </div>

            {row.match?.reason && (
                <p className={`mt-3 rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${blocked ? VERDICT[v!].cls : "border-[var(--border)] text-[var(--text-dim)]"}`}>
                    {row.match.reason}
                    {row.match.rosterAmount !== null && v === "match" && (
                        <span className="ml-1 text-[var(--text-faint)]">
                            Roster figure: {money(row.match.rosterAmount, "USD")}.
                        </span>
                    )}
                </p>
            )}

            {row.status === "pending" && (
                <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label><span className={label}>Freelancer</span>
                            <input className={input} value={f.payee_name} onChange={(e) => setF({ ...f, payee_name: e.target.value })} />
                        </label>
                        <label className="lg:col-span-2"><span className={label}>Wallet</span>
                            <input className={`${input} font-mono`} value={f.payee_wallet} onChange={(e) => setF({ ...f, payee_wallet: e.target.value })} placeholder="0x…" />
                        </label>
                        <label><span className={label}>Amount</span>
                            <input className={input} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
                        </label>
                        <label><span className={label}>Invoice no.</span>
                            <input className={input} value={f.invoice_number} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} />
                        </label>
                        <label><span className={label}>Invoice date</span>
                            <input className={input} type="date" value={f.invoice_date} onChange={(e) => setF({ ...f, invoice_date: e.target.value })} />
                        </label>
                        {v === "new" && (
                            <div>
                                <span className={label}>Country (needed to add them)</span>
                                <Select
                                    label="Country"
                                    value={country}
                                    onChange={setCountry}
                                    options={toOptions(SUPPORTED_COUNTRIES.map((c) => [c, c] as [string, string]))}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => act("accept")} loading={busy === "accept"} disabled={blocked || dirty}>
                            {v === "new" ? <><UserPlus size={14} /> Add &amp; accept</> : <><CheckCircle2 size={14} /> Accept</>}
                        </Button>
                        {dirty && (
                            <Button size="sm" variant="subtle" onClick={() => act("save")} loading={busy === "save"}>
                                Save corrections
                            </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setRejecting((x) => !x)}>
                            {rejecting ? <><X size={14} /> Cancel</> : "Send back"}
                        </Button>
                        {dirty && (
                            <span className="text-[11px] text-[var(--text-faint)]">
                                Save first — the check re-runs on what you saved.
                            </span>
                        )}
                    </div>

                    {rejecting && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <input
                                className={`${input} flex-1 min-w-[220px]`}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="What does the client need to fix?"
                            />
                            <Button size="sm" variant="danger" onClick={() => act("reject")} loading={busy === "reject"} disabled={!note.trim()}>
                                Send back
                            </Button>
                        </div>
                    )}
                </>
            )}

            {row.status !== "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                    <span className="font-medium">{row.payee_name || row.file_name}</span>
                    <span className="font-mono">{money(row.amount, row.currency)}</span>
                    {row.invoice_number && <span className="font-mono text-[11px] text-[var(--text-faint)]">{row.invoice_number}</span>}
                    <span className={`inline-flex items-center gap-1.5 text-[12px] ${row.status === "accepted" ? "text-[var(--accent)]" : "text-[var(--warn)]"}`}>
                        {row.status === "accepted" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {STATUS_COPY[row.status].label}
                    </span>
                    {row.review_note && <span className="text-[12px] text-[var(--text-dim)]">{row.review_note}</span>}
                </div>
            )}
        </li>
    );
}
