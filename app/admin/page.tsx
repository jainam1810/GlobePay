// Operator overview: everything, structured by client.
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { flagFor } from "@/lib/contractor-types";
import type { DbClient } from "@/lib/clients";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
    const supabase = getSupabase();
    const [{ data: clients }, { data: contractors }, { data: payments }, { data: runs }] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: true }),
        supabase.from("contractors").select("id, client_id"),
        supabase.from("payments").select("client_id, total_amount, recipient_count"),
        supabase.from("payroll_runs").select("client_id, status"),
    ]);

    const totalPaid = (payments || []).reduce((s, p) => s + Number(p.total_amount), 0);
    const pendingRuns = (runs || []).filter((r) => r.status === "pending_confirmation").length;

    const perClient = (clients as DbClient[] || []).map((c) => ({
        client: c,
        freelancers: (contractors || []).filter((x) => x.client_id === c.id).length,
        payrolls: (payments || []).filter((x) => x.client_id === c.id).length,
        paid: (payments || []).filter((x) => x.client_id === c.id).reduce((s, p) => s + Number(p.total_amount), 0),
        pending: (runs || []).filter((x) => x.client_id === c.id && x.status === "pending_confirmation").length,
    }));

    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up">
                <div className="kicker">Operator console</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Everything, by client</h1>
            </div>

            <div className="fade-up delay-1 grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <Stat label="Clients" value={String(perClient.length)} />
                <Stat label="Freelancers" value={String((contractors || []).length)} />
                <Stat label="USDC dispersed" value={totalPaid.toLocaleString("en-US")} />
                <Stat label="Awaiting confirmation" value={String(pendingRuns)} accent={pendingRuns > 0} />
            </div>

            <div className="fade-up delay-2 card mt-8 overflow-hidden">
                <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-[var(--border)]">
                    <h2 className="font-display text-lg font-semibold">Clients</h2>
                    <Link href="/admin/clients" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Manage →</Link>
                </div>
                <div className="divide-y divide-[var(--border)]">
                    {perClient.map(({ client, freelancers, payrolls, paid, pending }) => (
                        <Link key={client.id} href={`/admin/clients/${client.id}`}
                            className="flex items-center gap-4 px-5 md:px-6 py-4 hover:bg-[var(--surface-2)] transition-colors">
                            <span className="text-xl">{flagFor(client.home_country)}</span>
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{client.company_name}</div>
                                <div className="text-xs text-[var(--text-dim)]">{client.home_country}</div>
                            </div>
                            {pending > 0 && (
                                <span className="text-[9px] font-mono uppercase tracking-wider text-[#f5b14c] bg-[rgba(245,177,76,0.07)] border border-[rgba(245,177,76,0.22)] rounded px-1.5 py-0.5">
                                    {pending} awaiting confirm
                                </span>
                            )}
                            <div className="hidden sm:block text-right w-24">
                                <div className="font-mono text-sm">{freelancers}</div>
                                <div className="text-[10px] text-[var(--text-faint)] uppercase">freelancers</div>
                            </div>
                            <div className="hidden sm:block text-right w-24">
                                <div className="font-mono text-sm">{payrolls}</div>
                                <div className="text-[10px] text-[var(--text-faint)] uppercase">payrolls</div>
                            </div>
                            <div className="text-right w-28">
                                <div className="font-mono text-sm font-semibold">{paid.toLocaleString("en-US")}</div>
                                <div className="text-[10px] text-[var(--text-faint)] uppercase">USDC paid</div>
                            </div>
                        </Link>
                    ))}
                    {perClient.length === 0 && (
                        <div className="p-8 text-center text-sm text-[var(--text-dim)]">
                            No clients yet. <Link href="/admin/clients" className="underline underline-offset-2">Add your first client →</Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="card p-5">
            <div className="text-[var(--text-dim)] text-xs uppercase tracking-wide">{label}</div>
            <div className={`font-mono text-2xl font-semibold mt-2 ${accent ? "text-[#f5b14c]" : ""}`}>{value}</div>
        </div>
    );
}
