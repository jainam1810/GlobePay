// Client notifications. Uses Resend's REST API (free tier) when
// RESEND_API_KEY is set in .env.local; otherwise reports why it skipped so
// the admin UI can say so honestly. Never throws — a failed email must never
// block payroll preparation.
import type { DbClient, PayrollRun } from "@/lib/clients";

export type NotifyResult = { sent: boolean; detail: string };

export async function notifyPayrollPrepared(client: DbClient, run: PayrollRun, appUrl: string): Promise<NotifyResult> {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { sent: false, detail: "email skipped — RESEND_API_KEY not set" };
    if (!client.contact_email) return { sent: false, detail: "email skipped — client has no contact email" };

    const names = run.line_items.map((li) => li.name).join(", ");
    const total = Number(run.total_amount).toLocaleString("en-US");
    const confirmUrl = `${appUrl}/portal`;

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: process.env.NOTIFY_FROM || "GlobePay <onboarding@resend.dev>",
                to: client.contact_email,
                subject: `Payroll ready for your confirmation — $${total} · ${run.line_items.length} freelancer${run.line_items.length === 1 ? "" : "s"}`,
                html: `
                    <div style="font-family:sans-serif;max-width:520px">
                        <h2 style="margin-bottom:4px">Your payroll is ready</h2>
                        <p style="color:#555">GlobePay has prepared ${run.note ? `<b>${run.note}</b>` : "a payroll run"} for ${client.company_name}.</p>
                        <table style="border-collapse:collapse;margin:16px 0">
                            <tr><td style="padding:4px 16px 4px 0;color:#888">Freelancers</td><td><b>${names}</b></td></tr>
                            <tr><td style="padding:4px 16px 4px 0;color:#888">Total</td><td><b>$${total}</b></td></tr>
                        </table>
                        <p><a href="${confirmUrl}" style="background:#2fe6a8;color:#04130d;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Review &amp; confirm</a></p>
                        <p style="color:#888;font-size:12px">One signature from your own wallet pays everyone at once. GlobePay never holds your funds.</p>
                    </div>`,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            return { sent: false, detail: `email failed — ${err.slice(0, 120)}` };
        }
        return { sent: true, detail: `email sent to ${client.contact_email}` };
    } catch (e) {
        return { sent: false, detail: `email failed — ${e instanceof Error ? e.message : "unknown error"}` };
    }
}
