import { NextResponse } from "next/server";

// Retired: company_profile was the single-tenant HQ setting. Each client now
// carries its own home_country on the clients table (see /api/clients).
export async function GET() {
    return NextResponse.json({ error: "Retired — company HQ now lives per client on the clients table" }, { status: 410 });
}

export async function PATCH() {
    return NextResponse.json({ error: "Retired — company HQ now lives per client on the clients table" }, { status: 410 });
}
