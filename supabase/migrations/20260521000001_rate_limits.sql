-- Rate limits table for Postgres-backed token bucket.
-- Replaces the in-memory Map (lib/rate-limit.ts) which provides
-- zero protection on Vercel serverless and PM2 cluster mode.
create table if not exists rate_limits (
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_key_created
  on rate_limits (key, created_at);

-- Atomic sliding-window rate check.
-- Each request inserts a row; we count rows within the window.
-- Cleanup of expired rows happens inline (keeps 2x window).
create or replace function check_rate(
  bucket_key text,
  max_count int,
  window_ms int
) returns table(allowed boolean, remaining int, reset_ms int) as $$
declare
  window_start timestamptz;
  cnt int;
  oldest timestamptz;
begin
  window_start := now() - (window_ms || ' ms')::interval;

  -- Periodic cleanup: remove rows older than 2x window
  delete from rate_limits
    where created_at < now() - (window_ms * 2 || ' ms')::interval;

  select count(*) into cnt
    from rate_limits
    where key = bucket_key and created_at > window_start;

  if cnt >= max_count then
    allowed := false;
    remaining := 0;
    select min(created_at) into oldest
      from rate_limits
      where key = bucket_key and created_at > window_start;
    reset_ms := greatest(
      0,
      (extract(epoch from (oldest + (window_ms || ' ms')::interval - now())) * 1000)::int
    );
    return next;
    return;
  end if;

  insert into rate_limits (key, created_at)
    values (bucket_key, now());

  allowed := true;
  remaining := max_count - cnt - 1;
  reset_ms := 0;
  return next;
end;
$$ language plpgsql volatile security definer;
