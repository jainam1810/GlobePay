# GlobePay — Project Context

> Context file for Claude Code. Read this first before making changes.

---

## What GlobePay is

A **non-custodial stablecoin payroll platform**, run as a service: client companies hand GlobePay their freelancer lists; GlobePay prepares payroll; each client confirms with **one wallet signature** and all their freelancers are paid in USDC in one transaction. GlobePay **never holds funds or private keys**.

Origin: hackathon project (long judging deadline). Also being pitched to VCs. Solo-built.

**Locked design principle:** *AI reads messy input; code generates clean/authoritative output.* Gemini reads the client's messy freelancer list (AI importer); **all money math, tax, FX, wallet validation is done in code — never by the AI.**

**Custody promise (never violate):** the app orchestrates transfers but never takes custody. USDC flows client-wallet → freelancer-wallet. The database stores *metadata about* payments, never funds or keys.

---

## The two worlds (multi-tenant, since July 2026)

```
GlobePay operator console (/admin)            Client portal (/portal)
├─ Overview: everything, by client            ├─ Home: pending payroll → ONE Confirm button
├─ Clients: CRUD + AI freelancer importer     │   (their wallet signs; guardrails check
│   └─ client detail: roster w/ checkboxes    │    wallet identity + USDC balance first)
│       "pay only these 4 this month" →       ├─ Payments: their receipts only
│       Prepare payroll → (email to client)   └─ Tax ledger: their entries only
├─ All payments (tagged by client)
└─ Tax ledger (all clients)
```

- **Auth:** Supabase Auth (email+password), cookie sessions via `@supabase/ssr`. `client_users` maps each login → `globepay_admin` (client_id null) or `client` (client_id set). Route guard in `proxy.ts` (NOTE: this Next.js renamed middleware.ts → proxy.ts); role checks in `/admin` and `/portal` layouts; every API route checks `getSessionInfo()`.
- **Isolation:** clients cannot see each other — enforced in API routes (403) AND Postgres RLS policies (see `supabase/002-clients-and-auth.sql`). Service-role key bypasses RLS (trusted server code); anon key is RLS-bound.
- **Account creation:** `node scripts/create-user.mjs admin <email> <pw>` / `client <email> <pw> "<Client Name>"`.

## Payroll lifecycle

1. Admin picks a client, **selects a subset of freelancers** (checkboxes), notes it ("July 2026") → `POST /api/payroll-runs` → run `pending_confirmation` (line_items = snapshot).
2. Client gets an **email notification** (Resend; skips gracefully without `RESEND_API_KEY`) and/or sees it on portal home.
3. Client presses Confirm → wallet flow (approve-once cap 1000, then `disperseToken`) → `PATCH /api/payroll-runs/[id] {action:"executed", txHash}`.
4. Server **rebuilds the payment from the chain** (`lib/chain.ts`): identifies the payroll by the contract's `Dispersed` event (robust to MetaMask smart-account/EIP-7702 wrapping — receipt.to is NOT reliable), payer from the event, per-recipient amounts from the USDC contract's own Transfer logs. Nothing client-supplied is stored.
5. Same PATCH writes **tax-ledger records** per line item (treatment by client HQ vs freelancer country, withholding computed in code, FX pinned at pay time, tx hash anchor). Idempotent by tx_hash.
6. Receipts appear in both worlds; `POST /api/payments/backfill` imports historical runs from the Basescan index (idempotent).

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind v4. **This Next version diverges from training data — check `node_modules/next/dist/docs/`** (middleware→proxy, async `cookies()`, params are Promises).
- wagmi + viem, plain `injected()` connector (no WalletConnect). Chain: Base Sepolia (84532). USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals).
- Supabase: DB + Auth. Server uses service-role key (`lib/supabase.ts`); sessions use anon key (`lib/supabase-server.ts` / `lib/supabase-browser.ts`).
- AI: Gemini 2.5 Flash, forced JSON (`/api/import-freelancers`; legacy `/api/extract` admin-gated).
- Email: Resend REST API (`lib/notify.ts`), no-op without key.
- FX: fawazahmed0/currency-api (jsDelivr, free). Etherscan v2 API for backfill (`ETHERSCAN_API_KEY`).
- Env: Windows / PowerShell. tsconfig target ES2020.

### Deployed artifacts
- **Disperse contract (verified, Base Sepolia):** `0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897` — ~25 lines, no owner/admin/pause, atomic batch `disperseToken`, emits `Dispersed(token, sender, count, total)`. Hardhat project in `contracts/` (normal subfolder, NOT a git submodule).
- **Funded test wallet (BrightApps' "company wallet"):** `0x7a0e76dc321B5d44BcEa20527f4B93d13bfc93e5` — needs Base Sepolia ETH (CDP faucet) + test USDC (faucet.circle.com).
- Testnet money convention: **1 test USDC sent per recipient on-chain**; real USD amounts shown in UI/ledger. 1 USDC = 1 USD at par (MVP).

## Data model (Supabase)

- `clients` — id, company_name, home_country (drives tax), wallet_address (signs payroll), contact_email, notes.
- `client_users` — user_id (auth.users) → role ('globepay_admin' | 'client') + client_id.
- `contractors` — the freelancers; + client_id. CRUD admin-only; created singly or via AI importer.
- `payroll_runs` — client_id, status (draft|pending_confirmation|executed|cancelled), line_items jsonb snapshot [{contractor_id,name,wallet,country,amount}], total_amount, note, confirmed_at, tx_hash.
- `payments` — one row per on-chain payroll tx; rebuilt from chain (tx_hash unique, paid_at, from_address, total, recipients jsonb w/ names snapshot, fee_eth) + client_id.
- `records` — the tax ledger; auto-written on execution; immutable snapshots (FX/tax frozen at pay time; changing logic does NOT update old rows — by design) + client_id, tx_hash.
- `company_profile` — RETIRED (single-tenant relic; API returns 410).

Migrations live in `supabase/*.sql` — run in dashboard SQL editor (service key can't do DDL).

## Supported countries & tax logic (`lib/tax-rules.ts`)

Nigeria (5% WHT, Nigeria Tax Act 2025), Argentina (RG 830, 5%+), Philippines (5% EWT ≤₱3M). Withholding only when client HQ country == freelancer country (`domestic`); otherwise `cross_border` → paid in full, freelancer self-reports, company books operating expense. Headline resident rates only — progressive scales/treaties = roadmap.

## Key files

```
proxy.ts                     auth route guard (Next's renamed middleware)
lib/auth.ts                  getSessionInfo/requireAdmin/requireClient
lib/chain.ts                 rebuild payment from chain (Dispersed event, USDC logs)
lib/notify.ts                Resend email (payroll-prepared)
lib/clients.ts|payments.ts|records.ts|contractor-types.ts   types
lib/import-schema.ts         Gemini schema for freelancer-list extraction
app/login, app/route         sign-in + role router (admins→/admin, clients→/portal)
app/admin/**                 operator console (overview, clients, [id] detail w/ importer
                             + subset payroll prep, payments, ledger)
app/portal/**                client portal (confirm w/ guardrails, payments, ledger)
app/api/clients|contractors|payroll-runs|payments|records|import-freelancers
components/admin-shell|portal-shell|payment-history|tax-ledger|import-freelancers
scripts/create-user.mjs      provision logins
app/contractors|invoices|records|dashboard|payments/page.tsx   redirect stubs (legacy)
app/export                   placeholder — PDF audit pack is roadmap
```

## Environment variables (.env.local)

`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_DISPERSE_ADDRESS`, `ETHERSCAN_API_KEY`, `NEXT_PUBLIC_RPC_URL` (optional), `RESEND_API_KEY` (optional — email skips without it).
`contracts/.env`: `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `BASE_SEPOLIA_RPC_URL`. Never commit `.env*`.

## UI / UX conventions

Dark "treasury terminal" theme; Clash Display / Satoshi / JetBrains Mono; mint accent `#2fe6a8`; tokens in `app/globals.css`; classes `.card .kicker .pill .nav-item .btn-primary .notice`. Tailwind `[var(--x)]` arbitrary-value style throughout (linter suggests `(--x)` — ignore, consistency wins). Friendly errors, never raw DB/chain errors. Receipts are plain-language: tx hash = "Receipt ID", Basescan demoted to "Advanced" link. Wallet addresses validated with viem `isAddress` client+server.

## Working style (important)

- Honest scoping: demo-critical slice first, label the rest roadmap.
- Options-with-recommendation before building anything non-trivial.
- Verify drift-prone facts (addresses, API tiers, library versions) via search/docs, not memory.
- Explain concepts simply before diving into code.
- After code changes run `graphify update .`.

## Current status (July 2026)

### Working end-to-end (multi-tenant)
Auth + roles + RLS → operator console (clients CRUD, AI freelancer importer, subset payroll prep, cross-client payments + ledger) → client portal (guardrailed one-signature confirm, scoped receipts + ledger) → chain-verified payments (smart-account-proof) → auto tax ledger → email notification (pending RESEND_API_KEY) → historical backfill.

### Roadmap / next
- PDF audit-pack export (per client: receipts + tax ledger) — `/export` placeholder.
- WalletConnect push so confirmation lands in the client's wallet app ("wallet-native approvals").
- Real deletion of legacy files (redirect stubs + unused components/libs kept on disk pending user approval).
- Progressive tax scales/thresholds; USDC/USD de-peg tracking.

### Known gotchas
- Supabase free tier pauses after ~1 week idle → all API routes 500 with "fetch failed"; restore from dashboard.
- MetaMask smart-account mode wraps txs — never verify by receipt.to; use the Dispersed event (already handled in lib/chain.ts).
- Old ledger rows keep old tax logic until deleted (immutable snapshots — by design).
- Verify payments on Basescan, not MetaMask Activity.
- `contracts/` must NOT become a git submodule.
- Demo logins: admin = jainamvaria1010@gmail.com; client = billing@brightapps.example (BrightApps Ltd, wallet 0x7a0e…93e5).
