-- ============================================================
-- Message deletion: "delete for me" and "delete for everyone".
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================
--
-- Two different operations that people casually call the same word:
--
--   delete for me        hides the message from one person's view. Always
--                        available, on any message, forever. Changes nothing
--                        for anybody else.
--
--   delete for everyone  retracts the message from the thread. Only the sender
--                        can do it, only inside a short window, and only while
--                        the other side has not read it.
--
-- Both are SOFT deletes. The row is never removed, because this thread is a
-- business record between a company and its payroll provider — the audit
-- position is "you can see that a message was withdrawn, and when", not "the
-- history silently changes shape". What goes is the content.

-- ------------------------------------------------------------
-- delete for everyone: a tombstone on the message itself
-- ------------------------------------------------------------
alter table messages
  add column if not exists deleted_for_all_at timestamptz,
  add column if not exists deleted_by_email  text;

-- The original constraint says a message must have a body or an attachment:
--
--   check ((body is not null and length(btrim(body)) > 0) or attachment_path is not null)
--
-- Retracting a message clears both, so that check would reject the very update
-- that performs the deletion. Widen it: a message must have content *or* be a
-- tombstone. Anything with neither is still refused, which was the point.
alter table messages drop constraint if exists message_has_content;
alter table messages add constraint message_has_content check (
  (body is not null and length(btrim(body)) > 0)
  or attachment_path is not null
  or deleted_for_all_at is not null
);

-- ------------------------------------------------------------
-- delete for me: one row per (message, person)
--
-- Per *user*, not per side: two people at the same company share a thread, and
-- one of them clearing a message from their own view must not clear it from
-- their colleague's.
-- ------------------------------------------------------------
create table if not exists message_hides (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  hidden_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_hides_user_idx on message_hides (user_id);

alter table message_hides enable row level security;

-- You can only ever see, create or undo your own hides. There is no case for
-- reading someone else's: it would leak which messages they chose to hide.
drop policy if exists message_hides_own on message_hides;
create policy message_hides_own on message_hides for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
