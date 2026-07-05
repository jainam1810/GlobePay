-- ============================================================
-- GlobePay multi-tenant migration: clients, roles, payroll runs
-- Run once in Supabase dashboard -> SQL Editor.
-- Safe to re-run (idempotent guards throughout).
-- ============================================================

-- 1. Clients (absorbs company_profile: each client has their own HQ country,
--    so domestic/cross-border tax logic works per client).
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text not null,
  home_country text not null,
  wallet_address text,            -- the wallet that signs their payrolls
  contact_email text,
  notes text
);

-- 2. Map auth logins to a role. globepay_admin rows have client_id null.
create table if not exists client_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  role text not null check (role in ('globepay_admin', 'client')),
  constraint client_role_needs_client check (role != 'client' or client_id is not null)
);

-- 3. Payroll runs: GlobePay drafts -> client confirms (wallet signs) -> executed.
create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references clients(id) on delete cascade,
  status text not null default 'pending_confirmation'
    check (status in ('draft', 'pending_confirmation', 'executed', 'cancelled')),
  -- snapshot of what GlobePay prepared: [{contractor_id, name, wallet, amount}]
  line_items jsonb not null default '[]'::jsonb,
  total_amount numeric not null default 0,
  note text,                      -- e.g. "July 2026 payroll"
  prepared_by uuid references auth.users(id),
  confirmed_at timestamptz,
  tx_hash text                    -- set when executed; links to payments.tx_hash
);

-- 4. Scope existing tables by client.
alter table contractors add column if not exists client_id uuid references clients(id) on delete cascade;
alter table payments    add column if not exists client_id uuid references clients(id) on delete set null;
alter table records     add column if not exists client_id uuid references clients(id) on delete set null;

-- 5. Migrate: company_profile (id=1) becomes client #1; adopt all existing rows.
do $$
declare cid uuid;
begin
  if not exists (select 1 from clients) then
    insert into clients (company_name, home_country)
    select company_name, home_country from company_profile where id = 1
    returning id into cid;

    update contractors set client_id = cid where client_id is null;
    update payments    set client_id = cid where client_id is null;
    update records     set client_id = cid where client_id is null;
  end if;
end $$;

-- 6. Row Level Security: clients physically cannot read each other's rows.
--    (The service-role key bypasses RLS; these policies protect the anon/auth
--    keys used by logged-in portal sessions.)
create or replace function auth_client_id() returns uuid
language sql stable security definer set search_path = public as
$$ select client_id from client_users where user_id = auth.uid() $$;

create or replace function auth_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from client_users where user_id = auth.uid() and role = 'globepay_admin') $$;

alter table clients       enable row level security;
alter table client_users  enable row level security;
alter table payroll_runs  enable row level security;
alter table contractors   enable row level security;
alter table records       enable row level security;
-- payments RLS already enabled by 001; policies added below.

drop policy if exists clients_select on clients;
create policy clients_select on clients for select
  using (auth_is_admin() or id = auth_client_id());

drop policy if exists client_users_select on client_users;
create policy client_users_select on client_users for select
  using (auth_is_admin() or user_id = auth.uid());

drop policy if exists payroll_runs_select on payroll_runs;
create policy payroll_runs_select on payroll_runs for select
  using (auth_is_admin() or client_id = auth_client_id());

drop policy if exists contractors_select on contractors;
create policy contractors_select on contractors for select
  using (auth_is_admin() or client_id = auth_client_id());

drop policy if exists payments_select on payments;
create policy payments_select on payments for select
  using (auth_is_admin() or client_id = auth_client_id());

drop policy if exists records_select on records;
create policy records_select on records for select
  using (auth_is_admin() or client_id = auth_client_id());
