// Create a GlobePay login (admin or client) using the service-role key.
// Usage:
//   node scripts/create-user.mjs admin  ops@globepay.xyz  <password>
//   node scripts/create-user.mjs client billing@brightapps.co.uk <password> "BrightApps Ltd"
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// minimal .env.local parser (no dotenv dependency)
const env = Object.fromEntries(
    readFileSync(".env.local", "utf8").split(/\r?\n/)
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const [role, email, password, clientName] = process.argv.slice(2);
if (!["admin", "client"].includes(role) || !email || !password || (role === "client" && !clientName)) {
    console.error('Usage:\n  node scripts/create-user.mjs admin <email> <password>\n  node scripts/create-user.mjs client <email> <password> "<client company name>"');
    process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let clientId = null;
if (role === "client") {
    const { data, error } = await supabase.from("clients").select("id, company_name").ilike("company_name", clientName);
    if (error) { console.error("clients lookup failed:", error.message); process.exit(1); }
    if (!data?.length) { console.error(`No client named "${clientName}". Create the client first (or check spelling).`); process.exit(1); }
    if (data.length > 1) { console.error(`Multiple clients match "${clientName}" — be more specific.`); process.exit(1); }
    clientId = data[0].id;
}

const { data: created, error: userErr } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
});
if (userErr) { console.error("createUser failed:", userErr.message); process.exit(1); }

const { error: mapErr } = await supabase.from("client_users").insert({
    user_id: created.user.id,
    role: role === "admin" ? "globepay_admin" : "client",
    client_id: clientId,
});
if (mapErr) { console.error("role mapping failed:", mapErr.message); process.exit(1); }

console.log(`Created ${role} login for ${email}${clientId ? ` (client: ${clientName})` : ""}`);
