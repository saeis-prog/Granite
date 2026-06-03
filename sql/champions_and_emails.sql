-- =============================================================================
-- BHR access expansion: dual champions per domain + per-individual approval
-- =============================================================================
-- Run this in the Supabase SQL Editor as the project owner.
--
-- What it does
--   1. Adds champion_email_2 / champion_name_2 columns to bhr_approved_domains
--      so a single firm can nominate up to two BHR champions.
--   2. Creates bhr_approved_emails — a per-individual allowlist used to grant
--      BHR Rebuttal access to specific people whose firm has NOT been approved
--      domain-wide (the "5 of 700" case). One or more of those individuals
--      can be flagged as a champion so the firm still receives changelog
--      notifications.
--   3. RLS aligned with the existing bhr_approved_domains policies: any
--      authenticated user can read (so the gate query works); only the admin
--      can insert / update / delete.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS; ALTER uses IF NOT EXISTS.
-- =============================================================================


-- ── 1. Dual champions per domain ────────────────────────────────────────────
ALTER TABLE bhr_approved_domains
  ADD COLUMN IF NOT EXISTS champion_email_2 TEXT,
  ADD COLUMN IF NOT EXISTS champion_name_2  TEXT;

COMMENT ON COLUMN bhr_approved_domains.champion_email_2 IS 'Optional second BHR champion at this firm — receives changelog notifications.';
COMMENT ON COLUMN bhr_approved_domains.champion_name_2  IS 'Optional second BHR champion display name.';


-- ── 2. Per-individual approval ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bhr_approved_emails (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,                -- lowercased on insert
  full_name     TEXT,
  company_name  TEXT,                                -- display name for the firm
  domain        TEXT,                                -- informational; the firm the user belongs to
  is_active     BOOLEAN NOT NULL DEFAULT true,       -- gate flag, mirrors bhr_approved_domains.is_active
  is_champion   BOOLEAN NOT NULL DEFAULT false,      -- true → also receives changelog notifications
  training_completed BOOLEAN NOT NULL DEFAULT false,
  training_date DATE,
  notes         TEXT,                                -- admin notes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE bhr_approved_emails IS
  'Per-individual BHR Rebuttal allowlist. Use to grant access to specific people whose firm has NOT been approved at the domain level. The BHR gate accepts the user if EITHER an email match here is_active OR their domain match in bhr_approved_domains is_active.';

-- Enforce lowercased emails so the gate query is consistent
CREATE INDEX IF NOT EXISTS idx_bhr_emails_email_lower ON bhr_approved_emails (lower(email));
CREATE INDEX IF NOT EXISTS idx_bhr_emails_champion ON bhr_approved_emails (is_champion) WHERE is_champion = true;


-- ── 3. updated_at trigger (reuses existing function) ────────────────────────
DROP TRIGGER IF EXISTS bhr_approved_emails_updated_at ON bhr_approved_emails;
CREATE TRIGGER bhr_approved_emails_updated_at
  BEFORE UPDATE ON bhr_approved_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 4. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE bhr_approved_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read approved emails" ON bhr_approved_emails;
CREATE POLICY "Authenticated can read approved emails"
  ON bhr_approved_emails FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin manages approved emails" ON bhr_approved_emails;
CREATE POLICY "Admin manages approved emails"
  ON bhr_approved_emails FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'sae@credithire.org.uk')
  WITH CHECK (auth.jwt() ->> 'email' = 'sae@credithire.org.uk');


-- ── 5. Convenience view for notifications ───────────────────────────────────
-- Returns every email that should receive changelog notifications, drawn
-- from BOTH approval mechanisms. Used by api/changelog-notify.js.
CREATE OR REPLACE VIEW bhr_notification_recipients AS
  SELECT champion_email AS email, champion_name AS name, company_name, 'domain-champion-1' AS source
    FROM bhr_approved_domains
    WHERE is_active = true AND champion_email IS NOT NULL AND champion_email <> ''
  UNION
  SELECT champion_email_2 AS email, champion_name_2 AS name, company_name, 'domain-champion-2' AS source
    FROM bhr_approved_domains
    WHERE is_active = true AND champion_email_2 IS NOT NULL AND champion_email_2 <> ''
  UNION
  SELECT email, full_name AS name, company_name, 'individual-champion' AS source
    FROM bhr_approved_emails
    WHERE is_active = true AND is_champion = true AND email IS NOT NULL AND email <> '';

COMMENT ON VIEW bhr_notification_recipients IS
  'Unified list of changelog notification recipients. Source column identifies which approval mechanism the recipient came from.';

-- Allow the service role (used by the changelog-notify endpoint) to read it.
GRANT SELECT ON bhr_notification_recipients TO anon, authenticated, service_role;


-- =============================================================================
-- Quick sanity checks (run after the migration)
-- =============================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'bhr_approved_domains'
--     AND column_name IN ('champion_email_2', 'champion_name_2');
--
-- SELECT * FROM bhr_approved_emails LIMIT 1;
--
-- SELECT * FROM bhr_notification_recipients;
