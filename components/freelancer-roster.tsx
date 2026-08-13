"use client";
// The client's own roster, read-only.
//
// Read-only because who is on the roster is decided by the invoices GlobePay
// accepts, not by editing a list — so an editable copy here would be a second
// source of truth for the same thing.
//
// What it is for is the column on the right: getting a verification link and
// sending it on. The client is the one with a relationship to the freelancer,
// so they are the one who can ask them to prove a wallet.
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { DbContractor } from "@/lib/contractor-types";
import { truncate } from "@/lib/contractor-types";
import VerifyWalletCell, { VerifiedTick } from "@/components/verify-wallet-cell";
import { SkeletonRows, Empty } from "@/components/ui/kit";
import Flag from "@/components/flag";

export default function FreelancerRoster() {
    const [rows, setRows] = useState<DbContractor[] | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let live = true;
        (async () => {
            try {
                const r = await fetch("/api/contractors");
                const j = await r.json();
                if (live) setRows(r.ok ? (j.contractors ?? []) : []);
            } catch { if (live) setRows([]); }
        })();
        return () => { live = false; };
    }, []);

    if (rows === null) return <SkeletonRows rows={4} cols={4} />;

    if (!rows.length) {
        return (
            <Empty
                icon={Users}
                title="No freelancers yet"
                body="Anyone GlobePay accepts an invoice for appears here, ready to be paid in your next run."
            />
        );
    }

    return (
        <div className="space-y-3">
            {err && <p className="text-[12px] text-[var(--danger)]">{err}</p>}

            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {rows.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="truncate text-[14px] font-medium">{c.name}</span>
                                <VerifiedTick contractor={c} />
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[var(--text-faint)]">
                                {c.role && <span>{c.role}</span>}
                                <span className="inline-flex items-center gap-1.5">
                                    <Flag country={c.country} size={12} label={false} /> {c.country}
                                </span>
                                <span className="font-mono">{truncate(c.wallet)}</span>
                            </div>
                        </div>
                        <VerifyWalletCell contractor={c} onError={setErr} />
                    </li>
                ))}
            </ul>

            <p className="text-[12px] leading-relaxed text-[var(--text-faint)]">
                A tick means the freelancer signed a message with that wallet, so it is provably theirs —
                the same job your bank does when it checks a name against an account number. Getting a link
                copies it; send it to them however you normally talk. Signing costs them nothing and moves
                no money.
            </p>
        </div>
    );
}
