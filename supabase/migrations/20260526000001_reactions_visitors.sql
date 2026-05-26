-- Reactions for blog posts + visitor tracking
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS)

-- Post reactions table
create table if not exists public.reactions (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null,
  kind       text not null check (kind in ('heart', 'brain', 'fire')),
  voter_key  text not null,          -- hash of IP+UA, no PII stored
  created_at timestamptz default now(),
  unique(slug, kind, voter_key)
);

alter table public.reactions enable row level security;

drop policy if exists "public read reactions" on public.reactions;
drop policy if exists "public insert reactions" on public.reactions;

create policy "public read reactions"
  on public.reactions for select using (true);

create policy "public insert reactions"
  on public.reactions for insert
  with check (length(slug) < 200 and length(voter_key) < 200);

-- Aggregate view for fast reaction counts
create or replace view public.reaction_counts as
  select slug, kind, count(*) as total
  from public.reactions
  group by slug, kind;

-- Visitor counter table
create table if not exists public.visitors (
  id         uuid primary key default gen_random_uuid(),
  path       text not null default '/',
  visitor_id text not null,
  created_at timestamptz default now()
);

alter table public.visitors enable row level security;

drop policy if exists "public read visitors"  on public.visitors;
drop policy if exists "public insert visitors" on public.visitors;

create policy "public read visitors"
  on public.visitors for select using (true);

create policy "public insert visitors"
  on public.visitors for insert
  with check (length(path) < 500 and length(visitor_id) < 200);

-- Convenience: total + today visitor counts
create or replace view public.visitor_stats as
  select
    count(distinct visitor_id)::int as total,
    count(distinct visitor_id) filter (
      where created_at > now() - interval '1 day'
    )::int as today,
    count(distinct visitor_id) filter (
      where created_at > now() - interval '7 days'
    )::int as week
  from public.visitors;
