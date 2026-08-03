"use client";
// The company's own settings: who they are, and which wallet pays the payroll.
//
// The wallet is the consequential one. GlobePay holds no funds, so the address
// on file is not a balance — it is the single wallet allowed to approve this
// company's payroll runs, and the portal refuses to sign with anything else.
// Changing it therefore changes who can pay, which is why it is confirmed
// rather than saved as you type.
import { useCallback, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { Building2, Check, Copy, TriangleAlert, Wallet } from "lucide-react";
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
    const { disconnect } = useDisconnect();
    const [onFile, setOnFile] = useState(initial.wallet_address);
    const [ask, setAsk] = useState(false);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);
    // Set when the user asks to change wallets: it hides the current one and
    // shows the picker, so "change" is a decision rather than a side effect of
    // whatever their extension happened to be on.
    const [changing, setChanging] = useState(false);

    const matches = same(address, onFile);
    const otherConnected = isConnected && !!address && !!onFile && !matches;

    const save = useCallback(async (next: string) => {
        setBusy(true); setMsg(null);
        try {
            const c = await patch({ wallet_address: next });
            setOnFile(c.wallet_address);
            setChanging(false);
            setMsg({ kind: "ok", text: "Saved. This wallet approves your payroll from now on, and we've emailed you about the change." });
        } catch (err) {
            setMsg({ kind: "err", text: err instanceof Error ? err.message : "That didn't save." });
        } finally {
            setBusy(false);
        }
    }, []);

    // Connecting *is* how you set your payout wallet the first time. Making
    // someone connect and then press Save would be two steps for one decision,
    // and leaves an account with a connected wallet and nothing on file — the
    // state where payroll silently cannot be approved.
    const onConnected = useCallback(() => {
        if (!address) return;
        if (!onFile || changing) void save(address);
    }, [address, onFile, changing, save]);

    function copy() {
        if (!onFile) return;
        navigator.clipboard.writeText(onFile).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        });
    }

    function startChange() {
        setMsg(null);
        setChanging(true);
        // Drop the current connection so the wallet is free to offer its picker
        // again; staying connected would just re-announce the same account.
        if (isConnected) disconnect();
    }

    const showPicker = !onFile || changing;

    return (
        <Section
            icon={Wallet}
            title="Payout wallet"
            description="The wallet your payroll is approved from. It stays yours until you change it here — GlobePay never holds it or its keys."
        >
            <div className="max-w-md space-y-3">
                {onFile && !changing && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[15px]">{truncate(onFile)}</span>
                            <button onClick={copy} title="Copy wallet address"
                                className="cursor-pointer text-[var(--text-faint)] transition hover:text-[var(--text)]">
                                {copied ? <Check size={13} className="text-[var(--accent)]" /> : <Copy size={13} />}
                            </button>
                        </div>
                        {/* Connected is about this browser only. The wallet is on
                            file either way, so the wording never suggests it has
                            been lost — only that nothing can be signed right now. */}
                        <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                            <span className={`h-1.5 w-1.5 rounded-full ${matches ? "bg-[var(--accent)]" : "bg-[var(--text-faint)]"}`} />
                            <span className="text-[var(--text-dim)]">
                                {matches ? "Connected in this browser" : "Not connected in this browser"}
                            </span>
                        </div>
                    </div>
                )}

                {/* Amber, not the accent: .notice is blue and at this size reads
                    like a run of selected text rather than a warning. */}
                {otherConnected && (
                    <div className="flex items-start gap-2 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-soft)] p-3 text-[12px] leading-relaxed text-[var(--text-dim)]">
                        <TriangleAlert size={14} className="mt-0.5 shrink-0 text-[var(--warn)]" />
                        <span>
                            A different wallet — <span className="font-mono text-[var(--text)]">{truncate(address!)}</span> — is
                            connected right now. Payroll can only be approved from your payout wallet above.
                        </span>
                    </div>
                )}

                {showPicker ? (
                    <div className="space-y-2.5">
                        <p className="text-[12px] text-[var(--text-dim)]">
                            {changing
                                ? "Connect the wallet you want to pay from. It replaces the one above once connected."
                                : "Connect the wallet you'll pay from. It becomes your payout wallet and stays until you change it here."}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <ConnectButton label={changing ? "Connect a wallet" : "Connect wallet"} onConnected={onConnected} />
                            {changing && (
                                <Button size="sm" variant="ghost" onClick={() => { setChanging(false); setMsg(null); }}>
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="subtle" onClick={startChange} loading={busy}>Change wallet</Button>
                        {otherConnected && (
                            <Button size="sm" variant="ghost" onClick={() => setAsk(true)}>
                                Use {truncate(address!)} instead
                            </Button>
                        )}
                        {!isConnected && (
                            <ConnectButton label="Reconnect" onConnected={onConnected} />
                        )}
                    </div>
                )}

                <Note state={msg} />
            </div>

            <Confirm
                open={ask}
                onOpenChange={setAsk}
                title="Change your payout wallet?"
                confirmLabel="Use this wallet"
                onConfirm={() => address && save(address)}
                body={
                    <>
                        Payroll will be approved from{" "}
                        <span className="font-mono text-[var(--text)]">{address ? truncate(address) : ""}</span> from now on
                        {onFile && <> instead of <span className="font-mono text-[var(--text)]">{truncate(onFile)}</span></>}.
                        <span className="mt-2 block">
                            Nothing already paid changes and no money moves now. We&apos;ll email you to confirm the change.
                        </span>
                    </>
                }
            />
        </Section>
    );
}
