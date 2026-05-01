-- =====================================================================
-- Migration: phase2_02_dmc_reconciliation
-- Purpose:   Human-in-the-loop mapping of Cloudbeds reservations to DMC
--            partners. Rate plan = gate ("is this a DMC booking?"),
--            human + hints = answer ("which DMC?").
-- Schema:    governance + public extensions
-- Author:    COI / Paul Bauer
-- Date:      2026-05-01
-- Depends on: phase2_00_dmc_contracts, public.reservations (existing)
-- =====================================================================

-- 1. Cloudbeds sources mirror ----------------------------------------------
-- Pulled from /getSources API. Read-only sync, refreshed daily.
CREATE TABLE governance.cloudbeds_sources_mirror (
  source_id              text PRIMARY KEY,                            -- e.g. 's-47'
  source_name            text NOT NULL,                               -- 'Asian Trails Laos'
  source_type            text,                                        -- 'wholesaler', 'travel_agent', 'corporate', 'ota', 'primary'
  is_third_party         boolean DEFAULT true,
  commission_pct         numeric(5,2),                                -- internal accounting only, NOT sent to channels
  is_active              boolean DEFAULT true,
  last_synced_at         timestamptz DEFAULT now(),
  notes                  text
);

COMMENT ON TABLE governance.cloudbeds_sources_mirror IS
  'Mirror of Cloudbeds /getSources. Refreshed daily. Used for partner mapping suggestions.';

-- 2. Cloudbeds rate plans flagged as DMC ----------------------------------
-- The "Leisure Partnership Agreement" rate plan + any other rate plans
-- the property uses to gate DMC bookings.
CREATE TABLE governance.dmc_rate_plan_filters (
  filter_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_name_pattern text NOT NULL,                               -- ILIKE pattern e.g. '%Leisure Partnership%'
  rate_plan_id_cloudbeds text,                                        -- exact ID if known
  is_active              boolean DEFAULT true,
  notes                  text,
  created_at             timestamptz DEFAULT now()
);

-- Seed with the known LPA rate plan
INSERT INTO governance.dmc_rate_plan_filters (rate_plan_name_pattern, notes)
VALUES
  ('%Leisure Partnership%', 'Standard Namkhan LPA rate plan — every DMC booking should use this'),
  ('%LPA%',                 'Short-form fallback'),
  ('%Wholesale%',            'Catch-all for legacy bookings tagged Wholesale rate plan');

-- 3. Reservation → partner mapping ----------------------------------------
-- One row per RESERVATION that needs/has been mapped to a DMC partner.
-- Created automatically when a reservation matches an active filter.
CREATE TABLE governance.dmc_reservation_mapping (
  mapping_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id         text NOT NULL UNIQUE,                        -- Cloudbeds reservationID
  detected_at            timestamptz DEFAULT now(),
  rate_plan_name         text,                                        -- captured at detection time
  cloudbeds_source_id    text,                                        -- captured at detection time
  cloudbeds_source_name  text,
  guest_email            text,
  guest_name             text,
  third_party_identifier text,                                        -- voucher code / DMC ref
  -- Mapping result
  contract_id            uuid REFERENCES governance.dmc_contracts(contract_id),
  mapping_status         text NOT NULL DEFAULT 'unmapped' CHECK (mapping_status IN
                          ('unmapped','suggested','mapped_human','mapped_auto','rejected_not_dmc')),
  mapping_confidence     numeric(3,2),                                -- 0.00–1.00, only for suggested/mapped_auto
  mapping_method         text CHECK (mapping_method IN
                          ('manual','source_match','email_hint','voucher_hint','name_hint','combined_hints','rejected')),
  mapped_by              uuid REFERENCES auth.users,
  mapped_at              timestamptz,
  rejected_reason        text,                                        -- 'not actually DMC, was direct booking'
  notes                  text,
  -- Audit
  updated_at             timestamptz DEFAULT now()
);

CREATE INDEX idx_dmc_mapping_status      ON governance.dmc_reservation_mapping(mapping_status);
CREATE INDEX idx_dmc_mapping_contract    ON governance.dmc_reservation_mapping(contract_id);
CREATE INDEX idx_dmc_mapping_reservation ON governance.dmc_reservation_mapping(reservation_id);

COMMENT ON TABLE governance.dmc_reservation_mapping IS
  'One row per reservation flagged as DMC (matches dmc_rate_plan_filters). Reservations agent maps each to a contract.';

-- 4. Self-improving hints table -------------------------------------------
-- Every time a human maps a reservation, learn from it.
-- Hints are matched on future detections to suggest partners automatically.
CREATE TABLE governance.partner_mapping_hints (
  hint_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id            uuid NOT NULL REFERENCES governance.dmc_contracts(contract_id) ON DELETE CASCADE,
  hint_type              text NOT NULL CHECK (hint_type IN
                          ('email_domain','email_full','source_id','source_name','voucher_prefix','guest_name_pattern','third_party_id_prefix')),
  hint_value             text NOT NULL,                               -- e.g. 'asiantrailslaos.com', 's-47', 'AT-VCH-'
  -- Tracking accuracy
  times_matched          int DEFAULT 0,                               -- how often this hint matched a future res
  times_correct          int DEFAULT 0,                               -- how often the human confirmed it
  times_rejected         int DEFAULT 0,                               -- how often the human said "no, different partner"
  confidence_score       numeric(3,2) GENERATED ALWAYS AS (
                           CASE WHEN times_matched = 0 THEN 0.5
                                ELSE round(times_correct::numeric / times_matched::numeric, 2)
                           END
                         ) STORED,
  is_active              boolean DEFAULT true,
  -- Audit
  created_at             timestamptz DEFAULT now(),
  created_by             uuid REFERENCES auth.users,                  -- human or service account
  last_used_at           timestamptz,
  notes                  text,
  UNIQUE (contract_id, hint_type, hint_value)
);

CREATE INDEX idx_hints_type_value ON governance.partner_mapping_hints(hint_type, hint_value) WHERE is_active;

COMMENT ON TABLE governance.partner_mapping_hints IS
  'Self-improving mapping rules. Each manual mapping generates hints. Future bookings matched against hints to auto-suggest.';

-- 5. Seed initial hints for the 5 known DMCs ------------------------------
-- Generated from data already in dmc_contracts seed.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT contract_id, contact_email, partner_short_name FROM governance.dmc_contracts WHERE contact_email IS NOT NULL LOOP
    -- Email domain hint
    INSERT INTO governance.partner_mapping_hints (contract_id, hint_type, hint_value, notes)
    VALUES (c.contract_id, 'email_domain', split_part(c.contact_email, '@', 2),
            'Auto-seeded from contract contact email')
    ON CONFLICT DO NOTHING;
    -- Full email hint (higher confidence)
    INSERT INTO governance.partner_mapping_hints (contract_id, hint_type, hint_value, notes)
    VALUES (c.contract_id, 'email_full', c.contact_email,
            'Auto-seeded — exact contact email match')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 6. Useful views ----------------------------------------------------------

-- The reconciliation queue — shown to reservations agent
CREATE OR REPLACE VIEW governance.v_dmc_reconciliation_queue AS
SELECT
  m.mapping_id,
  m.reservation_id,
  m.detected_at,
  m.rate_plan_name,
  m.cloudbeds_source_name,
  m.guest_email,
  m.guest_name,
  m.third_party_identifier,
  m.mapping_status,
  m.mapping_confidence,
  m.contract_id AS suggested_contract_id,
  c.partner_short_name AS suggested_partner_name,
  -- Age in queue
  EXTRACT(EPOCH FROM (now() - m.detected_at)) / 3600 AS hours_in_queue
FROM governance.dmc_reservation_mapping m
LEFT JOIN governance.dmc_contracts c ON c.contract_id = m.contract_id
WHERE m.mapping_status IN ('unmapped','suggested')
ORDER BY m.detected_at DESC;

-- DMC performance — only counts mapped reservations
CREATE OR REPLACE VIEW governance.v_dmc_performance AS
SELECT
  c.contract_id,
  c.partner_short_name,
  COUNT(DISTINCT m.reservation_id) FILTER (WHERE m.mapping_status IN ('mapped_human','mapped_auto')) AS mapped_reservations_count,
  COUNT(DISTINCT m.reservation_id) FILTER (WHERE m.mapping_status = 'unmapped')                       AS unmapped_pending_count
FROM governance.dmc_contracts c
LEFT JOIN governance.dmc_reservation_mapping m ON m.contract_id = c.contract_id
WHERE c.status = 'active'
GROUP BY c.contract_id, c.partner_short_name;

-- Hint accuracy leaderboard — diagnostic
CREATE OR REPLACE VIEW governance.v_hint_accuracy AS
SELECT
  c.partner_short_name,
  h.hint_type,
  h.hint_value,
  h.times_matched,
  h.times_correct,
  h.times_rejected,
  h.confidence_score,
  h.last_used_at
FROM governance.partner_mapping_hints h
JOIN governance.dmc_contracts c ON c.contract_id = h.contract_id
WHERE h.is_active
ORDER BY h.confidence_score DESC, h.times_matched DESC;

-- 7. RLS ------------------------------------------------------------------
ALTER TABLE governance.cloudbeds_sources_mirror      ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.dmc_rate_plan_filters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.dmc_reservation_mapping       ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.partner_mapping_hints         ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated
CREATE POLICY cb_sources_read       ON governance.cloudbeds_sources_mirror      FOR SELECT TO authenticated USING (true);
CREATE POLICY filters_read          ON governance.dmc_rate_plan_filters         FOR SELECT TO authenticated USING (true);
CREATE POLICY mapping_read          ON governance.dmc_reservation_mapping       FOR SELECT TO authenticated USING (true);
CREATE POLICY hints_read            ON governance.partner_mapping_hints         FOR SELECT TO authenticated USING (true);

-- Write: top-level OR reservations role (mapping is the reservations team's daily job)
-- Assuming a 'reservations' role exists; if not, fallback to top_level.
CREATE POLICY cb_sources_write      ON governance.cloudbeds_sources_mirror      FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY filters_write         ON governance.dmc_rate_plan_filters         FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());
CREATE POLICY mapping_write         ON governance.dmc_reservation_mapping       FOR ALL TO authenticated USING (app.is_top_level() OR app.has_role('reservations')) WITH CHECK (app.is_top_level() OR app.has_role('reservations'));
CREATE POLICY hints_write           ON governance.partner_mapping_hints         FOR ALL TO authenticated USING (app.is_top_level() OR app.has_role('reservations')) WITH CHECK (app.is_top_level() OR app.has_role('reservations'));

-- 8. Triggers --------------------------------------------------------------
CREATE TRIGGER dmc_mapping_updated_at
  BEFORE UPDATE ON governance.dmc_reservation_mapping
  FOR EACH ROW EXECUTE FUNCTION governance.tg_set_updated_at();

-- 9. Detection function — call from agent_orchestrator or scheduled job ---
-- Scans new reservations, creates mapping rows for any matching a DMC filter.
CREATE OR REPLACE FUNCTION governance.detect_dmc_reservations(since_ts timestamptz DEFAULT now() - INTERVAL '1 day')
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count int := 0;
BEGIN
  INSERT INTO governance.dmc_reservation_mapping
    (reservation_id, rate_plan_name, cloudbeds_source_id, cloudbeds_source_name,
     guest_email, guest_name, third_party_identifier, mapping_status)
  SELECT
    r.reservation_id,
    r.rate_plan_name,
    r.source_id,
    r.source_name,
    r.guest_email,
    r.guest_name,
    r.third_party_identifier,
    'unmapped'
  FROM public.reservations r
  WHERE r.created_at >= since_ts
    AND EXISTS (
      SELECT 1 FROM governance.dmc_rate_plan_filters f
      WHERE f.is_active
        AND r.rate_plan_name ILIKE f.rate_plan_name_pattern
    )
    AND NOT EXISTS (
      SELECT 1 FROM governance.dmc_reservation_mapping m
      WHERE m.reservation_id = r.reservation_id
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END $$;

COMMENT ON FUNCTION governance.detect_dmc_reservations IS
  'Detects new reservations using DMC-flagged rate plans and creates mapping queue entries. Run hourly via cron or webhook.';

-- 10. Suggestion function — runs hint matching to pre-fill suggestions ---
CREATE OR REPLACE FUNCTION governance.suggest_dmc_partner(p_mapping_id uuid)
RETURNS TABLE (contract_id uuid, partner_short_name text, confidence numeric, matched_hints text[])
LANGUAGE plpgsql
AS $$
DECLARE
  m RECORD;
  email_dom text;
BEGIN
  SELECT * INTO m FROM governance.dmc_reservation_mapping WHERE mapping_id = p_mapping_id;
  email_dom := split_part(m.guest_email, '@', 2);

  RETURN QUERY
  SELECT
    h.contract_id,
    c.partner_short_name,
    AVG(h.confidence_score)::numeric(3,2) AS confidence,
    array_agg(h.hint_type || '=' || h.hint_value) AS matched_hints
  FROM governance.partner_mapping_hints h
  JOIN governance.dmc_contracts c ON c.contract_id = h.contract_id
  WHERE h.is_active
    AND (
         (h.hint_type = 'email_full'        AND h.hint_value = m.guest_email)
      OR (h.hint_type = 'email_domain'      AND h.hint_value = email_dom)
      OR (h.hint_type = 'source_id'         AND h.hint_value = m.cloudbeds_source_id)
      OR (h.hint_type = 'source_name'       AND h.hint_value = m.cloudbeds_source_name)
      OR (h.hint_type = 'voucher_prefix'    AND m.third_party_identifier ILIKE h.hint_value || '%')
      OR (h.hint_type = 'third_party_id_prefix' AND m.third_party_identifier ILIKE h.hint_value || '%')
    )
  GROUP BY h.contract_id, c.partner_short_name
  ORDER BY confidence DESC;
END $$;

COMMENT ON FUNCTION governance.suggest_dmc_partner IS
  'Returns ranked partner suggestions for an unmapped reservation, based on partner_mapping_hints.';

-- =====================================================================
-- END migration phase2_02
-- =====================================================================
