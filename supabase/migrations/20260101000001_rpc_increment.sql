-- increment_view function.
-- Runs with SECURITY INVOKER (default). The entire UPDATE is a single
-- atomic SQL statement — no separate SELECT + UPDATE race window.
-- Returns the new view count so the caller can display it.

create or replace function increment_view(post_slug text) returns int as $$
  update posts set view_count = view_count + 1
  where slug = post_slug
  returning view_count;
$$ language sql;
