-- ============================================================
-- GlobePay messages: one thread per client, GlobePay on the other end.
-- Run once in Supabase dashboard -> SQL Editor. Safe to re-run.
-- ============================================================

-- A client company and GlobePay only ever talk to each other, so there is one
-- implicit thread per client and no threads table is needed — client_id is the
-- thread. Attachments live in the private "attachments" storage bucket; only
-- the object path is stored here, and downloads go through short-lived signed
-- URLs minted server-side.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references clients(id) on delete cascade,

  -- Who wrote it. 'client' = the company, 'globepay' = us.
  sender text not null check (sender in ('client', 'globepay')),
  author_id uuid references auth.users(id),
  author_email text,

  body text,                       -- may be empty when the message is just a file

  attachment_path text,            -- object path inside the 'attachments' bucket
  attachment_name text,            -- original filename, for display and download
  attachment_type text,            -- mime type
  attachment_size integer,         -- bytes

  -- Read by the *other* side. Null = still unread.
  read_at timestamptz,

  -- A message with neither words nor a file is not a message.
  constraint message_has_content check (
    (body is not null and length(btrim(body)) > 0) or attachment_path is not null
  )
);

create index if not exists messages_client_created_idx on messages (client_id, created_at desc);
create index if not exists messages_unread_idx on messages (client_id, sender) where read_at is null;

-- Row Level Security. The service-role key used by our API routes bypasses
-- these; they protect the anon/authenticated keys a browser session holds.
alter table messages enable row level security;

drop policy if exists messages_select on messages;
create policy messages_select on messages for select
  using (auth_is_admin() or client_id = auth_client_id());

drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert
  with check (auth_is_admin() or client_id = auth_client_id());

-- ------------------------------------------------------------
-- Storage: the 'attachments' bucket is private. Files are namespaced by
-- client id (<client_id>/<uuid>-<filename>), so a client can only reach its own
-- folder even if it talks to storage directly.
-- ------------------------------------------------------------
drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects for select
  using (
    bucket_id = 'attachments'
    and (auth_is_admin() or (storage.foldername(name))[1] = auth_client_id()::text)
  );

drop policy if exists attachments_write on storage.objects;
create policy attachments_write on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and (auth_is_admin() or (storage.foldername(name))[1] = auth_client_id()::text)
  );
