"use client";
// The parts of settings that belong to a person rather than a company: how you
// sign in, and where else you are signed in. Shared by the client portal and the
// operator console, because an admin changes their password the same way.
//
// Email and password go straight to Supabase Auth from the browser. That is the
// point — a password never passes through GlobePay's own code on its way to
// being set, so there is no route of ours that could log it.
import { useState } from "react";
import Link from "next/link";
import { Check, LifeBuoy, Mail, KeyRound, ExternalLink } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/kit";

/* ── shared shell ───────────────────────────────────────────────────────── */

export function Section({ icon: Icon, title, description, children }: {
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="card p-5 sm:p-6">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--text-dim)]">
                    <Icon size={15} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-medium">{title}</h2>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-dim)]">{description}</p>
                    <div className="mt-4">{children}</div>
                </div>
            </div>
        </section>
    );
}

export const inputCls =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-dim)]">{label}</span>
            {children}
            {hint && <span className="mt-1 block text-[11px] text-[var(--text-faint)]">{hint}</span>}
        </label>
    );
}

/** Whatever the last attempt said — never a raw Postgres or GoTrue string. */
export function Note({ state }: { state: { kind: "ok" | "err"; text: string } | null }) {
    if (!state) return null;
    return (
        <p className={`mt-3 flex items-start gap-1.5 text-[12px] ${state.kind === "ok" ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}>
            {state.kind === "ok" && <Check size={13} className="mt-0.5 shrink-0" />}
            <span>{state.text}</span>
        </p>
    );
}

export type Msg = { kind: "ok" | "err"; text: string } | null;

/* ── email ──────────────────────────────────────────────────────────────── */

/**
 * Changing the sign-in address, in two steps with a code.
 *
 * A code rather than a link, because a link only proves someone clicked
 * something in that inbox — often on a different device, sometimes a scanner
 * that followed it automatically. Typing a code back into the session that
 * asked for it proves the person changing the address is the person holding
 * the new inbox, in the place the change is happening.
 *
 * Requires the Supabase "Change Email Address" template to contain
 * {{ .Token }}; without it the mail carries a link and no code to type.
 */
export function EmailSection({ current }: { current: string | null }) {
    const [email, setEmail] = useState(current ?? "");
    const [code, setCode] = useState("");
    // The address a code was actually sent to — kept separately so editing the
    // field afterwards can't verify a code against a different address.
    const [pending, setPending] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);

    const changed = email.trim().toLowerCase() !== (current ?? "").toLowerCase();

    async function sendCode(e: React.FormEvent) {
        e.preventDefault();
        const next = email.trim();
        setBusy(true); setMsg(null);
        const { error } = await getSupabaseBrowser().auth.updateUser({ email: next });
        setBusy(false);
        if (error) return setMsg({ kind: "err", text: "That address couldn't be used. Check it and try again." });
        setPending(next);
        setMsg({ kind: "ok", text: `We've sent a 6-digit code to ${next}. Enter it below to finish the change.` });
    }

    async function verify(e: React.FormEvent) {
        e.preventDefault();
        if (!pending) return;
        setBusy(true); setMsg(null);
        const { error } = await getSupabaseBrowser().auth.verifyOtp({
            email: pending,
            token: code.trim(),
            type: "email_change",
        });
        setBusy(false);
        if (error) return setMsg({ kind: "err", text: "That code didn't work. Check it, or send a new one." });
        setPending(null); setCode("");
        setMsg({ kind: "ok", text: `Done — you'll sign in with ${pending} from now on.` });
    }

    function cancel() {
        setPending(null); setCode(""); setMsg(null);
        setEmail(current ?? "");
    }

    return (
        <Section
            icon={Mail}
            title="Email address"
            description="The address you sign in with. We'll email a code to the new address to confirm it's yours."
        >
            {pending ? (
                <form onSubmit={verify} className="max-w-sm space-y-3">
                    <Field label={`Code sent to ${pending}`} hint="Six digits. It expires shortly — send a new one if it does.">
                        <input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            // One-time-code autocomplete lets a phone offer the
                            // code from the notification instead of retyping it.
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            required
                            placeholder="000000"
                            className={`${inputCls} font-mono tracking-[0.3em]`}
                        />
                    </Field>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" size="sm" loading={busy} disabled={code.trim().length < 6}>Confirm change</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
                    </div>
                    <Note state={msg} />
                </form>
            ) : (
                <form onSubmit={sendCode} className="max-w-sm space-y-3">
                    <Field label="Sign-in email">
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                    </Field>
                    <Button type="submit" size="sm" loading={busy} disabled={!changed}>Send confirmation code</Button>
                    <Note state={msg} />
                </form>
            )}
        </Section>
    );
}

/* ── password ───────────────────────────────────────────────────────────── */

/** Supabase's own floor. Stated up front rather than after a failed attempt. */
const MIN_PASSWORD = 6;

export function PasswordSection({ email }: { email: string | null }) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        if (next !== confirm) return setMsg({ kind: "err", text: "The two new passwords don't match." });
        if (next.length < MIN_PASSWORD) return setMsg({ kind: "err", text: `Use at least ${MIN_PASSWORD} characters.` });
        if (!email) return setMsg({ kind: "err", text: "No email on this account — contact GlobePay." });

        setBusy(true); setMsg(null);
        const supabase = getSupabaseBrowser();

        // Prove they know the current one first. Supabase can enforce this
        // server-side, but only when the project has that flag turned on, and a
        // change-password form that doesn't ask is a session left unattended on
        // a shared machine away from being someone else's account.
        const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: current });
        if (reauth) {
            setBusy(false);
            return setMsg({ kind: "err", text: "That current password isn't right." });
        }

        const { error } = await supabase.auth.updateUser({ password: next });
        setBusy(false);
        if (error) return setMsg({ kind: "err", text: "That password couldn't be set. Try a different one." });
        setCurrent(""); setNext(""); setConfirm("");
        setMsg({ kind: "ok", text: "Password updated. Other devices stay signed in — sign them out below if you want them gone." });
    }

    return (
        <Section
            icon={KeyRound}
            title="Password"
            description="Protects the dashboard and your payment history. It never moves money on its own — that always takes your wallet."
        >
            <form onSubmit={save} className="max-w-sm space-y-3">
                <Field label="Current password">
                    <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
                </Field>
                <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
                    <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Confirm new password">
                    <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
                </Field>
                <Button type="submit" size="sm" loading={busy} disabled={!current || !next || !confirm}>Change password</Button>
                <Note state={msg} />
            </form>
        </Section>
    );
}

/* ── help ───────────────────────────────────────────────────────────────── */

export function HelpSection({ version, messagesHref = "/portal/messages" }: { version: string; messagesHref?: string }) {
    const row = "flex items-center justify-between gap-3 border-b border-[var(--border)] py-2.5 text-[13px] last:border-0";
    const link = "inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline";
    return (
        <Section icon={LifeBuoy} title="Help" description="Questions about a payment, or something that doesn't look right.">
            <div className="max-w-sm">
                <div className={row}>
                    <span className="text-[var(--text-dim)]">Messages</span>
                    <Link href={messagesHref} className={link}>Open messages</Link>
                </div>
                <div className={row}>
                    <span className="text-[var(--text-dim)]">Email us</span>
                    <Link href="/contact" className={link}>Contact <ExternalLink size={12} /></Link>
                </div>
                <div className={row}>
                    <span className="text-[var(--text-dim)]">Common questions</span>
                    <Link href="/#faq" className={link}>Read the FAQ <ExternalLink size={12} /></Link>
                </div>
                <div className={row}>
                    <span className="text-[var(--text-dim)]">Version</span>
                    <span className="font-mono text-[12px] text-[var(--text-faint)]">{version}</span>
                </div>
            </div>
        </Section>
    );
}
