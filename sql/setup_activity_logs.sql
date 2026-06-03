-- ─────────────────────────────────────────────────────────────────────────────
-- credit-hire.ai  Activity Logging
-- Run this in the Supabase SQL Editor (Database → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists activity_logs (
  id               uuid        default gen_random_uuid() primary key,
  created_at       timestamptz default now(),
  user_id          uuid,
  user_email       text,
  activity_type    text        not null,  -- 'query' | 'tab_view'
  query_text       text,
  scope            text,                  -- 'credit_hire' | 'liability' | 'both'
  response_time_ms integer,
  cases_returned   integer,
  success          boolean,
  tab_name         text                   -- 'ai-query' | 'case-browser' | 'directory'
);

-- Index for fast dashboard queries
create index if not exists activity_logs_created_at_idx on activity_logs (created_at desc);
create index if not exists activity_logs_user_email_idx on activity_logs (user_email);
create index if not exists activity_logs_type_idx       on activity_logs (activity_type);

-- Enable Row Level Security
alter table activity_logs enable row level security;

-- Authenticated users can insert their own activity
create policy "Users can insert activity" on activity_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Authenticated users can read all logs (admin page enforces email check client-side)
create policy "Authenticated users can read logs" on activity_logs
  for select
  to authenticated
  using (true);
