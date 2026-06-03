-- ─────────────────────────────────────────────────────────────────────────────
-- credit-hire.ai — Diagnose & fix module_progress (Learn facility)
-- Run in Supabase SQL Editor: Database → SQL Editor → New query
--
-- SYMPTOM: Users who completed all modules are seeing zero progress.
-- CAUSE:   RLS policies on module_progress are missing or broken.
--          Supabase returns 0 rows (not an error) when no SELECT policy
--          matches, so the client thinks there's no progress.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1: DIAGNOSE — run this first to see current state
-- ══════════════════════════════════════════════════════════════════════════════

-- 1a. Check the table exists and has data
SELECT 'table_row_count' AS check, count(*) AS result FROM module_progress;

-- 1b. Check how many distinct users have progress
SELECT 'distinct_users' AS check, count(DISTINCT user_id) AS result FROM module_progress;

-- 1c. Check how many certificates have been earned
SELECT 'certificates_earned' AS check, count(*) AS result
FROM module_progress WHERE certificate_earned IS NOT NULL;

-- 1d. Show current RLS policies on module_progress
SELECT
  policyname,
  cmd,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE tablename = 'module_progress'
ORDER BY policyname;

-- 1e. Check if RLS is actually enabled
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname = 'module_progress';

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: FIX — re-apply correct RLS policies
-- ══════════════════════════════════════════════════════════════════════════════

-- 2a. Ensure RLS is enabled
ALTER TABLE module_progress ENABLE ROW LEVEL SECURITY;

-- 2b. Drop any existing policies (safe to re-run)
DROP POLICY IF EXISTS "Users can read own progress" ON module_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON module_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON module_progress;
DROP POLICY IF EXISTS "Admin can read all progress" ON module_progress;
DROP POLICY IF EXISTS "Authenticated users can read all progress" ON module_progress;

-- 2c. Recreate correct policies
-- ALL authenticated users can READ all rows (dashboard needs cross-user reads)
CREATE POLICY "Authenticated users can read all progress" ON module_progress
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can INSERT their own rows
CREATE POLICY "Users can insert own progress" ON module_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can UPDATE their own rows
CREATE POLICY "Users can update own progress" ON module_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3: VERIFY — confirm policies are correct
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  policyname,
  cmd,
  qual AS using_expr,
  with_check
FROM pg_policies
WHERE tablename = 'module_progress'
ORDER BY policyname;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 4: SPOT CHECK — show a sample of actual progress data
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  user_id,
  module_id,
  started,
  assessment_score,
  certificate_earned IS NOT NULL AS has_cert,
  jsonb_array_length(sections_complete) AS sections_done,
  updated_at
FROM module_progress
WHERE certificate_earned IS NOT NULL
ORDER BY updated_at DESC
LIMIT 20;
