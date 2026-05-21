-- Migration: supporter tiers (Buy Me a Coffee integration).
-- Tracks verified BMC supporters and gates premium resources.

create table if not exists supporters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bmc_email text not null,
  tier text not null default 'coffee' check (tier in ('coffee', 'monthly', 'lifetime')),
  verified_at timestamptz default now(),
  expires_at timestamptz
);

alter table supporters enable row level security;

-- Users can read their own supporter row
create policy "supporters read own" on supporters for select
  using (auth.uid() = user_id);

-- Only service role can write (via webhook handler)
create policy "service role write supporters" on supporters for all
  to service_role using (true) with check (true);
