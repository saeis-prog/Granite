-- Template Mismatch Alert Log
-- Run this in Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS template_alerts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider      TEXT NOT NULL,                    -- e.g. 'verirate', 'whichrate', 'arbitrate', 'bhrcompare'
  vehicle_type  TEXT,                             -- e.g. 'motorcycle', 'motor_car'
  witness_name  TEXT,                             -- Detected witness name
  mismatch_type TEXT NOT NULL,                    -- 'new_paragraph', 'modified_paragraph', 'missing_paragraph', 'extra_text'
  paragraph_id  TEXT,                             -- e.g. '5', '13', '2.3'
  section_id    TEXT,                             -- e.g. 'A', 'B', 'D'
  expected_text TEXT,                             -- First 200 chars of expected content_pattern
  actual_text   TEXT,                             -- First 500 chars of actual text found
  full_context  TEXT,                             -- Longer excerpt for review
  ingested_by   TEXT,                             -- User email if available
  source_file   TEXT,                             -- Original filename
  created_at    TIMESTAMPTZ DEFAULT now(),
  resolved      BOOLEAN DEFAULT false,
  resolved_at   TIMESTAMPTZ,
  resolved_by   TEXT,
  resolved_notes TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_template_alerts_provider ON template_alerts(provider);
CREATE INDEX IF NOT EXISTS idx_template_alerts_unresolved ON template_alerts(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_template_alerts_created ON template_alerts(created_at DESC);

-- RLS: allow authenticated users to read, only service role to insert
ALTER TABLE template_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read alerts"
  ON template_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert alerts"
  ON template_alerts FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update alerts"
  ON template_alerts FOR UPDATE
  TO service_role
  USING (true);

-- Also allow anon to insert (since the alert comes from the ingest page via API)
CREATE POLICY "Anon can insert via API"
  ON template_alerts FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated to update (for resolving alerts in admin)
CREATE POLICY "Authenticated can resolve alerts"
  ON template_alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
