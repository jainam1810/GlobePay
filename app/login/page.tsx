"use client";
// Split sign-in: the form on the left, what GlobePay is on the right.
//
// The form comes first in the DOM as well as on screen — it is why anyone is
// here, and it is what a screen reader should reach first. The panel is an
// <aside> that simply does not render below lg, because a marketing panel that
// pushes the password field off a phone screen is worse than no panel.
//
// Accessibility rules this screen is built to (WCAG 2.2):
//   3.3.8 — never block paste, never block autofill, never make anyone
//           transcribe anything. The inputs carry autocomplete hints so
//           password managers fill them without a fight.
//   2.2.2 — the panel's slider auto-advances, so it has a pause control.
//   1.4.1 — errors are an icon plus words, never colour on its own.
//
// The auth logic underneath is unchanged.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Showcase } from "@/components/login/showcase";
import { Logo } from "@/components/landing/nav";
import { Button } from "@/components/ui/kit";

const field =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14px] " +
    "transition placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none " +
    "focus:ring-2 focus:ring-[var(--accent-soft)]";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true); setErr(null);
        try {
            const { error } = await getSupabaseBrowser().auth.signInWithPassword({ email, password });
            if (error) throw new Error(/invalid/i.test(error.message) ? "Wrong email or password." : error.message);
            router.replace("/route");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Sign-in failed");
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* ── form ── */}
            <div className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:min-h-0">
                <div className="flex items-center justify-between">
                    <Link href="/" aria-label="GlobePay home"><Logo size={30} /></Link>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-dim)] transition hover:text-white"
                    >
                        <ArrowLeft size={14} /> Back
                    </Link>
                </div>

                <div className="flex flex-1 items-center justify-center py-12">
                    <div className="w-full max-w-[380px]">
                        <h1 className="text-gradient text-[30px] font-medium tracking-[-0.035em]">Welcome back</h1>
                        <p className="mt-2 text-[14px] text-[var(--text-dim)]">
                            Sign in to run payroll, read invoices and export your audit pack.
                        </p>

                        <form onSubmit={submit} className="mt-8" noValidate>
                            <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-[var(--text-dim)]">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                className={field}
                                aria-invalid={!!err}
                            />

                            <label htmlFor="password" className="mb-1.5 mt-5 block text-[13px] font-medium text-[var(--text-dim)]">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={show ? "text" : "password"}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`${field} pr-11`}
                                    aria-invalid={!!err}
                                />
                                {/* Being able to see what you typed is the cheapest
                                    fix for a mistyped password, and it is what
                                    "don't make people transcribe blind" means in
                                    practice. */}
                                <button
                                    type="button"
                                    onClick={() => setShow((s) => !s)}
                                    aria-label={show ? "Hide password" : "Show password"}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--text-faint)] transition hover:text-[var(--text)]"
                                >
                                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Announced when it appears, and legible without
                                colour — an icon and a sentence, not a red glow. */}
                            <div aria-live="polite">
                                {err && (
                                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-[var(--danger)]">
                                        <AlertCircle size={15} className="mt-px shrink-0" />
                                        <span>{err}</span>
                                    </div>
                                )}
                            </div>

                            <Button type="submit" loading={busy} size="lg" className="mt-6 w-full">
                                {busy ? "Signing in…" : "Sign in"}
                            </Button>
                        </form>

                        <p className="mt-6 text-[12px] leading-relaxed text-[var(--text-faint)]">
                            GlobePay staff and client accounts use the same sign-in — you land on the
                            right workspace automatically.
                        </p>
                    </div>
                </div>

                <p className="text-center text-[11px] text-[var(--text-faint)] lg:text-left">
                    Base Sepolia testnet · no real funds move
                </p>
            </div>

            {/* ── panel ── */}
            <Showcase />
        </div>
    );
}
