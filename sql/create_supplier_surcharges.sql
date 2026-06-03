-- ══════════════════════════════════════════════════════════════════════════════
-- supplier_surcharges — Temporal database of rental supplier surcharge
-- policies (young driver and additional driver), captured silently from
-- BHR Compare report ingestions.
--
-- Each row = one supplier's surcharge policy snapshot from one report.
-- Over time this builds a picture of how supplier surcharge policies
-- evolve and what they charge.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supplier_surcharges (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  provider        TEXT NOT NULL DEFAULT 'bhr_compare',

  -- Report context
  report_date     TEXT,            -- Date from the report header
  hire_start_date TEXT,            -- Hire Start from the report header
  vehicle_group   TEXT,            -- ABI GTA Group (e.g. "P3")
  search_location TEXT,            -- Claimant postcode used in the search

  -- Supplier details
  supplier_name   TEXT NOT NULL,   -- Display name (e.g. "Avis")
  supplier_id     TEXT NOT NULL,   -- Normalised key (e.g. "avis")

  -- Surcharge type
  surcharge_type  TEXT NOT NULL,   -- 'young_driver' or 'additional_driver'

  -- Young driver fields
  min_age         INTEGER,         -- Minimum hire age
  age_from        INTEGER,         -- Surcharge applies from this age
  age_to          INTEGER,         -- Surcharge applies to this age
  daily_surcharge TEXT,            -- Daily surcharge amount (e.g. "32.50")
  surcharge_max   TEXT,            -- Maximum daily surcharge if range (e.g. "37.70")
  cap_days        INTEGER,         -- Max days surcharge applies (e.g. 10)
  cap_amount      TEXT,            -- Maximum total surcharge amount
  categories      TEXT,            -- Applicable vehicle categories/groups
  not_applicable  BOOLEAN DEFAULT FALSE,  -- Whether surcharge is N/A for this supplier

  -- Additional driver fields
  daily_charge    TEXT,            -- Daily charge for additional driver
  alt_rate        TEXT,            -- Alternative rate (e.g. airport/premium locations)
  alt_rate_note   TEXT,            -- Note about alternative rate

  -- Raw text
  raw_text        TEXT,            -- Raw extracted text (capped at 500 chars)

  -- Metadata
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying supplier surcharge history
CREATE INDEX idx_ss_supplier_id ON supplier_surcharges(supplier_id);
CREATE INDEX idx_ss_captured_at ON supplier_surcharges(captured_at DESC);
CREATE INDEX idx_ss_supplier_type ON supplier_surcharges(supplier_id, surcharge_type);
CREATE INDEX idx_ss_type ON supplier_surcharges(surcharge_type);

-- RLS: users can only see their own submissions (admins via service role see all)
ALTER TABLE supplier_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own surcharge data"
  ON supplier_surcharges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert surcharge data"
  ON supplier_surcharges FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE supplier_surcharges IS
  'Temporal database of rental supplier surcharge policies (young driver, additional driver) captured from BHR Compare reports. Each ingestion creates a snapshot per supplier per surcharge type.';
