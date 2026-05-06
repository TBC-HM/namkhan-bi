-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503151727
-- Name:    rate_shop_competitor_rates_columns
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Add scraping context, geo, room match, FX trail, and governance link to competitor_rates
ALTER TABLE revenue.competitor_rates
  ADD COLUMN IF NOT EXISTS los_nights smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS geo_market text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS room_type text,
  ADD COLUMN IF NOT EXISTS is_refundable boolean,
  ADD COLUMN IF NOT EXISTS mealplan text,
  ADD COLUMN IF NOT EXISTS scrape_status text DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS fx_rate_to_usd numeric,
  ADD COLUMN IF NOT EXISTS native_currency text,
  ADD COLUMN IF NOT EXISTS native_rate numeric,
  ADD COLUMN IF NOT EXISTS agent_run_id uuid;

-- Status check constraint (separate ALTER to allow IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitor_rates_scrape_status_check'
  ) THEN
    ALTER TABLE revenue.competitor_rates
      ADD CONSTRAINT competitor_rates_scrape_status_check
      CHECK (scrape_status IN ('success','no_availability','blocked','parse_error','timeout','captcha','rate_limited'));
  END IF;
END$$;

-- Channel constraint to prevent fragmented values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitor_rates_channel_check'
  ) THEN
    ALTER TABLE revenue.competitor_rates
      ADD CONSTRAINT competitor_rates_channel_check
      CHECK (channel IN ('booking','agoda','expedia','trip','direct','google','hotels_com'));
  END IF;
END$$;

-- Geo market constraint (ISO 3166-1 alpha-2 — agent enforces uppercase)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitor_rates_geo_market_check'
  ) THEN
    ALTER TABLE revenue.competitor_rates
      ADD CONSTRAINT competitor_rates_geo_market_check
      CHECK (geo_market ~ '^[A-Z]{2}$');
  END IF;
END$$;

-- FK to governance.agent_runs (agent_runs primary key is run_id per existing convention)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'competitor_rates_agent_run_id_fkey'
  ) THEN
    ALTER TABLE revenue.competitor_rates
      ADD CONSTRAINT competitor_rates_agent_run_id_fkey
      FOREIGN KEY (agent_run_id) REFERENCES governance.agent_runs(run_id) ON DELETE SET NULL;
  END IF;
END$$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_comp_rates_stay_shop
  ON revenue.competitor_rates (stay_date, shop_date DESC);

CREATE INDEX IF NOT EXISTS idx_comp_rates_comp_channel
  ON revenue.competitor_rates (comp_id, channel, stay_date);

CREATE INDEX IF NOT EXISTS idx_comp_rates_agent_run
  ON revenue.competitor_rates (agent_run_id);

-- Unique constraint to prevent duplicate scrapes of the same cell
CREATE UNIQUE INDEX IF NOT EXISTS uq_comp_rates_cell
  ON revenue.competitor_rates (comp_id, stay_date, shop_date, channel, los_nights, geo_market, COALESCE(mealplan,''), COALESCE(is_refundable::text,''));

COMMENT ON COLUMN revenue.competitor_rates.agent_run_id IS 'Links rate row to governance.agent_runs entry that created it. Enables full audit trail.';
COMMENT ON COLUMN revenue.competitor_rates.scrape_status IS 'Distinguishes real no-availability from technical failures. Critical for data quality.';
COMMENT ON COLUMN revenue.competitor_rates.geo_market IS 'ISO 3166-1 alpha-2 country code of the proxy IP used to scrape.';
COMMENT ON COLUMN revenue.competitor_rates.fx_rate_to_usd IS 'FX rate used to convert native_rate to rate_usd at scrape time. Snapshot for audit.';
