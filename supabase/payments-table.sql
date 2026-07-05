-- Payments table: one row per on-chain payroll run (one disperseToken tx).
-- Run this once in the Supabase dashboard → SQL Editor.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tx_hash text not null unique,
  block_number bigint,
  paid_at timestamptz,
  from_address text not null,
  token_address text not null,
  token_symbol text not null default 'USDC',
  total_amount numeric not null,
  recipient_count int not null,
  fee_eth numeric,
  recipients jsonb not null default '[]'::jsonb
);

-- Service-role key bypasses RLS, but enable it so the anon key (if ever used)
-- can't read payment history.
alter table payments enable row level security;
