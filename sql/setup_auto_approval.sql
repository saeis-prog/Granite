-- ─────────────────────────────────────────────────────────────────────────────
-- credit-hire.ai  Auto-Approval Setup
-- Run this in Supabase → Database → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table to hold pre-approved emails and domains
create table if not exists auto_approved (
  id         uuid        default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  type       text        not null check (type in ('email', 'domain')),
  value      text        not null,  -- e.g. 'john@firm.co.uk' or 'firm.co.uk'
  note       text                   -- optional label, e.g. firm name
);

create unique index if not exists auto_approved_value_idx on auto_approved (lower(value));

-- RLS: only authenticated users (admin) can manage this table
alter table auto_approved enable row level security;

create policy "Admin can manage auto_approved" on auto_approved
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Function: called on profile insert to check auto-approval
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function apply_auto_approval()
returns trigger
language plpgsql
security definer
as $$
declare
  v_domain text;
begin
  -- Extract domain from email
  v_domain := lower(split_part(NEW.email, '@', 2));

  -- Auto-approve if exact email OR domain is in the approved list
  if exists (
    select 1 from auto_approved
    where (type = 'email'  and lower(value) = lower(NEW.email))
       or (type = 'domain' and lower(value) = v_domain)
  ) then
    NEW.approved := true;
  end if;

  return NEW;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: fires before each profile row is inserted
-- ─────────────────────────────────────────────────────────────────────────────
drop trigger if exists auto_approve_profile on profiles;

create trigger auto_approve_profile
  before insert on profiles
  for each row
  execute function apply_auto_approval();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Optional: bulk-approve existing pending users whose email/domain now matches
--    Run this once after loading your initial approved list to catch anyone
--    who registered before the trigger was set up.
-- ─────────────────────────────────────────────────────────────────────────────
update profiles p
set    approved = true
where  approved = false
  and exists (
    select 1 from auto_approved a
    where (a.type = 'email'  and lower(a.value) = lower(p.email))
       or (a.type = 'domain' and lower(a.value) = lower(split_part(p.email, '@', 2)))
  );
