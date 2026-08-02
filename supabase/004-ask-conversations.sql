-- ============================================================
-- Saved assistant conversations, per account.
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================

-- Previously these lived in localStorage, which meant "your history" was really
-- "this browser's history" — sign in from a phone and it was gone. Since the
-- assistant is offered to clients as part of the product, the history belongs to
-- the account, not the device.
--
-- Keyed by user, not client: two people at the same company shouldn't read each
-- other's questions, and a GlobePay admin has no client_id at all.
create table if not exists ask_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  user_id uuid not null references auth.users(id) on delete cascade,
  -- Which client's book the questions were asked against. Null for a GlobePay
  -- admin asking across everyone.
  client_id uuid references clients(id) on delete cascade,

  title text not null,
  -- The exchange as rendered: question, answer, the scope line and the rows the
  -- figures came from. Stored whole because it is a transcript, not a queryable
  -- entity — nothing here is ever filtered or joined on.
  turns jsonb not null default '[]'::jsonb
);

create index if not exists ask_conversations_user_idx
  on ask_conversations (user_id, updated_at desc);

alter table ask_conversations enable row level security;

-- A conversation is only ever readable by the person who had it. Admins are not
-- excepted: this is someone's train of thought, not a business record, and the
-- durable record of the payments themselves is the ledger.
drop policy if exists ask_conversations_own on ask_conversations;
create policy ask_conversations_own on ask_conversations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
