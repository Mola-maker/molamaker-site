-- Workplace: multi-user shared workspace for the 05workplace dashboard.
-- All access is server-side via the service-role client (bypasses RLS),
-- so RLS is enabled with no permissive policies (deny-by-default to anon/auth).

create table if not exists public.workplace_users (
  id            text primary key,           -- userId from session
  name          text not null,
  phone         text,
  email         text,
  wechat_openid text,
  last_ip       text,
  role          text not null default 'contributor',  -- owner|admin|contributor|viewer
  auth_method   text,                        -- 'phone' | 'wechat'
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create unique index if not exists idx_wp_users_phone  on public.workplace_users (phone)  where phone is not null;
create unique index if not exists idx_wp_users_wechat on public.workplace_users (wechat_openid) where wechat_openid is not null;

create table if not exists public.workplace_projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  github_repo   text,
  port          int,
  creator_id    text references public.workplace_users(id),
  creator_name  text,
  creator_ip    text,
  status        text not null default 'starting',
  created_at    timestamptz not null default now()
);
create index if not exists idx_wp_projects_creator on public.workplace_projects (creator_id);

create table if not exists public.workplace_audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     text,
  user_name   text,
  ip          text,
  action      text not null,        -- 'login' | 'logout' | 'deploy' | 'workflow_add' | 'claude_run'
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_wp_audit_user    on public.workplace_audit_log (user_id);
create index if not exists idx_wp_audit_created on public.workplace_audit_log (created_at desc);

create table if not exists public.workplace_otp (
  phone       text primary key,
  code        text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.workplace_workflows (
  id           text primary key,
  name         text not null,
  port         int not null,
  url          text,
  github_repo  text,
  description  text,
  created_at   timestamptz not null default now()
);

alter table public.workplace_users     enable row level security;
alter table public.workplace_projects  enable row level security;
alter table public.workplace_audit_log enable row level security;
alter table public.workplace_otp       enable row level security;
alter table public.workplace_workflows enable row level security;
