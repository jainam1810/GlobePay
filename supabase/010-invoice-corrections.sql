-- ============================================================
-- What the reviewer changed, kept with the invoice.
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================

-- An invoice is read by a model and corrected by a person, and until now the
-- correction left no trace: the client saw the final figures and had no way to
-- know an amount or a wallet had been altered after they sent it. On something
-- that decides who gets paid what, "we changed this" is exactly what the other
-- side is entitled to see.
--
-- Append-only in practice — each entry is one field, its old value, its new
-- value, who and when — so the row carries its own history rather than only its
-- current state.
--
--   [{ "field": "amount", "from": "3", "to": "30",
--      "at": "2026-08-14T09:12:00Z", "by": "admin@globepay.example" }]
alter table invoice_submissions
  add column if not exists corrections jsonb not null default '[]'::jsonb;
