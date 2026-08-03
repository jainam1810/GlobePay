"use client";
// The company's own settings: who they are, and which wallet pays the payroll.
//
// The wallet is the consequential one. GlobePay holds no funds, so the address
// on file is not a balance — it is the single wallet allowed to approve this
// company's payroll runs, and the portal refuses to sign with anything else.
// Changing it therefore changes who can pay, which is why it is confirmed
// rather than saved as you type.
import { useState } from "react";
import { useAccount } from "wagmi";
import { Building2, Check, Copy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/kit";
import { Select, toOptions } from "@/components/ui/select";
import { COMPANY_COUNTRIES } from "@/lib/contractor-types";
import Confirm from "@/components/confirm";
import ConnectButton from "@/components/connect-button";
import Flag from "@/components/flag";
import { Section, Field, Note, inputCls, type Msg } from "@/components/settings-account";

export type ClientSettings = {
    id: string;
    company_name: string;
    home_country: string;
    contact_email: string | null;
    wallet_address: string | null;
};

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

async function patch(body: Record<string, unknown>) {
    const r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "That didn't save.");
    return j.client as ClientSettings;
}

/* ── company profile ────────────────────────────────────────────────────── */

export function CompanySection({ initial }: { initial: ClientSettings }) {
    const [form, setForm] = useState({
        company_name: initial.company_name,
        home_country: initial.home_country,
        contact_email: initial.contact_email ?? "",
    });
    const [saved, setSaved] = useState(form);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);

    const dirty = JSON.stringify(form) !== JSON.stringify(saved);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setMsg(null);
        try {
            await patch(form);
            setSaved(form);
            setMsg({ kind: "ok", text: "Saved." });
        } catch (err) {
            setMsg({ kind: "err", text: err instanceof Error ? err.message : "That didn't save." });
        } finally {
            setBusy(false);
        }
    }

    return (
        <Section
            icon={Building2}
            title="Company"
            description="Your name as it appears on the audit pack, and where payroll notices are sent."
        >
            <form onSubmit={save} className="max-w-sm space-y-3">
                <Field label="Company name">
                    <input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Head office" hint="Shown on records as where the payment was made from.">
                    <Select
                        label="Head office country"
                        value={form.home_country}
                        onChange={(v) => setForm({ ...form, home_country: v })}
                        options={toOptions(COMPANY_COUNTRIES.map((c) => [c, c] as [string, string]))}
                        className="w-full"
                    />
                </Field>
                <Field label="Notification email" hint="Where we email you when a payroll is ready to approve. Leave blank for none.">
                    <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="finance@yourcompany.com" className={inputCls} />
                </Field>
                <div className="flex items-center gap-2 pt-1">
                    <Flag country={form.home_country} size={16} />
                    <span className="text-[11px] text-[var(--text-faint)]">{form.home_country}</span>
                </div>
                <Button type="submit" size="sm" loading={busy} disabled={!dirty}>Save changes</Button>
                <Note state={msg} />
            </form>
        </Section>
    );
}

/* ── payout wallet ──────────────────────────────────────────────────────── */

export function WalletSection({ initial }: { initial: ClientSettings }) {
    const { address, isConnected } = useAccount();
    const [onFile, setOnFile] = useState(initial.wallet_address);
    const [ask, setAsk] = useState(false);
    const [copied, setCopied] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);

    const matches = same(address, onFile);
    // Only offer the swap when there is a different wallet actually connected —
    // a button that would save the address already saved is just noise.
    const canAdopt = isConnected && !!address && !matches;

    function copy() {
        if (!onFile) return;
        navigator.clipboard.writeText(onFile).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    }

    async function adopt() {
        setMsg(null);
        try {
            const c = await patch({ wallet_address: address });
            setOnFile(c.wallet_address);
            setMsg({ kind: "ok", text: "Saved. This wallet now approves your payroll." });
        } catch (err) {
            setMsg({ kind: "err", text: err instanceof Error ? err.message : "That didn't save." });
        }
    }

    return (
        <Section
            icon={Wallet}
            title="Payout wallet"
            description="The one wallet allowed to approve your payroll. GlobePay never holds it or its keys — it only checks that the wallet approving a run is this one."
        >
            <div className="max-w-md space-y-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">On file</div>
                    {onFile ? (
                        <div className="mt-1.5 flex items-center gap-2">
                            <span className="font-mono text-[13px]">{truncate(onFile)}</span>
                            <button onClick={copy} title="Copy wallet address" className="text-[var(--text-faint)] transition hover:text-[var(--text)]">
                                {copied ? <Check size={13} className="text-[var(--accent)]" /> : <Copy size={13} />}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-1.5 text-[13px] text-[var(--warn)]">No wallet yet — payroll can&apos;t be approved until one is set.</div>
                    )}
                </div>

                <div className="rounded-xl border border-[var(--border)] p-3.5">
                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Connected now</div>
                    {isConnected && address ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px]">{truncate(address)}</span>
                            {matches
                                ? <span className="pill text-[11px]"><Check size={11} className="text-[var(--accent)]" /> Matches</span>
                                : <span className="pill text-[11px] text-[var(--warn)]">Different wallet</span>}
                        </div>
                    ) : (
                        <div className="mt-2.5">
                            <ConnectButton />
                        </div>
                    )}
                </div>

                {canAdopt && (
                    <Button size="sm" onClick={() => setAsk(true)}>Use the connected wallet</Button>
                )}
                <Note state={msg} />
            </div>

            <Confirm
                open={ask}
                onOpenChange={setAsk}
                title="Change your payout wallet?"
                confirmLabel="Use this wallet"
                onConfirm={adopt}
                body={
                    <>
                        Payroll will be approved from{" "}
                        <span className="font-mono text-[var(--text)]">{address ? truncate(address) : ""}</span> from now on
                        {onFile && <> instead of <span className="font-mono text-[var(--text)]">{truncate(onFile)}</span></>}.
                        <span className="mt-2 block">
                            Nothing already paid changes, and no money moves now. If this isn&apos;t a wallet you control, you won&apos;t be able to approve anything.
                        </span>
                    </>
                }
            />
        </Section>
    );
}
