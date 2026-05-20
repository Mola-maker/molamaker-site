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

-- =============================================================================
-- Column comments
-- =============================================================================

comment on column posts.id is 'Unique post identifier';
comment on column posts.slug is 'URL-safe unique identifier for the post; used in routing';
comment on column posts.title is 'Display title of the post';
comment on column posts.published_at is 'Publication timestamp; used for chronological ordering';
comment on column posts.read_time is 'Estimated reading time in minutes';
comment on column posts.view_count is 'Atomic page-view counter incremented by increment_view()';
comment on column posts.excerpt is 'Short summary shown in post listings and previews';
comment on column posts.content is 'Full markdown body of the post';

comment on column guestbook.id is 'Unique entry identifier';
comment on column guestbook.name is 'Display name of the guestbook signer (max 40 chars)';
comment on column guestbook.message is 'Guestbook message body (1-240 chars)';
comment on column guestbook.created_at is 'Timestamp when the entry was submitted';

comment on column contacts.id is 'Unique contact submission identifier';
comment on column contacts.name is 'Name provided by the sender (nullable)';
comment on column contacts.email is 'Reply email address (nullable)';
comment on column contacts.subject is 'Subject line of the message (nullable)';
comment on column contacts.message is 'Message body (required)';
comment on column contacts.created_at is 'Timestamp when the contact form was submitted';

comment on column page_views.id is 'Auto-incrementing view record identifier';
comment on column page_views.path is 'Request path that was viewed';
comment on column page_views.session_id is 'Anonymous session identifier for deduplication (nullable)';
comment on column page_views.created_at is 'Timestamp of the page view event';

-- =============================================================================
-- increment_view function
-- Runs with SECURITY INVOKER (default). The entire UPDATE is a single
-- atomic SQL statement — no separate SELECT + UPDATE race window.
-- Returns the new view count so the caller can display it.
-- =============================================================================

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

-- Posts: public read-only. Anonymous users can read published posts but
-- cannot insert, update, or delete — all content is authored server-side
-- via the seed script or SQL editor.
create policy "read posts"      on posts      for select using (true);

-- Guestbook: public read. Entries are visible to everyone but only insert
-- is permitted so visitors cannot modify or delete each other's messages.
create policy "read guestbook"  on guestbook  for select using (true);

-- Guestbook write: length validation is enforced at the RLS layer as a
-- defense-in-depth measure in case the application layer bypasses checks.
create policy "write guestbook" on guestbook  for insert with check (
  char_length(message) between 1 and 240 and char_length(name) <= 40
);

-- Contacts: allow any visitor to submit a contact form. The with check (true)
-- policy is a known trade-off — it accepts all inserts so spam is possible.
-- Documented in the security review; rate-limiting is handled at the edge
-- (Vercel) rather than at the database layer.
create policy "write contacts"  on contacts   for insert with check (true);

-- Page views: allow any visitor to register a view event. with check (true)
-- is a known trade-off (same reasoning as contacts). Path and session_id
-- are validated at the application layer before insert.
create policy "write views"     on page_views for insert with check (true);

insert into posts (slug, title, excerpt, read_time) values
  ('kernel-rewrite',      'Why I rewrote my kernel three times',              'A tale of pointer chases and warp divergence.', 6),
  ('agent-orchestration', 'Notes on agent orchestration that actually works', 'Five specialists, one shared context, zero hallucinated citations (mostly).', 11),
  ('rotational-dynamics', 'A small love letter to rotational dynamics',       'On gyroscopic precession and why it still surprises me.', 4),
  ('astrbot-review',      'Path traversal in the wild: an AstrBot review',    'Reading code with paranoia mode on.', 8),
  ('termux-os',           'Termux is a tiny operating system, actually',      'Rootless Linux in your pocket.', 5)
on conflict (slug) do nothing;

-- =============================================================================
-- Performance indexes (add after table creation)
-- =============================================================================

-- Speeds up chronological post listings and the RSS feed ordering
create index if not exists idx_posts_published_at on posts(published_at desc);

-- Explicit slug index for lookup clarity (the unique constraint already
-- creates one, but an explicit index documents intent)
create index if not exists idx_posts_slug on posts(slug);

-- Speeds up guestbook page which lists entries newest-first
create index if not exists idx_guestbook_created_at on guestbook(created_at desc);

-- Speeds up per-page view count queries (e.g., /blog/post-slug analytics)
create index if not exists idx_page_views_path on page_views(path);

-- Speeds up time-range queries on page view analytics
create index if not exists idx_page_views_created_at on page_views(created_at desc);

-- ============================================================
-- pages table — editable content pages (Now, Uses, etc.)
-- ============================================================

create table if not exists pages (
  slug text primary key,
  content text not null default '',
  updated_at timestamptz default now()
);

insert into pages (slug, content) values
  ('now', 'I''m currently deep in CUDA kernel programming — writing fast GPU code for matrix operations and learning about warp-level primitives. When I''m not optimizing memory access patterns, I''m building a multi-agent CMS that coordinates LLM agents through structured prompts. My reading stack is PMPP (4th ed.) for the GPU work, and occasional physics papers on rotational dynamics. Music: mostly lo-fi and ambient — it helps with the late-night coding sessions.'),
  ('uses', '## Editor + Terminal\n\n- VS Code with Vim keybindings\n- Windows Terminal + PowerShell\n- Neovim for quick edits\n\n## Languages\n\n- TypeScript / JavaScript\n- Python (NumPy, PyTorch, AstrBot)\n- CUDA C++\n- Rust (learning)\n\n## Hardware\n\n- ThinkPad T-series\n- Some Linux phone (testing rootless environments)\n- Raspberry Pi 4 (homelab)\n\n## Apps\n\n- Firefox Developer Edition\n- Obsidian for notes\n- Spotify for focus music\n- Discord for communities\n\n## Books on the desk\n\n- Programming Massively Parallel Processors (4th ed.)\n- Envisioning Information — Edward Tufte\n- The C Programming Language — K&R')
on conflict (slug) do nothing;

alter table pages enable row level security;

drop policy if exists "read pages" on pages;
create policy "read pages" on pages for select using (true);

comment on table pages is 'Editable content pages (Now, Uses, etc.)';
comment on column pages.slug is 'URL-safe page identifier (e.g. ''now'', ''uses'')';
comment on column pages.content is 'Page body content (plain text or markdown)';
comment on column pages.updated_at is 'Last modification timestamp';

-- ============================================================
-- Migration: auth + drafts
-- ============================================================

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
