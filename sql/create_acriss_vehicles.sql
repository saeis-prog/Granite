-- ─────────────────────────────────────────────────────────────────────────────
-- Granite — ACRISS Vehicle Lookup table
-- The ACRISS module reads from this table. It must exist AND be populated for
-- the lookup to return results. The vehicle rows currently live only in the
-- credit-hire.ai Supabase project — export them there and import here
-- (Supabase → Table Editor → Import, or a CSV/SQL dump).
-- Run in Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.acriss_vehicles (
  id              uuid default gen_random_uuid() primary key,
  manufacturer    text,
  model           text,
  year            integer,
  trim            text,
  descriptor      text,
  category        text,
  fuel_type       text,
  list_price      numeric,
  acriss_category text,
  acriss_type     text,
  acriss_fuel     text,
  acriss_code     text,
  seats           integer,
  doors           integer,
  bhp             integer
);

-- Helpful lookup indexes
create index if not exists acriss_vehicles_make_model_idx on public.acriss_vehicles (manufacturer, model);
create index if not exists acriss_vehicles_code_idx        on public.acriss_vehicles (acriss_code);

-- RLS: signed-in users may read the reference data (read-only for everyone authenticated)
alter table public.acriss_vehicles enable row level security;

drop policy if exists "Authenticated users can read acriss" on public.acriss_vehicles;
create policy "Authenticated users can read acriss" on public.acriss_vehicles
  for select to authenticated using (true);
