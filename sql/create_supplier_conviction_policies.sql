-- ══════════════════════════════════════════════════════════════════════════════
-- supplier_conviction_policies — Temporal database of rental supplier
-- conviction/endorsement acceptance policies, captured silently from
-- Arbitrate Direct report ingestions.
--
-- Each row = one supplier's conviction policy snapshot from one report.
-- Over time this builds a picture of how supplier policies evolve and
-- which endorsement codes they accept or reject.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supplier_conviction_policies (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  provider        TEXT NOT NULL DEFAULT 'arbitrate_direct',

  -- Report context
  report_date     TEXT,            -- Search Date from the report header
  hire_start_date TEXT,            -- On Hire Date from the report header
  vehicle_group   TEXT,            -- ABI GTA Group (e.g. "S5")
  search_location TEXT,            -- Claimant postcode used in the search

  -- Supplier details
  supplier_name   TEXT NOT NULL,   -- Display name (e.g. "Avis")
  supplier_id     TEXT NOT NULL,   -- Normalised key (e.g. "avis")
  branch          TEXT,            -- Branch cited in the report

  -- Conviction policy data
  raw_text        TEXT,            -- Raw extracted text from Convictions section (capped at 1000 chars)
  endorsement_codes TEXT[] DEFAULT '{}', -- Array of codes found (e.g. {"DR10","IN10","CD40"})
  disqualification_mentioned BOOLEAN DEFAULT FALSE,
  not_accepted    BOOLEAN DEFAULT FALSE,  -- Whether "Not Accepted" appeared

  -- Metadata
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying supplier policy history
CREATE INDEX idx_scp_supplier_id ON supplier_conviction_policies(supplier_id);
CREATE INDEX idx_scp_captured_at ON supplier_conviction_policies(captured_at DESC);
CREATE INDEX idx_scp_supplier_date ON supplier_conviction_policies(supplier_id, captured_at DESC);

-- GIN index for searching by endorsement codes
CREATE INDEX idx_scp_codes ON supplier_conviction_policies USING GIN(endorsement_codes);

-- RLS: users can only see their own submissions (admins via service role see all)
ALTER TABLE supplier_conviction_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conviction data"
  ON supplier_conviction_policies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert conviction data"
  ON supplier_conviction_policies FOR INSERT
  WITH CHECK (true);

-- Grant the service role full access (API endpoint uses service role key)
-- The anon role needs no access — all writes go through the API endpoint.

COMMENT ON TABLE supplier_conviction_policies IS
  'Temporal database of rental supplier conviction/endorsement policies captured from Arbitrate Direct reports. Each ingestion creates a snapshot per supplier.';
