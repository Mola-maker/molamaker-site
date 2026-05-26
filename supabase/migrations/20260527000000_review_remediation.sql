-- Remediation migration: fixes from 2026-05-26 full codebase review.
-- H1: Enable RLS on rate_limits (was exposed to anonymous REST API).
-- H2: Make increment_view SECURITY DEFINER (was silently failing for anons).
-- M1: Add SELECT policy on page_views (getTotalViews() was always returning 0).

-- H1: Close the rate_limits table to anonymous access.
-- The check_rate() RPC is SECURITY DEFINER and bypasses RLS.
-- The API uses the service client for rate checks.
-- No policies are needed — neither anon nor authenticated should read this table.
alter table rate_limits enable row level security;

-- H2: Fix the increment_view RPC so anonymous visitors can actually increment
-- view counts. Previously SECURITY INVOKER (default), which failed silently
-- because anonymous users don't have UPDATE on posts.
create or replace function increment_view(post_slug text) returns int as $$
  update posts set view_count = view_count + 1
  where slug = post_slug
  returning view_count;
$$ language sql security definer;

-- M1: Let anonymous visitors read page_views aggregates.
-- Without this, getTotalViews() — which calls count(*) on page_views —
-- always returned 0 for unauthenticated users.
create policy "read page_views" on page_views for select using (true);
