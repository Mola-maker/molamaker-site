-- Migration: auth + drafts.
-- Adds published flag and authenticated-user RLS policies.

alter table posts add column if not exists published boolean default false;
update posts set published = true;

drop policy if exists "read posts" on posts;
drop policy if exists "read published posts" on posts;
create policy "read published posts" on posts for select
  using (published = true);

drop policy if exists "owner can read all posts" on posts;
create policy "owner can read all posts" on posts for select
  to authenticated using (true);

drop policy if exists "owner can write posts" on posts;
create policy "owner can write posts" on posts for all
  to authenticated using (true) with check (true);
