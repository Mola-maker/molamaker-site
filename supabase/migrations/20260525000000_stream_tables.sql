-- Stream tables: signals feed + posts extension.
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- Signals table for the stream variant
create table if not exists public.signals (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,   -- 'commit' | 'song' | 'post' | 'guestbook' | 'visitor' | 'learning'
  time        text,
  payload     jsonb not null default '{}',
  created_at  timestamptz default now()
);

-- Posts table (separate from the existing posts table which has different schema)
create table if not exists public.stream_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  excerpt     text,
  body_mdx    text,
  tag         text,
  read_time   int,
  created_at  timestamptz default now()
);

-- RLS
alter table public.signals    enable row level security;
alter table public.stream_posts enable row level security;

drop policy if exists "public read signals"     on public.signals;
drop policy if exists "public read stream_posts" on public.stream_posts;

create policy "public read signals"      on public.signals      for select using (true);
create policy "public read stream_posts" on public.stream_posts for select using (true);
