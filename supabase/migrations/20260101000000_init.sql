-- Core table creation + RLS policies.
-- All statements are idempotent (CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS before CREATE POLICY).

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
-- Row-Level Security
-- =============================================================================

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
