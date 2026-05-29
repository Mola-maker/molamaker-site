-- Innovation cycle: Workplace Kanban tasks board
-- Adds workplace_tasks table for the in-dashboard Kanban panel.

create table if not exists workplace_tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) <= 200),
  description  text check (char_length(description) <= 1000),
  status       text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  repo_url     text,
  created_by   text,
  created_by_name text,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Service role only — all access is via the API which uses the service client.
alter table workplace_tasks enable row level security;

create index if not exists workplace_tasks_status_pos on workplace_tasks (status, position);
