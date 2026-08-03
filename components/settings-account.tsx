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
import { useRouter } from "next/navigation";
import { Check, LifeBuoy, LogOut, Mail, KeyRound, ExternalLink } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/kit";
import Confirm from "@/components/confirm";

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

export function EmailSection({ current }: { current: string | null }) {
    const [email, setEmail] = useState(current ?? "");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<Msg>(null);

    const changed = email.trim().toLowerCase() !== (current ?? "").toLowerCase();

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setMsg(null);
        const { error } = await getSupabaseBrowser().auth.updateUser({ email: email.trim() });
        setBusy(false);
        setMsg(error
            ? { kind: "err", text: "That address couldn't be used. Check it and try again." }
            // Nothing has changed yet, and saying so matters: someone who
            // assumes it has will try the new address at the next sign-in and
            // be locked out of a payroll they were about to approve.
            : { kind: "ok", text: `Check ${email.trim()} for a confirmation link. Your sign-in address changes only once you've clicked it.` });
    }

    return (
        <Section
            icon={Mail}
            title="Email address"
            description="The address you sign in with. Changing it needs confirming from the new address first."
        >
            <form onSubmit={save} className="max-w-sm space-y-3">
                <Field label="Sign-in email">
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </Field>
                <Button type="submit" size="sm" loading={busy} disabled={!changed}>Update email</Button>
                <Note state={msg} />
            </form>
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

/* ── sessions ───────────────────────────────────────────────────────────── */

export function SessionsSection() {
    const router = useRouter();
    const [ask, setAsk] = useState(false);

    async function signOutEverywhere() {
        // 'global' revokes every refresh token for the user, this browser
        // included, which is the honest behaviour for "everywhere".
        await getSupabaseBrowser().auth.signOut({ scope: "global" });
        router.replace("/login");
    }

    return (
        <Section
            icon={LogOut}
            title="Signed-in devices"
            description="Signed in somewhere you shouldn't be — an old laptop, a shared machine? End every session at once."
        >
            <Button size="sm" variant="ghost" onClick={() => setAsk(true)}>Sign out everywhere</Button>
            <Confirm
                open={ask}
                onOpenChange={setAsk}
                title="Sign out on every device?"
                confirmLabel="Sign out everywhere"
                danger
                onConfirm={signOutEverywhere}
                body="Every browser and device signed in to this account will be signed out, including this one. Your payments and records aren't affected."
            />
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
