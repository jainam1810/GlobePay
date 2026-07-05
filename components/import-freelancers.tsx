"use client";
// AI onboarding importer: paste the client's messy freelancer list (or attach
// a file), review what the AI read — every row re-validated in code — then
// add the good rows to the roster in one click.
import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2, Paperclip, X } from "lucide-react";
import type { ValidatedRow } from "@/app/api/import-freelancers/route";
import { flagFor, truncate, formatUSD } from "@/lib/contractor-types";

export default function ImportFreelancers({ clientId, onImported }: { clientId: string; onImported: () => void }) {
    const [text, setText] = useState("");
    const [file, setFile] = useState<{ name: string; dataUrl: string; mimeType: string } | null>(null);
    const [rows, setRows] = useState<ValidatedRow[] | null>(null);
    const [aiNotes, setAiNotes] = useState("");
    const [busy, setBusy] = useState<"extract" | "save" | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    async function pickFile(f: File) {
        const dataUrl = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = rej;
            r.readAsDataURL(f);
        });
        setFile({ name: f.name, dataUrl, mimeType: f.type || "text/plain" });
    }

    async function extract() {
        setBusy("extract"); setErr(null); setRows(null); setSaved(null);
        try {
            const r = await fetch("/api/import-freelancers", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, dataUrl: file?.dataUrl, mimeType: file?.mimeType }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j?.error || "Extraction failed");
            setRows(j.rows || []);
            setAiNotes(j.notes || "");
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Extraction failed");
        } finally { setBusy(null); }
    }

    async function saveValid() {
        if (!rows) return;
        setBusy("save"); setErr(null);
        const valid = rows.filter((r) => r.valid);
        let added = 0;
        const failures: string[] = [];
        for (const row of valid) {
            try {
                const r = await fetch("/api/contractors", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        client_id: clientId, name: row.name, role: row.role || null, country: row.country,
                        wallet: row.wallet, monthly_amount: row.monthly_amount, tax_id: row.tax_id || null,
                    }),
                });
                if (r.ok) added++;
                else failures.push(`${row.name}: ${(await r.json())?.error ?? r.status}`);
            } catch { failures.push(row.name); }
        }
        setBusy(null);
        setSaved(`Added ${added} freelancer${added === 1 ? "" : "s"}.` + (failures.length ? ` Failed: ${failures.join("; ")}` : ""));
        if (added > 0) { setRows(null); setText(""); setFile(null); onImported(); }
    }

    const input = "w-full px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition";
    const validCount = rows?.filter((r) => r.valid).length ?? 0;

    return (
        <div className="px-5 md:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]/30">
            <div className="flex items-start gap-2 text-xs text-[var(--text-dim)] mb-3 leading-relaxed">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                Paste the client&rsquo;s freelancer list exactly as they sent it — email, spreadsheet rows, anything. The AI reads it; every wallet and amount is then re-validated in code before it touches the roster.
            </div>
            <textarea rows={5} className={`${input} font-mono text-xs`} placeholder={"e.g.\nAkil - financial modelling, Argentina, pays $100/mo, wallet 0x59B2...\nChidi Okatar | NG | dev | 0x7a0e... | 230 USD"}
                value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex items-center gap-3 mt-3 flex-wrap">
                <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer transition">
                    <Paperclip size={13} /> {file ? file.name : "Attach file (CSV, PDF, image)"}
                    <input type="file" className="hidden" accept=".csv,.txt,.pdf,image/*" onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
                </label>
                {file && <button onClick={() => setFile(null)} className="text-[var(--text-faint)] hover:text-[#ff6b6b]"><X size={13} /></button>}
                <div className="flex-1" />
                <button onClick={extract} disabled={busy !== null || (!text.trim() && !file)} className="btn-primary text-sm disabled:opacity-50">
                    {busy === "extract" ? <><Loader2 size={14} className="animate-spin" /> Reading…</> : <><Sparkles size={14} /> Extract with AI</>}
                </button>
            </div>

            {err && <div className="mt-3 text-xs text-[#ff6b6b] bg-[rgba(255,107,107,0.08)] border border-[rgba(255,107,107,0.25)] rounded-lg px-3 py-2 flex items-center gap-2"><AlertCircle size={13} /> {err}</div>}
            {saved && <div className="mt-3 text-xs text-[var(--text-dim)] bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-lg px-3 py-2">{saved}</div>}

            {rows && (
                <div className="mt-4">
                    {aiNotes && (
                        <div className="mb-3 flex items-start gap-2 text-xs text-[#f5b14c] bg-[rgba(245,177,76,0.06)] border border-[rgba(245,177,76,0.18)] rounded-lg px-3 py-2">
                            <AlertCircle size={13} className="mt-0.5 shrink-0" /> <span>AI notes: {aiNotes}</span>
                        </div>
                    )}
                    <div className="rounded-lg border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
                        {rows.map((r, i) => (
                            <div key={i} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${r.valid ? "" : "opacity-70"}`}>
                                {r.valid
                                    ? <CheckCircle2 size={14} className="text-[var(--accent)] shrink-0" />
                                    : <AlertCircle size={14} className="text-[#ff6b6b] shrink-0" />}
                                <div className="min-w-0 flex-1">
                                    <span className="font-medium">{r.name || "?"}</span>
                                    <span className="ml-2 text-xs text-[var(--text-dim)]">{flagFor(r.country)} {r.country || "?"}{r.role ? ` · ${r.role}` : ""}</span>
                                    {!r.valid && <div className="text-[11px] text-[#ff6b6b] mt-0.5">{r.problems.join(" · ")}</div>}
                                    {r.notes && <div className="text-[11px] text-[#f5b14c] mt-0.5">{r.notes}</div>}
                                </div>
                                <span className="font-mono text-[10px] text-[var(--text-faint)] hidden md:inline">{r.wallet ? truncate(r.wallet) : "no wallet"}</span>
                                <span className="font-mono text-sm font-semibold w-20 text-right">{r.monthly_amount > 0 ? formatUSD(r.monthly_amount) : "—"}</span>
                            </div>
                        ))}
                        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm text-[var(--text-dim)]">The AI found no freelancers in that input.</div>}
                    </div>
                    {rows.length > 0 && (
                        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                            <div className="text-xs text-[var(--text-dim)]">
                                <span className="font-mono font-semibold text-[var(--text)]">{validCount}</span> of {rows.length} rows valid
                                {validCount < rows.length && " — fix the flagged ones by hand after import, or correct the source and re-extract"}
                            </div>
                            <button onClick={saveValid} disabled={busy !== null || validCount === 0} className="btn-primary text-sm disabled:opacity-50">
                                {busy === "save" ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : `Add ${validCount} to roster`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
