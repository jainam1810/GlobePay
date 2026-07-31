"use client";
import AuditPack from "@/components/audit-pack";

export default function AdminAuditPackPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="fade-up mb-6 no-print">
                <div className="kicker">Tax &amp; audit</div>
                <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mt-2">Audit pack</h1>
                <p className="text-[var(--text-dim)] mt-2 max-w-lg">
                    Generate an audit-ready pack for any client — every payment grouped by country, with the FX rate and
                    tax treatment frozen at pay time and on-chain proof for each line.
                </p>
            </div>
            <AuditPack />
        </div>
    );
}
