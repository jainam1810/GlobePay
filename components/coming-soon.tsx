import { Sparkles } from "lucide-react";

export default function ComingSoon({
    title, kicker, blurb,
}: { title: string; kicker: string; blurb: string }) {
    return (
        <div className="mx-auto max-w-3xl">
            <div className="fade-up">
                <div className="kicker">{kicker}</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">{title}</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">{blurb}</p>
            </div>

            <div className="fade-up delay-1 card mt-10 p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[rgba(47,230,168,0.1)] text-[var(--accent)] mb-4">
                    <Sparkles size={20} />
                </div>
                <div className="font-display text-xl font-semibold">Coming next</div>
                <p className="text-[var(--text-dim)] text-sm mt-2 max-w-md mx-auto">
                    This screen is part of the live roadmap - wired into the same on-chain data and design system you&rsquo;re seeing now.
                </p>
            </div>
        </div>
    );
}