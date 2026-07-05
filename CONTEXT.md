# GlobePay — Project Context (CLAUDE.md)

> Context file for Claude Code. Read this first before making changes.

---

## What GlobePay is

A **non-custodial stablecoin payroll platform** for paying international contractors.

A company pays all its global freelancers in **USDC in one transaction, one signature** — from their **own wallet**. GlobePay **never holds funds or private keys**. On top of payments, AI reads messy invoices and the system auto-builds tax + audit records.

Origin: hackathon project (long judging deadline). Also being pitched to VCs. Solo-built.

**Locked design principle:** *AI reads messy input; code generates clean/authoritative output.* The AI (Gemini) extracts invoice fields, but **all money math, tax, FX, and validation is done in code — never by the AI.**

**Custody promise (never violate):** the app orchestrates transfers but never takes custody. USDC flows caller-wallet → contractor-wallet. The database stores *metadata about* payments, never funds or keys.

---

## Tech stack

- **Framework:** Next.js (App Router) + TypeScript + Tailwind v4
- **Wallet/chain:** wagmi + viem, plain `injected()` connector (NOT RainbowKit — deliberate, no WalletConnect projectId needed)
- **Chain:** Base Sepolia (chainId **84532**)
- **USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals)
- **AI:** Gemini 2.5 Flash via server route, forced JSON output
- **DB:** Supabase (service-role key, server-only)
- **Smart contract:** Hardhat 2.26, deployed + verified on Base Sepolia
- **FX:** fawazahmed0/currency-api via jsDelivr CDN (free, no key, historical rates)
- **Env:** Windows / PowerShell. Node. `tsconfig` target bumped to **ES2020** (BigInt literals for viem).

### Deployed artifacts
- **Disperse contract (deployed + verified):** `0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897`
- **Company/deployer wallet:** `0x7a0e76dc321B5d44BcEa20527f4B93d13bfc93e5`
- Hardhat project lives in `contracts/` subfolder (own package.json/.env/.gitignore). **The whole repo is ONE git repo** — `contracts/` is a normal subfolder, NOT a submodule.

---

## The Disperse smart contract

`contracts/contracts/Disperse.sol` — ~25 lines. Batches ERC-20 payroll into one transaction.

- Function: `disperseToken(IERC20 token, address[] recipients, uint256[] amounts)`
- Pulls USDC from `msg.sender` via `transferFrom` (caller must `approve` the contract first — standard ERC-20 pattern) and forwards to each recipient in a loop.
- **No owner, no admin, no pause, no upgrade** — intentionally minimal and auditable.
- **Atomic:** if any transfer fails, the whole tx reverts. Cannot half-pay a payroll.
- Emits one `Dispersed` event; per-recipient proof is the USDC contract's own `Transfer` events (one per recipient, matchable by wallet address).

Flow in the app: one-time `approve` (USDC → Disperse, capped) → then each payroll is a single `disperseToken` call = one signature for everyone.

---

## Data model (Supabase tables)

### `contractors`
Full CRUD via UI. Source of truth for who gets paid (replaced the old hardcoded array).
Columns: `id, created_at, name, role, country, currency, wallet, monthly_amount, tax_id`

### `records`
One row per confirmed invoice. **Immutable snapshots** — all values (FX, tax) are computed and frozen at save time; the page never recalculates. Changing logic does NOT update old records (correct audit behaviour — delete + re-save to refresh).
Columns: `id, created_at, payee_name, payee_address, amount, currency, invoice_date, description, invoice_number, ai_confidence, ai_notes, tx_hash, local_amount, local_currency, fx_rate, fx_pinned_at, tax_country, withholding_rate, withheld_amount, net_amount, contractor_tax_id, tax_treatment, company_country`

### `company_profile`
Single row (id=1). The company's HQ country — drives domestic-vs-cross-border tax logic.
Columns: `id, company_name, home_country`

---

## Supported countries & tax logic

**Supported for tax:** Nigeria, Argentina, Philippines (chosen for volatile currency + high crypto adoption → real need for stablecoin payroll). India/Brazil/Singapore were considered and dropped.

### Domestic vs cross-border (critical, computed in `app/api/records/route.ts`)
Withholding tax is the **payer's** obligation and only applies when payer and payee are in the **same country**:
- **Same country** (e.g. Nigerian company → Nigerian contractor) → `tax_treatment = 'domestic'`, apply that country's withholding, show gross→WHT→net.
- **Cross-border** (e.g. UK company → Nigerian contractor) → `tax_treatment = 'cross_border'`, **no withholding**; contractor self-reports to their own authority; recorded as the company's **operating expense**. Company HQ is set via the topbar `CompanyBadge` and stored in `company_profile`.

### Tax rules config: `lib/tax-rules.ts`
Headline resident-contractor rates only (MVP). Each country has: `withholdingRate`, `withholdingLabel`, `thresholdNote`, `taxIdName`, `taxIdRegex`, `taxIdPlaceholder`, `classificationSignals[]`, `source`, `effectiveFrom`.
- Nigeria: 5% WHT (Nigeria Tax Act 2025), TIN `NNNNNNNN-NNNN` or 10-digit
- Argentina: 5%+ (RG 830 scale 5–31%), CUIT `XX-XXXXXXXX-X`, monotributistas exempt
- Philippines: 5% EWT (≤₱3M), TIN `XXX-XXX-XXX`
Functions: `getTaxRule(country)`, `computeWithholding(amount, country)` (math in CODE), `validateTaxId(id, country)`.
Full progressive scales / thresholds / registration logic = **roadmap**, not built. Research report has all details.

---

## Key files / structure

```
app/
  page.tsx                  Payroll — reads contractors from DB, approve-once then batch disperse (1 tx)
  invoices/page.tsx         Drag-drop invoice → AI extract → human-confirm form → save record
  records/page.tsx          Audit trail — tiered layout, domestic/cross-border tax panel, search
  contractors/page.tsx      Full CRUD roster + modal form (wallet + tax-id validation)
  dashboard/page.tsx        (check state)
  export/page.tsx           Placeholder — PDF audit-pack NOT built yet
  api/
    extract/route.ts        Gemini invoice OCR (forced JSON)
    records/route.ts        POST computes FX pin + domestic/cross-border tax; GET lists
    contractors/route.ts    GET list / POST create (isAddress wallet validation server-side)
    contractors/[id]/route.ts  PATCH edit / DELETE
    company/route.ts        GET / PATCH company HQ country
components/
  app-shell.tsx             Sidebar nav + topbar (CompanyBadge, Base Sepolia pill, ConnectButton), WalletCard
  company-badge.tsx         HQ country selector (drives domestic/cross-border)
  connect-button.tsx, wallet-card.tsx, providers.tsx
lib/
  tax-rules.ts              Tax config + computeWithholding + validateTaxId (3 countries)
  contractor-types.ts       DbContractor type, SUPPORTED_COUNTRIES, COMPANY_COUNTRIES, flagFor, avatarFor, truncate, formatUSD
  fx.ts                     getFxRate (fawazahmed0 CDN, historical + latest)
  match.ts                  findContractorByName — matches invoice payee → DB contractor (async, DB-backed)
  company.ts                getCompanyCountry
  records.ts                SavedRecord type
  supabase.ts               lazy server-side client (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
  usdc.ts                   USDC address + abi
  disperse.ts               DISPERSE_ADDRESS + abi
  invoice-schema.ts         Gemini structured-output schema + ExtractedInvoice type
  mock-data.ts              ORPHANED — no longer imported, DB is source of truth. Safe to delete.
contracts/                  Hardhat project (Disperse.sol, hardhat.config.ts, deploy script)
```

---

## Environment variables

Root `.env.local` (Next.js): `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_DISPERSE_ADDRESS`
`contracts/.env` (Hardhat, gitignored): `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `BASE_SEPOLIA_RPC_URL`

Never commit `.env*` or `node_modules`. `SUPABASE_SERVICE_ROLE_KEY` is server-only (no `NEXT_PUBLIC_`).

---

## UI / UX conventions

- Dark "treasury terminal" theme. Fonts: Clash Display (display), Satoshi (body), JetBrains Mono (mono). Mint accent `--accent: #2fe6a8`.
- Design tokens in `app/globals.css` (`@theme`). Reusable classes: `.card .kicker .pill .nav-item .btn-primary .notice .badge-testnet`, `fadeUp` animations.
- Errors surface as friendly messages (banners/toasts), never raw DB/Postgres errors.
- Wallet addresses: validate with viem `isAddress()` (checksum/EIP-55 catches typos) at input time. Client-side for live UX feedback + server-side in API routes for enforcement. Cannot catch valid-but-wrong addresses → rely on human confirm at signing.
- Money: USDC amounts sent as whole test units on Base Sepolia (`PER_PERSON = "1"`). Real amounts shown as USD. **1 USDC = 1 USD at par** (MVP assumption; ~5bps real de-peg is a roadmap/footnote item).
- Records: tiered layout — header (name+gross), AI-note row, tinted footer with tax/FX. Domestic → labelled grid (Gross/WHT/Net/local); cross-border → "paid in full / operating expense / self-reports" panel.

---

## Working style / conventions (important)

- **Honest scoping.** Build the demo-critical slice; label the rest "roadmap." Don't build enterprise tax-engine complexity (progressive scales, treaty edge-cases) — headline rates only.
- **Targeted "replace X with Y" edits**, one step at a time, brief summary after changes.
- **Options-with-recommendation before building** anything non-trivial.
- **Verify drift-prone facts** (contract addresses, token prices, API tiers, library versions) via search/docs rather than memory.
- **Check DB CHECK constraints / valid enum values before coding status fields.**
- Explain concepts simply, with examples, before diving into code.

---

## Current status

### Working end-to-end
Scaffold → design system → wallet connect + live USDC transfer → **batch payroll via deployed Disperse contract (1 tx, 1 sig)** → AI invoice extraction (Gemini) with human-confirm → Supabase persistence + searchable Records → FX pinning → tax module (domestic vs cross-border, 3 countries, tax-id validation) → full contractor CRUD (DB-backed; payroll + matching read from DB) → Records page polished (tiered layout).

### In progress / next
- **Reconciliation (NEXT, user-requested):** connect the invoice-record world to the payment world. When payroll runs, write a payment record (tx hash, timestamp, recipients) to Supabase; link each record to its matching on-chain payment by wallet address, so each record shows: invoice → payment → timestamp → tx-hash proof → PAID status. Chosen approach = **Option B** (store payment on payroll success, tx hash as on-chain anchor). This answers "prove contractor X was actually paid."
- The "AI genuine reasoning" feature.
- **PDF audit-pack export:** `/export` is still a placeholder. Deterministic PDF from record data (+ Basescan QR), reuse for audit-pack.
- **Dashboard:** verify/build out.

### Known gotchas
- Old records keep old tax treatment until deleted + re-saved (immutable snapshots — by design).
- Wallet needs Base Sepolia ETH for gas — top up from CDP faucet before demos.
- MetaMask hides untracked tokens & only logs self-sent activity — verify payments on Basescan, not MetaMask Activity. This is why reconciliation reads chain/tx data, not wallet UI.
- `contracts/` must NOT become a git submodule (no nested `.git`).