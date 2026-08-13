import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { isAddress } from "viem";
import { getTaxRule } from "@/lib/tax-rules";
import { getSessionInfo } from "@/lib/auth";
import type { ContractorInput } from "@/lib/contractor-types";

function validate(body: ContractorInput): string | null {
    if (!body.name?.trim()) return "Name is required";
    if (!body.country?.trim()) return "Country is required";
    if (!isAddress(body.wallet ?? "")) return "Wallet address is not a valid Ethereum address";
    // Optional: a freelancer can exist without a default amount (0 = not set).
    // The real figure is chosen per payroll run, so only reject nonsense here.
    if (body.monthly_amount != null && (typeof body.monthly_amount !== "number" || body.monthly_amount < 0))
        return "Default monthly amount must be a positive number";
    const rule = getTaxRule(body.country);
    if (rule && body.tax_id && !rule.taxIdRegex.test(String(body.tax_id).trim()))
        return `Tax ID doesn't match ${body.country} ${rule.taxIdName} format (e.g. ${rule.taxIdPlaceholder})`;
    return null;
}

// Editing the roster is a GlobePay-admin job, same rule as POST /api/contractors.
// This matters more than it looks: `wallet` is where payroll money lands, so an
// unauthenticated PATCH here would be a payroll-redirect hole.
async function requireRosterAdmin() {
    const s = await getSessionInfo();
    if (!s) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
    if (s.role !== "globepay_admin") return { error: NextResponse.json({ error: "GlobePay admin only" }, { status: 403 }) };
    return { error: null };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { error: authError } = await requireRosterAdmin();
        if (authError) return authError;

        const { id } = await params;
        const body = (await req.json()) as ContractorInput;
        const err = validate(body);
        if (err) return NextResponse.json({ error: err }, { status: 400 });

        const rule = getTaxRule(body.country!);
        const row = {
            name: body.name!.trim(),
            role: body.role?.trim() || null,
            country: body.country!.trim(),
            currency: rule?.currencyLocal ?? (body.currency || "USD"),
            wallet: body.wallet!.trim(),
            monthly_amount: body.monthly_amount ?? 0,
            tax_id: body.tax_id?.trim() || null,
        };
        const { data, error } = await getSupabase().from("contractors").update(row).eq("id", id).select().single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ contractor: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { error: authError } = await requireRosterAdmin();
        if (authError) return authError;

        const { id } = await params;
        const supabase = getSupabase();

        // Reopen anything this freelancer was accepted for but never paid.
        //
        // The invoice row survives the delete — contractor_id is set null — but
        // it stays 'accepted', which leaves it pointing at nobody, unpayable,
        // and still counting as a duplicate. The client would re-send the same
        // invoice and be told it had already been accepted, with no way through.
        // Runs already paid are left alone: that happened, and the record of it
        // should not be rewritten because somebody left the roster.
        const { error: reopenErr } = await supabase
            .from("invoice_submissions")
            .update({
                status: "pending",
                contractor_id: null,
                review_note: "Reopened — the freelancer this was accepted for was removed from the roster.",
                reviewed_at: null,
            })
            .eq("contractor_id", id)
            .eq("status", "accepted")
            .is("payroll_run_id", null);
        if (reopenErr) console.error("[contractors] reopening invoices:", reopenErr.message);

        const { error } = await supabase.from("contractors").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
