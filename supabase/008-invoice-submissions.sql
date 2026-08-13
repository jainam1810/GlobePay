-- ============================================================
-- GlobePay invoice submissions: the client uploads, we review.
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================

-- Replaces the old path, where an invoice arrived as a message attachment, was
-- downloaded by hand, re-uploaded into the extractor, and typed into the roster.
-- That is O(n) human work per invoice and puts GlobePay in the middle of every
-- one of them. Here the client uploads straight into a queue, the AI reads it on
-- arrival, and review is a table you scan rather than a folder you work through.
--
-- The file itself goes in the existing private 'attachments' bucket, namespaced
-- by client id exactly as message attachments are, so the storage policies
-- already written in 003 cover it and downloads stay behind signed URLs.
create table if not exists invoice_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references clients(id) on delete cascade,
  uploaded_by uuid references auth.users(id),

  -- The original document, kept whether or not the extraction was any good:
  -- it is the evidence behind the payment, and the reviewer needs to be able to
  -- check the reading against the page.
  storage_path text not null,
  file_name text not null,
  file_type text,
  file_size integer,

  -- Everything the model returned, verbatim, including its confidence and
  -- notes. Kept whole so a surprising row can be traced back to what was read.
  extracted jsonb,

  -- Promoted out of `extracted` because they are matched, sorted and
  -- de-duplicated on, and a jsonb lookup in an index is a worse idea than a
  -- column. These are the reviewer's to correct, so they are not read-only
  -- copies of the AI's output — they are the working values.
  payee_name text,
  payee_wallet text,
  amount numeric,
  currency text,
  invoice_number text,
  invoice_date date,
  description text,

  -- Same shape as payroll_runs.status: a small closed set, checked in the
  -- database rather than trusted from the application.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'needs_attention')),

  -- One line back to the client when something is wrong. Without it a rejected
  -- invoice just disappears and they upload it again.
  review_note text,

  -- Set when accepted: which roster entry this invoice ended up paying.
  contractor_id uuid references contractors(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

-- The admin queue: oldest pending first, across every client.
create index if not exists invoice_submissions_queue_idx
  on invoice_submissions (status, created_at)
  where status = 'pending';

-- The client's own history, newest first.
create index if not exists invoice_submissions_client_idx
  on invoice_submissions (client_id, created_at desc);

-- Matching an incoming invoice against the roster is done on the wallet.
create index if not exists invoice_submissions_wallet_idx
  on invoice_submissions (client_id, lower(payee_wallet));

-- Pay the same invoice twice and the money is gone; there is no undo on chain.
-- Keyed on wallet rather than name because two freelancers can number their
-- invoices identically and neither is wrong — the wallet is what makes
-- "invoice 007" unambiguous. Only accepted rows are constrained, so a client
-- may re-upload something that was rejected.
create unique index if not exists invoice_submissions_no_duplicates
  on invoice_submissions (client_id, lower(payee_wallet), lower(invoice_number))
  where status = 'accepted'
    and payee_wallet is not null
    and invoice_number is not null
    and length(btrim(invoice_number)) > 0;

-- Row Level Security. The service-role key our API routes use bypasses these;
-- they protect the anon/authenticated key a browser session holds.
alter table invoice_submissions enable row level security;

drop policy if exists invoice_submissions_select on invoice_submissions;
create policy invoice_submissions_select on invoice_submissions for select
  using (auth_is_admin() or client_id = auth_client_id());

-- A client may submit its own invoices. Only GlobePay may review them, and
-- review is what changes status — so there is no client update policy at all.
drop policy if exists invoice_submissions_insert on invoice_submissions;
create policy invoice_submissions_insert on invoice_submissions for insert
  with check (auth_is_admin() or client_id = auth_client_id());

drop policy if exists invoice_submissions_update on invoice_submissions;
create policy invoice_submissions_update on invoice_submissions for update
  using (auth_is_admin());
