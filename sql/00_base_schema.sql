-- ─────────────────────────────────────────────────────────────────────────────
-- Granite — Base schema (RUN THIS FIRST)
-- Creates the `profiles` table, the new-user trigger and the get_my_profile RPC
-- that the rest of the scripts and the app depend on.
-- Run in Supabase → SQL Editor → New query.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Profiles: one row per authenticated user (the approved-user table)
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text,
  full_name        text,
  approved         boolean      default false,
  trial_expires_at timestamptz,                 -- unused for internal staff; kept for app compatibility
  subscribed       boolean      default false,  -- "
  created_at       timestamptz  default now(),
  updated_at       timestamptz  default now()
);

-- 2. RLS — a user can read/update only their own row.
--    (Admin/manager dashboards read across users via the policies in the
--     activity_logs / module_progress scripts, and enforce admin access client-side.)
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can update own profile"  on public.profiles;

create policy "Users can read own profile"  on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 3. Auto-create a profile row whenever a new auth user is created.
--    The BEFORE-INSERT trigger from setup_auto_approval.sql then sets `approved`
--    if the email / domain is in the approved list.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. RPC the app calls to read the signed-in user's profile (bypasses RLS safely).
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_profile() to authenticated;
