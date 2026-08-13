-- ============================================================
-- Link an accepted invoice to the payroll run that pays it.
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================

-- Accepting an invoice and paying it are two different acts, and until now
-- nothing recorded the second. An accepted invoice looked identical before and
-- after a run, so the same $2,500 could be pulled into next month's run as well
-- — and on chain there is no way to take it back.
--
-- Null means accepted and still owed. Set means a run has claimed it.
-- 'on delete set null' rather than cascade: if a run is deleted the invoice
-- goes back to being owed rather than disappearing with it.
alter table invoice_submissions
  add column if not exists payroll_run_id uuid references payroll_runs(id) on delete set null;

-- The question this table gets asked most: what does this client still owe?
create index if not exists invoice_submissions_unpaid_idx
  on invoice_submissions (client_id)
  where status = 'accepted' and payroll_run_id is null;
