-- Rate limiting that survives a deploy and works across instances.
--
-- The obvious implementation is a Map in module scope, and it is what
-- /api/contact had. It is also close to useless in production: serverless runs
-- many instances, each with its own Map, so the real limit is N times what you
-- wrote — and every deploy resets all of them. An attacker does not need to
-- defeat that; they only need to be unlucky enough to keep hitting a cold one.
--
-- This lives in Postgres, which every instance already shares. One statement,
-- one round trip, and the counter is correct no matter who serves the request.

create table if not exists rate_limits (
  -- "<action>:<identity>" — e.g. ask:9f3c… for a user, contact:203.0.113.7 for
  -- an anonymous visitor. Identity first-class, because these endpoints sit
  -- behind a login and an office full of people shares one IP.
  bucket       text primary key,
  count        int not null,
  window_start timestamptz not null
);

-- Old rows are only interesting inside their window; this keeps the sweep cheap.
create index if not exists rate_limits_window_idx on rate_limits (window_start);

/*
  Count one hit and say whether it was allowed.

  Written as a single INSERT … ON CONFLICT so the read, the compare and the
  write happen in one statement. Doing it as SELECT-then-UPDATE would let two
  concurrent requests both read "9 of 10" and both proceed — which is exactly
  the case a limiter exists for.
*/
create or replace function check_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int, retry_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now    timestamptz := now();
  v_count  int;
  v_start  timestamptz;
begin
  insert into rate_limits as rl (bucket, count, window_start)
  values (p_bucket, 1, v_now)
  on conflict (bucket) do update
    set count = case
          -- Window expired: this hit starts a fresh one.
          when rl.window_start < v_now - make_interval(secs => p_window_seconds) then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
          else rl.window_start
        end
  returning rl.count, rl.window_start into v_count, v_start;

  return query select
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    greatest(0, ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds)) - v_now)))::int;
end;
$$;

-- Housekeeping. Nothing schedules this; call it from SQL occasionally, or wire
-- it to pg_cron if the table ever grows enough to notice.
create or replace function prune_rate_limits()
returns void
language sql
as $$
  delete from rate_limits where window_start < now() - interval '1 day';
$$;

-- Server-only. The service-role key bypasses RLS, so the API can still use it;
-- enabling RLS with no policy means the anon key cannot read or forge counters.
alter table rate_limits enable row level security;
revoke all on function check_rate_limit(text, int, int) from anon, authenticated;
