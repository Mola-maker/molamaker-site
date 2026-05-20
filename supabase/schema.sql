-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text not null default '',
  published_at timestamptz default now(),
  view_count int default 0,
  read_time int default 5
);

create table if not exists guestbook (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 40),
  message text not null check (char_length(message) between 1 and 240),
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text, email text, subject text,
  message text not null,
  created_at timestamptz default now()
);

create table if not exists page_views (
  id bigserial primary key,
  path text not null,
  session_id text,
  created_at timestamptz default now()
);

create or replace function increment_view(post_slug text) returns int as $$
  update posts set view_count = view_count + 1
  where slug = post_slug
  returning view_count;
$$ language sql;

alter table posts      enable row level security;
alter table guestbook  enable row level security;
alter table contacts   enable row level security;
alter table page_views enable row level security;

drop policy if exists "read posts"      on posts;
drop policy if exists "read guestbook"  on guestbook;
drop policy if exists "write guestbook" on guestbook;
drop policy if exists "write contacts"  on contacts;
drop policy if exists "write views"     on page_views;

create policy "read posts"      on posts      for select using (true);
create policy "read guestbook"  on guestbook  for select using (true);
create policy "write guestbook" on guestbook  for insert with check (
  char_length(message) between 1 and 240 and char_length(name) <= 40
);
create policy "write contacts"  on contacts   for insert with check (true);
create policy "write views"     on page_views for insert with check (true);

insert into posts (slug, title, excerpt, read_time) values
  ('kernel-rewrite',      'Why I rewrote my kernel three times',              'A tale of pointer chases and warp divergence.', 6),
  ('agent-orchestration', 'Notes on agent orchestration that actually works', 'Five specialists, one shared context, zero hallucinated citations (mostly).', 11),
  ('rotational-dynamics', 'A small love letter to rotational dynamics',       'On gyroscopic precession and why it still surprises me.', 4),
  ('astrbot-review',      'Path traversal in the wild: an AstrBot review',    'Reading code with paranoia mode on.', 8),
  ('termux-os',           'Termux is a tiny operating system, actually',      'Rootless Linux in your pocket.', 5)
on conflict (slug) do nothing;
