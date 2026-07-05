"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
        <div className="min-h-screen grid place-items-center px-6">
            <div className="w-full max-w-sm">
                <div className="flex items-center gap-2.5 justify-center mb-8 fade-up">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-[#04130d] font-display font-bold text-xl shadow-[0_0_24px_var(--accent-glow)]">G</div>
                    <span className="font-display text-2xl font-semibold tracking-tight">GlobePay</span>
                </div>
                <form onSubmit={submit} className="card p-6 fade-up delay-1">
                    <div className="kicker mb-4">Sign in</div>
                    <label className="block text-xs text-[var(--text-dim)] mb-1.5">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition mb-4"
                        placeholder="you@company.com" autoComplete="email" />
                    <label className="block text-xs text-[var(--text-dim)] mb-1.5">Password</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition"
                        placeholder="••••••••" autoComplete="current-password" />
                    {err && <div className="mt-4 text-xs text-[#ff6b6b] bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.25)] rounded-lg px-3 py-2">{err}</div>}
                    <button type="submit" disabled={busy} className="btn-primary w-full justify-center mt-5 disabled:opacity-50">
                        {busy ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <><LogIn size={16} /> Sign in</>}
                    </button>
                </form>
                <p className="text-center text-[11px] text-[var(--text-faint)] mt-4 fade-up delay-2">
                    GlobePay staff and client accounts use the same sign-in.
                </p>
            </div>
        </div>
    );
}
