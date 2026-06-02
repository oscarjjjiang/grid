-- GRID planner — cloud storage setup
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

-- One row per user holds their entire planner (projects + tasks) as JSON.
create table if not exists public.plans (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only read/write their own row.
alter table public.plans enable row level security;

drop policy if exists "own plan" on public.plans;
create policy "own plan" on public.plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
