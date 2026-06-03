-- ─────────────────────────────────────────────────────────────────────────────
-- credit-hire.ai — Fix module_progress RLS + create table if missing
-- Run this in the Supabase SQL Editor (Database → SQL Editor → New query)
--
-- PROBLEM: The dashboard shows 0 learners despite 412 Learn page visits.
-- ROOT CAUSE: Either the module_progress table doesn't exist, or its RLS
-- policies prevent the admin from reading other users' progress rows.
-- The saveProgress() upsert in learn.html may also be silently failing
-- if the RLS insert/update policies are missing or misconfigured.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS module_progress (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL,
  module_id         text        NOT NULL,
  started           boolean     DEFAULT false,
  sections_complete jsonb       DEFAULT '[]'::jsonb,
  assessment_score  integer     DEFAULT 0,
  certificate_earned jsonb,
  updated_at        timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),
  UNIQUE (user_id, module_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS module_progress_user_idx ON module_progress (user_id);
CREATE INDEX IF NOT EXISTS module_progress_module_idx ON module_progress (module_id);

-- 3. Enable RLS
ALTER TABLE module_progress ENABLE ROW LEVEL SECURITY;

-- 4. Drop any existing policies (safe to re-run)
DROP POLICY IF EXISTS "Users can read own progress" ON module_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON module_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON module_progress;
DROP POLICY IF EXISTS "Admin can read all progress" ON module_progress;
DROP POLICY IF EXISTS "Authenticated users can read all progress" ON module_progress;

-- 5. Policies — users can CRUD their own rows, all authenticated users can READ all rows
--    (the dashboard enforces admin-only access client-side via email check)

-- Any authenticated user can read all progress (needed for dashboard analytics)
CREATE POLICY "Authenticated users can read all progress" ON module_progress
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress" ON module_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update own progress" ON module_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Verify
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'module_progress'
ORDER BY policyname;
