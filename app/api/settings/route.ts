// A client editing their own company record.
//
// Separate from /api/clients on purpose. That route is the operator's — it can
// address any client by id, so it is admin-only. This one takes no id at all:
// the row it touches comes from the session, which means there is no parameter
// a client could change to reach somebody else's company.
//
// Email address and password are not here. Those live in Supabase Auth and are
// changed through it directly from the browser, so that a password never travels
// through our own code on its way to being set.
import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getSupabase } from "@/lib/supabase";
import { getSessionInfo } from "@/lib/auth";
import { COMPANY_COUNTRIES } from "@/lib/contractor-types";

const FIELDS = "id, company_name, home_country, contact_email, wallet_address";

export async function GET() {
    try {
        const s = await getSessionInfo();
        if (!s?.clientId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const { data, error } = await getSupabase()
            .from("clients").select(FIELDS).eq("id", s.clientId).single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ client: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const s = await getSessionInfo();
        if (!s?.clientId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

        const body = await req.json();
        const patch: Record<string, string | null> = {};

        if ("company_name" in body) {
            const name = String(body.company_name ?? "").trim();
            if (!name) return NextResponse.json({ error: "Company name can't be empty" }, { status: 400 });
            patch.company_name = name;
        }

        if ("home_country" in body) {
            if (!COMPANY_COUNTRIES.includes(body.home_country)) {
                return NextResponse.json({ error: "Pick a valid HQ country" }, { status: 400 });
            }
            patch.home_country = body.home_country;
        }

        if ("contact_email" in body) {
            const email = String(body.contact_email ?? "").trim();
            // Deliberately loose. This is where payroll notifications go, not a
            // credential — rejecting an unusual but valid address helps nobody,
            // and the only real test is whether the mail arrives.
            if (email && !/^\S+@\S+\.\S+$/.test(email)) {
                return NextResponse.json({ error: "That doesn't look like an email address" }, { status: 400 });
            }
            patch.contact_email = email || null;
        }

        if ("wallet_address" in body) {
            const w = String(body.wallet_address ?? "").trim();
            // isAddress checks the EIP-55 checksum, so a mistyped character is
            // caught here rather than becoming a payroll nobody can approve.
            if (w && !isAddress(w)) {
                return NextResponse.json({ error: "That is not a valid wallet address" }, { status: 400 });
            }
            patch.wallet_address = w || null;
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
        }

        const { data, error } = await getSupabase()
            .from("clients").update(patch).eq("id", s.clientId).select(FIELDS).single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ client: data });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
