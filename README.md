<div align="center">

# GlobePay

**Pay your whole global team in one transaction, from your own wallet.**

Non-custodial stablecoin payroll for international freelancers.
AI reads the messy invoices; code does every calculation.

### [→ Try the live app](https://globe-pay-five.vercel.app/)

[![Live](https://img.shields.io/badge/demo-live-2fe6a8)](https://globe-pay-five.vercel.app/)
[![Chain](https://img.shields.io/badge/Base_Sepolia-84532-0052FF)](https://sepolia.basescan.org)
[![Contract](https://img.shields.io/badge/Disperse-verified-2fe6a8)](https://sepolia.basescan.org/address/0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897)
![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black)
![Status](https://img.shields.io/badge/status-testnet-orange)

</div>

---

## Contents

- [What GlobePay is](#what-globepay-is)
- [The problem](#the-problem)
- [How it works](#how-it-works)
- [The smart contract](#the-smart-contract)
- [Wallet verification](#wallet-verification--the-anti-fraud-layer)
- [The invoice pipeline](#the-invoice-pipeline)
- [Where AI is used, and where it is not](#where-ai-is-used-and-where-it-is-not)
- [Security](#security)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [Route map](#route-map)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Testing the full flow](#testing-the-full-flow)
- [What GlobePay deliberately does not do](#what-globepay-deliberately-does-not-do)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## What GlobePay is

A company owes 30 freelancers across 8 countries. Today that is 30 bank
transfers, each taking 3–5 days, each losing money to intermediary banks and FX
spreads, each reconciled by hand afterwards.

GlobePay makes it **one transaction, one signature, settled in minutes** — paid
in USDC straight from the company's own wallet to each freelancer's wallet.

**GlobePay never holds funds and never holds keys.** The money never passes
through an account we control. The database stores information *about* payments;
it never stores value. That is a structural property of the design, not a policy
we promise to keep.

On top of the payment, AI reads the invoices as they arrive and the audit record
writes itself.

---

## The problem

| | Bank transfers today | GlobePay |
|---|---|---|
| **Transactions** | one per freelancer | one, for everyone |
| **Signatures** | one per freelancer | one, for everyone |
| **Settlement** | 3–5 business days | minutes |
| **Cost** | FX spread + intermediary fees, per payment | one network fee, typically a fraction of a penny on Base |
| **Reconciliation** | manual, after the fact | written automatically, with on-chain proof |
| **Failure mode** | some land, some bounce, silently | atomic — everyone is paid, or nobody is |
| **Proof** | your bank's word | a public transaction anyone can verify |

For freelancers in countries with volatile currencies, the second-order effect
matters more than the fee: they are paid **on time, in dollars they can hold.**

---

## How it works

Three actors. Keeping them distinct is the whole mental model.

| Actor | Who | What they do |
|---|---|---|
| **Client** | the company paying | uploads invoices, approves payroll, signs with their own wallet |
| **GlobePay** | the operator console | reads and checks invoices, prepares the run |
| **Freelancer** | the person being paid | sends an invoice, proves their wallet is theirs, receives USDC |

```
 CLIENT                    GLOBEPAY                      CHAIN
   │                          │                            │
   │  1. drop in a month      │                            │
   │     of invoices ────────►│                            │
   │                          │ 2. AI reads each one       │
   │                          │    matched against roster  │
   │                          │    ├ on roster             │
   │                          │    ├ new freelancer        │
   │                          │    ├ wallet conflict ⛔    │
   │                          │    └ duplicate       ⛔    │
   │                          │                            │
   │                          │ 3. reviewer accepts        │
   │                          │    (silent — nothing sent) │
   │                          │                            │
   │  4. "payroll ready" ◄────│    prepare run (emails)    │
   │                          │                            │
   │  5. pre-flight ─────────────────────────────────────► │  balance?
   │     BEFORE any signature                              │  allowance?
   │     ◄─────────────────────────────────────────────────│  can each
   │        "Chidinma's wallet can't receive — pay the      │  wallet
   │         other 29?"                                    │  receive?
   │                                                       │
   │  6. ONE signature ──────────────────────────────────► │ disperseToken
   │                                                       │   ├─► freelancer 1
   │                                                       │   ├─► freelancer 2
   │                                                       │   └─► …  (atomic)
   │                          │                            │
   │                          │ 7. rebuild the record ◄────│  Dispersed event
   │  ◄─── receipts, audit pack, Basescan links ───────────│  + USDC Transfers
```

### Step 5 is the one worth pausing on

Before a signature is requested, the whole run is checked against the chain —
balance, allowance, and whether **every recipient wallet can actually receive**.

USDC is not a plain ERC-20. It is Circle's FiatToken, which keeps a blacklist,
and a blacklisted address can neither send nor receive. A transfer to one
reverts and takes the entire batch with it. `isBlacklisted` is a public view
function, so instead of bisecting a hundred simulations, [lib/preflight.ts](lib/preflight.ts)
simply reads it for everybody — balance, allowance and one blacklist read per
recipient, in a **single RPC round trip** via Multicall3, for no gas and no
signature.

The client is told exactly *who* is a problem, **before** a transaction fee is
spent, and can pay everyone else in one click.

### Step 7 trusts the chain, not the browser

When a run executes, the server does not store what the client's browser told
it. It **rebuilds the payment from the chain** — [lib/chain.ts](lib/chain.ts)
identifies the payroll by the `Dispersed` event the contract emits, reads the
payer from that event, and takes per-recipient amounts from the USDC contract's
own `Transfer` logs.

Deliberately *not* by `receipt.to`:

> smart-account wallets (EIP-7702/4337) wrap the call, so the outer
> transaction's target isn't the Disperse contract

Writes are idempotent by `tx_hash`, so a retry can never double-record.

---

## The smart contract

[`contracts/contracts/Disperse.sol`](contracts/contracts/Disperse.sol) — about
25 lines, deployed and verified on Base Sepolia at
[`0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897`](https://sepolia.basescan.org/address/0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897).

```solidity
function disperseToken(
    IERC20 token,
    address[] calldata recipients,
    uint256[] calldata amounts
) external {
    if (recipients.length != amounts.length) revert LengthMismatch();

    uint256 total;
    for (uint256 i = 0; i < recipients.length; i++) {
        uint256 amount = amounts[i];
        total += amount;
        bool ok = token.transferFrom(msg.sender, recipients[i], amount);
        if (!ok) revert TransferFailed(recipients[i], amount);
    }

    emit Dispersed(address(token), msg.sender, recipients.length, total);
}
```

What matters is what is **absent**:

- **No owner. No admin. No pause. No upgrade path.** There is no privileged key
  that could ever be turned against a customer, because there is no privileged
  key at all.
- **It never holds funds.** Tokens are pulled from `msg.sender` via
  `transferFrom` and forwarded in the same call. The contract's balance is
  always zero.
- **The caller stays in control.** The only standing permission is the ERC-20
  approval, which the client can revoke at any time without asking anyone.
- **Atomic.** If one transfer fails, the whole transaction reverts. A payroll
  can never half-pay.

Flow: a one-time `approve` (USDC → Disperse, capped), then each payroll is a
single `disperseToken` call — one signature for the whole team.

---

## Wallet verification — the anti-fraud layer

A valid wallet address only means it is *well-formed*. EIP-55 checksums catch
typos. What no checksum catches is an address that is **valid but belongs to
somebody else** — the crypto equivalent of a correct-looking sort code and
account number for the wrong person.

UK banking answers this with Confirmation of Payee. GlobePay does the same
thing, cryptographically:

1. **The client** sends the freelancer a link. (The client, not GlobePay — they
   are the ones with a channel the freelancer already trusts. GlobePay has no
   relationship with the freelancer and no address to send anything to.)
2. The freelancer opens it and **signs a sentence with their own wallet**:

   ```
   GlobePay — confirm your payout wallet

   I am Akil Shaikh.
   I confirm this wallet is mine and authorise BrightApps Ltd to pay me
   at it through GlobePay.

   Wallet: 0xaFBbd…
   Issued: 2026-08-28T09:14:00Z

   Signing costs nothing and moves no funds.
   ```
3. A **green tick** appears beside their name, in both the client and admin UIs.

The sentence names all three parties and pins the address, so a signature
captured in one context cannot be replayed to vouch for a different wallet or a
different company. Links expire after **72 hours**.

Verification uses viem's `verifyMessage` rather than a bare `ecrecover`, so it
handles plain wallets, **deployed smart accounts (ERC-1271)** and
**not-yet-deployed ones (ERC-6492)** — a freelancer paid into a Safe would fail
a naive check.

**Clicking the tick opens the proof**: the exact sentence signed, the signature,
the timestamp, and a Basescan link — and the signature is **re-checked live** as
the dialog opens, so the answer is "it checks out now" rather than "our records
say so."

Two things stated honestly in the UI, because both are true:

- Signing **costs nothing and moves no funds**.
- The signature is **not on the blockchain** — it is not a transaction. That is
  precisely why it is free and instant. It is proved mathematically instead:
  anyone can recover the signer's address from the message and signature,
  without involving GlobePay at all.

---

## The invoice pipeline

The problem it solves: a client with 100 invoices a month cannot send them one
at a time through a message thread.

**Client side** — drag in the whole month at once, PDFs or photos, however the
freelancers sent them. Each is read on arrival and lands with a visible status,
because an invoice that vanished into somebody's inbox is an invoice they will
send again next week. Uploads run sequentially on purpose: firing forty parallel
Gemini calls hits the rate limit and fails most of them.

**Operator side** — every client's invoices in one table, already read, with the
invoice **openable in place** beside the extracted fields for zoom-and-compare.
The wallet address is the field worth checking, so checking it is made easy.

Each row carries one of four verdicts from
[`matchInvoice()`](lib/invoice-submissions.ts) — not two, because the two that
matter are the ones a naive name-or-wallet check gets wrong:

| Verdict | Meaning |
|---|---|
| **On roster** | the wallet matches someone already there |
| **New freelancer** | nobody we know — adding them is one click |
| **Wallet conflict** ⛔ | **blocked.** The name is on the roster with a *different* wallet. That is what invoice fraud looks like: a real invoice with the payee's address swapped out. |
| **Duplicate** ⛔ | **blocked.** The same invoice number from the same wallet was already accepted. There is no reversal on a blockchain, so paying twice is permanent. |

Neither blocked verdict can be cleared in bulk.

**Anything a reviewer corrects is recorded and shown to the client** — old
value, new value, who, when — because the client sent one set of figures and a
different set may now be on the payment.

**Accepting is silent by design.** It records what is owed and puts the
freelancer on the roster; it sends nothing and moves no money. **Preparing the
run is the loud step** — that is what emails the client and puts a payroll on
their dashboard awaiting approval.

Two invoices from the same freelancer in one month are **summed**, not
overwritten — a run has one amount per person, and silently replacing the first
would underpay somebody.

---

## Where AI is used, and where it is not

**AI reads messy input. Code generates authoritative output.** This is a locked
design principle, not a current limitation.

**AI does:**
- read invoices — payee, wallet, amount, currency, date, invoice number
  (Gemini, forced-JSON structured output)
- read a client's messy freelancer list on import
- answer questions about that account's payments, in the built-in assistant
  (agentic tool-calling over `query_payments` / `describe_data`, NDJSON-streamed)

**AI never:**
- decides a number. Every amount, exchange rate and total is computed in code.
- validates a wallet. Addresses go through viem's `isAddress()` — client-side
  for live feedback, server-side for enforcement.
- moves money, or approves anything.

> AI is unreliable at arithmetic, and this is payroll. A figure that comes from
> computation can be audited. A figure that comes from a language model cannot.

The assistant is scoped: it answers about that account's payments and about how
GlobePay works, and politely declines anything else. It stops after
`MAX_ROUNDS = 5` so a stuck agent cannot loop on the bill.

**Model fallback chain**, overridable via `GEMINI_MODEL` without a deploy —
Google's free tier is counted *per model*, so falling down the list keeps a demo
alive on a free key. Measured, same prompt, median of 3 round trips:

| Model | Latency | Position |
|---|---|---|
| `gemini-3.6-flash` | 1.8s | first — the one that answers in practice |
| `gemini-3.1-flash-lite` | 0.4s | quickest, weakest reasoner — backs up rather than leads |
| `gemini-3.5-flash` | 13.0s | last — 3 round trips × 13s reads as broken |

---

## Security

### Identity-based rate limiting on every endpoint

Keyed by **who is asking**, not where from — these endpoints sit behind a login,
an office shares one IP, and a stolen session moves between them. IP is the
fallback for public routes.

The counter lives in **Postgres**, not a module-scope `Map`: an in-memory
counter is per-instance and resets on deploy, so the real limit becomes N times
what you wrote and an attacker only has to keep landing on a cold instance.
Enforced atomically with `INSERT … ON CONFLICT`.

| Bucket | Limit | Why |
|---|---|---|
| `ask` | 20 / 5 min | one question spends up to 5 Gemini round trips |
| `extract` | 15 / 5 min | ships a whole document |
| `search` | 120 / 1 min | typing is bursty; debounce is 180ms |
| `write` | 60 / 5 min | roster edits, settings, messages |
| `reauth` | 5 / 15 min | password guesses — deliberately tight |
| `verify` | 20 / 1 hour | public |
| `contact` | 5 / 1 hour | public |

It **fails open**. If the database is unreachable the request proceeds: this
guards a quota, and refusing to let a company approve payroll because a counter
table was briefly unavailable is a worse outcome than the abuse it prevents.
Failures are logged so it cannot pass silently.

### Headers ([next.config.ts](next.config.ts))

Every origin in the CSP was **observed in a real session or traced to the code
that calls it** — none guessed.

| Header | Value / purpose |
|---|---|
| `Content-Security-Policy` | full policy; `connect-src` allowlists Supabase, the RPC, the FX CDN and WalletConnect only |
| `frame-ancestors` | `'self' https://app.safe.global` — closes clickjacking on the **Confirm & pay** button while still allowing the Safe App embed |
| `X-Frame-Options` | `SAMEORIGIN` — belt and braces for browsers that ignore CSP |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` — otherwise `?q=Akil%20Shaikh` leaks freelancer names to third parties |
| `Permissions-Policy` | camera, mic, geolocation, payment, USB all denied |
| `Strict-Transport-Security` | 2 years, `includeSubDomains; preload` |
| `poweredByHeader` | off — stop advertising the framework version to scanners |

On `script-src 'unsafe-inline'`, the README is straight rather than flattering:
Next.js inlines its hydration bootstrap, and a nonce would force every page to
render dynamically, losing static generation on the marketing pages. So CSP here
is **defence in depth against exfiltration and framing, not a guarantee against
script injection.** What keeps that surface small is that nothing renders raw
HTML — there is no `dangerouslySetInnerHTML` anywhere in the codebase, and the
assistant's replies go through `react-markdown`.

### Auth and tenant isolation

- Supabase Auth, email + password, cookie sessions via `@supabase/ssr`.
- `client_users` maps each login to `globepay_admin` (no `client_id`) or
  `client` (scoped to one).
- Coarse guard in [proxy.ts](proxy.ts) (this Next.js renamed `middleware.ts` →
  `proxy.ts`), role checks in the `/admin` and `/portal` layouts, and
  `getSessionInfo()` / `requireAdmin()` / `requireClient()` in **every** API
  route.
- **Clients cannot see each other** — enforced twice: 403s in API routes *and*
  Postgres RLS policies. The service-role key bypasses RLS and is
  **server-only**, never `NEXT_PUBLIC_`.
- Destructive actions sit behind re-authentication.

### Other properties

- Replay protection on verification signatures (the message pins wallet,
  company and issue time; tokens are single-use with a 72-hour TTL).
- Idempotency by `tx_hash` on every payment write.
- Signed, short-lived Supabase Storage URLs for invoice files — minted per
  request, never stored.
- Friendly errors everywhere; raw Postgres and chain errors are never surfaced.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2.6** (App Router, Turbopack) | `middleware.ts` is `proxy.ts`; `cookies()` is async; route `params` are Promises |
| UI | **React 19.2.4**, **Tailwind v4** | dark "treasury terminal" theme, tokens in `app/globals.css` |
| Components | Radix (Dialog, AlertDialog, DropdownMenu, Select, Tooltip, Tabs, Accordion, Progress), `cmdk`, `motion`, `recharts`, `lucide-react` | |
| Chain | **wagmi 3.6.16 + viem 2.51** | Base Sepolia (**84532**) |
| Wallets | `safe()`, `walletConnect()`, `injected()` | EIP-6963 multi-injected discovery; WalletConnect skipped cleanly when no projectId |
| Wallet SSR | `cookieStorage` + `cookieToInitialState` | localStorage can't be read server-side, so every page first painted "not connected" — the cookie makes the first paint correct |
| Contract | Solidity ^0.8.24, **Hardhat 2.26** | `contracts/` is a normal subfolder, **not** a git submodule |
| Database | **Supabase** (Postgres, Auth, Storage, RLS) | |
| AI | **Gemini**, forced-JSON structured output | agentic tool-calling loop, NDJSON streaming |
| Email | **Resend** | no-ops gracefully without `RESEND_API_KEY` |
| FX | fawazahmed0/currency-api via jsDelivr | free, no key, historical rates |
| Indexer | Etherscan v2 | historical backfill only |

---

## Data model

| Table | Holds |
|---|---|
| `clients` | company name, home country, wallet, contact email |
| `client_users` | `auth.users` → role (`globepay_admin` \| `client`) + `client_id` |
| `contractors` | the freelancers; name, country, wallet, rate, verification state |
| `invoice_submissions` | uploaded invoices, extracted fields, status, `corrections` jsonb, `payroll_run_id` |
| `payroll_runs` | status (`draft` \| `pending_confirmation` \| `executed` \| `cancelled`), `line_items` jsonb snapshot, total, `tx_hash` |
| `payments` | one row per on-chain payroll tx — **rebuilt from the chain**, `tx_hash` unique, recipients jsonb, fee |
| `records` | one row per paid line — immutable snapshot, FX pinned at pay time, `tx_hash` anchor |
| `messages`, `message_hides` | client ↔ operator thread |
| `ask_conversations` | assistant history |
| `rate_limits` | the Postgres rate-limit counters |

**`records` are immutable snapshots.** FX is frozen at save time and the page
never recalculates; changing logic does *not* rewrite old rows. That is correct
audit behaviour, not a bug. It is read by the audit pack, analytics, the AI
assistant, its suggestions, and the command-palette search.

Migrations are `supabase/*.sql`, run in the dashboard SQL editor — the service
key cannot do DDL.

---

## Route map

### Client portal `/portal`
`/` home & confirm · `invoices` upload · `freelancers` roster + verification ·
`payments` receipts · `analytics` · `audit-pack` · `messages` · `ask` ·
`settings`

### Operator console `/admin`
`/` overview · `clients` + `clients/[id]` · `invoices` review queue ·
`payments` · `analytics` · `audit-pack` · `messages` · `ask` · `settings`

### Public
`/` landing · `/how-it-works` · `/contact` · `/login` · `/verify` (the
freelancer's signing page) · `/route` (role router)

### API

| Group | Routes |
|---|---|
| Invoices | `invoices`, `invoices/[id]`, `invoices/ready`, `extract`, `import-freelancers` |
| Payroll | `payroll-runs`, `payroll-runs/[id]`, `payments`, `payments/backfill`, `records` |
| People | `clients`, `clients/[id]`, `contractors`, `contractors/[id]` |
| Verification | `verify-wallet`, `verify-wallet/proof` |
| Assistant | `ask`, `ask/suggestions`, `ask/conversations` |
| Other | `messages`, `messages/[id]`, `messages/threads`, `search`, `settings`, `reauth`, `contact`, `company` |

---

## Project structure

```
app/
  portal/            client portal (invoices, confirm & pay, receipts, roster)
  admin/             operator console (review queue, clients, payments)
  verify/            the freelancer's signing page — public, token-gated
  how-it-works/      cinematic explainer
  api/               27 route handlers, each auth-checked and rate-limited
lib/
  chain.ts           rebuild a payment from chain events (smart-account proof)
  preflight.ts       balance / allowance / blacklist, one RPC round trip
  disperse.ts        contract address + ABI
  usdc.ts            USDC address + decimals — DO NOT EDIT
  wagmi.ts           connectors, cookie storage
  wallet-verification.ts   the signed sentence, TTL, trust levels
  invoice-submissions.ts   matchInvoice() — the four verdicts
  rate-limit.ts      Postgres-backed, identity-keyed
  auth.ts            getSessionInfo / requireAdmin / requireClient
  fx.ts, notify.ts, ask-tools.ts, csv.ts, …
components/
  landing/           nav, sections, how-it-works, iso-art
  ui/                kit, overlays, select, motion
  invoice-*.tsx      upload, queue, intake, viewer
  verify-wallet-cell.tsx, verification-proof.tsx
  portal-shell.tsx, admin-shell.tsx, command-search.tsx, …
contracts/           Hardhat project — Disperse.sol, deploy script
supabase/            numbered SQL migrations
scripts/create-user.mjs
proxy.ts             session refresh + coarse route guard
```

---

## Getting started

### Prerequisites

- Node 20+
- A Supabase project
- A Gemini API key
- A wallet with **Base Sepolia ETH** (for gas) and **test USDC**

### 1 · Install

```bash
git clone <repo>
cd Globepay
npm install
```

### 2 · Environment

Create `.env.local` in the root:

```ini
# --- required ---
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=        # SERVER ONLY — never NEXT_PUBLIC_
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_DISPERSE_ADDRESS=0xfDA6e1FaEa69958407c8a5c49b1330c8cC54A897

# --- optional ---
NEXT_PUBLIC_RPC_URL=              # dedicated RPC; falls back to the public one
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # omit and WalletConnect is skipped cleanly
NEXT_PUBLIC_APP_URL=
GEMINI_MODEL=                     # override the fallback chain without a deploy
ETHERSCAN_API_KEY=                # historical backfill only
RESEND_API_KEY=                   # email no-ops without it
NOTIFY_FROM=
NOTIFY_TO=
CONTACT_FROM=
CONTACT_TO=
```

And `contracts/.env` if you intend to redeploy:

```ini
PRIVATE_KEY=
ETHERSCAN_API_KEY=
BASE_SEPOLIA_RPC_URL=
```

> **Never commit `.env*` or `node_modules`.** `SUPABASE_SERVICE_ROLE_KEY` must
> never carry a `NEXT_PUBLIC_` prefix — that would ship a key that bypasses RLS
> to every browser.

### 3 · Database

Run each file in `supabase/*.sql` **in numeric order** in the Supabase dashboard
SQL editor. The service key cannot perform DDL, so this step is manual by
necessity.

### 4 · Accounts

```bash
node scripts/create-user.mjs admin  you@example.com  <password>
node scripts/create-user.mjs client billing@acme.com <password> "Acme Ltd"
```

### 5 · Run

```bash
npm run dev      # development
npm run build && npm run start   # production
npm run lint
```

Open <http://localhost:3000>. Admins land on `/admin`, clients on `/portal`.

### Funding a test wallet

- **Base Sepolia ETH** — Coinbase Developer Platform faucet
- **Test USDC** — <https://faucet.circle.com>

---

## Testing the full flow

1. **Client** → `/portal/invoices` → drop in a few invoice PDFs. Each is read on
   arrival and appears as **Pending**.
2. **Admin** → `/admin/invoices` → open each invoice in place, check the wallet
   against the page, correct anything wrong, **Accept**. Nothing is sent yet.
3. **Admin** → accepted invoices collect into *"Acme Ltd — 3 accepted invoices,
   $5,450 owed."* → **Prepare payroll**. *This* emails the client.
4. **Client** → `/portal` → *"Payroll ready for your confirmation."* Connect the
   wallet, press **Confirm & pay**.
5. Watch the **pre-flight** run before any signature is requested. Try it with a
   deliberately unfundable wallet to see it name the freelancer and offer to pay
   everyone else.
6. **One signature.** Approve once (capped), then `disperseToken`.
7. Check `/portal/payments` and `/portal/audit-pack` — receipts, pinned FX
   rates, and a Basescan link per row.

**Verification**: on `/portal/freelancers`, press **Verify** to copy a link,
open it in another browser, connect a different wallet and sign. A green tick
appears in both UIs; click it for the proof.

> Verify payments on **Basescan**, not MetaMask Activity — MetaMask hides
> untracked tokens and only logs self-sent activity.

---

## What GlobePay deliberately does not do

**Tax.** No withholding, no net-of-tax, no domestic-versus-cross-border
treatment. This was built, and then **removed in August 2026**, on purpose.

Withholding is the *payer's* obligation, and it only exists when payer and payee
share a country. GlobePay's entire premise is paying freelancers **abroad**,
where the payer usually has no tax registration in the freelancer's country and
therefore no mechanism to remit anything on their behalf. The feature computed
`$0.00` on essentially every real row while implying a service that was not
being provided. Adding domestic payroll to justify it is not worth it either — a
payer settling domestically already has bank transfer and several other working
rails.

What the product does instead: freelancers are paid the **full invoiced
amount**, and the record — who, how much, when, at what FX rate, with on-chain
proof — is exactly what an accountant needs. Tax on that income is between the
freelancer and their own authority.

Some columns (`withholding_rate`, `withheld_amount`, `net_amount`,
`tax_treatment`) remain in the schema because existing rows are immutable
snapshots and dropping them would rewrite history. **Nothing reads them for
display.**

---

## Known limitations

Stated plainly, because a limitation you have written down is a limitation you
have understood.

- **Testnet only.** Base Sepolia. Everything is real — real wallets, real
  signatures, real transactions on a real block explorer — but the tokens are
  **test USDC, not real money.** Moving to mainnet is a configuration change,
  not a rebuild.
- **Backfill cannot see smart-account payrolls.**
  [`payments/backfill`](app/api/payments/backfill/route.ts) filters Etherscan's
  `txlist` on `to === DISPERSE_ADDRESS` — the same `receipt.to` heuristic
  `chain.ts` deliberately refuses, and `txlist` returns external transactions
  only, so a Safe-executed payroll never appears. The fix is to match on the
  `Dispersed` **event log** instead. Live payments are unaffected — they already
  go through `chain.ts`.
- **1 USDC = 1 USD at par**, an MVP assumption. Real de-peg is ~5bps.
- **`script-src 'unsafe-inline'`** — see [Security](#security) for why, and what
  compensates.
- **Gemini free tier is 20 requests/day per model**, which is why the fallback
  chain exists.
- **Supabase free tier pauses after ~1 week idle** — every API route then 500s
  with "fetch failed". Restore from the dashboard.
- **A Safe still needs an owner's wallet to sign.** A Safe is a contract and has
  no private key, so an owner EOA (MetaMask, say) supplies the signature. That
  is the defining property of a smart-contract wallet, not a gap — and a Safe
  with threshold > 1 *proposes* rather than executes, so the returned hash is a
  Safe tx hash that will never get a receipt until co-signers act. Handled by
  `receiptOrNull`.
- **Immutable records keep old logic** until deleted. By design.

---

## Roadmap

### Next
- **Invoice history pages** for both the client and the operator — a permanent,
  searchable archive of every invoice and its outcome, separate from the live
  queue.
- **Fix backfill** to match on the `Dispersed` event rather than `receipt.to`,
  closing the smart-account gap above.
- **Finish the tax-module removal** — drop `computeWithholding` and stop writing
  the four dormant columns, keeping `getTaxRule` / `validateTaxId` for the
  optional tax-ID field.
- **Mainnet on Base** — the configuration change, plus the operational work that
  should accompany real money.

### Then
- **Recurring payroll** — schedules, so a monthly run prepares itself and waits
  for one signature.
- **Multi-token**: USDT alongside USDC. Some teams are already paid in USDT and
  would rather not switch.
- **Multi-chain**: Polygon and Arbitrum, wherever the recipients already are.
- **Wallet-native approvals** — push the confirmation into the client's wallet
  app rather than requiring the browser.
- **Deeper Safe support** — surface co-signer progress in the UI for
  threshold > 1, rather than only handling it correctly underneath.
- **Freelancer-facing view** — let a freelancer see their own payment history
  and download their own receipts, without an account with the client.
- **Accounting integrations** — Xero and QuickBooks export, so the audit pack
  lands where the bookkeeping already happens.
- **De-peg tracking** — record the real USDC/USD rate per payment rather than
  assuming par.
- **SSO / SAML** for larger clients, and an audit log of operator actions.
- **Batched approvals via ERC-2612 `permit`** — remove the separate approve
  transaction entirely, making a first payroll one signature rather than two.

### Further out
- Payment-rail fallback for freelancers without wallets (off-ramp partner).
- Public API + webhooks.
- SOC 2 groundwork and a third-party contract audit before mainnet at volume.

---

## Pricing

| | Testnet | Mainnet |
|---|---|---|
| **Price** | **Free** | **£26.99 / month** |
| Scope | the entire product, no card, no expiry | flat — not per freelancer, not per payment, not a percentage |

The only other cost is the network fee for the transaction itself, which goes to
the blockchain rather than to GlobePay — on Base, typically a fraction of a
penny.

---

<div align="center">

**GlobePay** · non-custodial stablecoin payroll · Base Sepolia
Solo-built. No customers yet. Everything above is what the code actually does.

</div>
