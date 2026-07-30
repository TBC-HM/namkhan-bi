-- db/proposed/build-forecasting/001_forecast_learning_journal.sql
-- PROPOSAL ONLY — NOT APPLIED. Requires PBS approval before any DDL
-- (project rule 4; every CREATE is event-trigger logged).
--
-- Brief forecasting-module-v1, BINDING rule 1: the learning loop
-- (forecast → actual → variance → classification → reason → lesson) is an
-- APPEND-ONLY generalized learning journal in the database — explicitly NOT
-- a RevenueLearning.md document. v_forecast_vs_actual already scores every
-- run mechanically; this table adds the classified "why" and the lesson,
-- written per completed period (by humans or, later, the v2 Learning agent).
--
-- Placement: plan schema (sibling of plan.otb_snapshots / forecast run
-- storage). PostgREST bridge via public view (claude_md §0.5).

BEGIN;

CREATE TABLE plan.forecast_learning_journal (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id      integer      NOT NULL,              -- 260955 Namkhan · 1000001 Donna
  period_start     date         NOT NULL,              -- completed period covered
  period_end       date         NOT NULL,
  grain            text         NOT NULL DEFAULT 'month'
                     CHECK (grain IN ('day','week','month')),
  -- Forecast vs reality (USALI metric names; PMS/transaction currency)
  metric           text         NOT NULL
                     CHECK (metric IN ('occupancy_pct','adr','revpar','rooms_revenue','rooms_sold')),
  forecast_value   numeric      NOT NULL,
  actual_value     numeric      NOT NULL,
  variance_value   numeric      GENERATED ALWAYS AS (actual_value - forecast_value) STORED,
  variance_pct     numeric,                            -- vs forecast, null when forecast=0
  within_band      boolean,                            -- landed inside p10–p90?
  -- The learning (append-only; corrections are new rows referencing old)
  classification   text         NOT NULL
                     CHECK (classification IN
                       ('model_error','data_gap','demand_shock','cancellation_event',
                        'compset_move','event_calendar','channel_shift','other')),
  reason           text         NOT NULL,              -- why the variance happened
  lesson           text         NOT NULL,              -- what changes next time
  engine_method    text,                               -- method string of the scored run
  supersedes_id    bigint       REFERENCES plan.forecast_learning_journal(id),
  created_by       text         NOT NULL DEFAULT 'human', -- 'human' | agent handle
  created_at       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT flj_period_valid CHECK (period_end >= period_start)
);

COMMENT ON TABLE plan.forecast_learning_journal IS
  'Append-only forecast learning loop (forecasting-module-v1 rule 1): forecast vs actual vs variance vs lesson per completed period. Never UPDATE/DELETE — supersede with a new row.';

CREATE INDEX flj_property_period_idx
  ON plan.forecast_learning_journal (property_id, period_start DESC);

-- Append-only enforcement (same pattern as other journal tables).
REVOKE UPDATE, DELETE ON plan.forecast_learning_journal FROM PUBLIC;

-- PostgREST bridge (claude_md §0.5): public schema only is exposed.
CREATE VIEW public.v_forecast_learning_journal AS
  SELECT id, property_id, period_start, period_end, grain, metric,
         forecast_value, actual_value, variance_value, variance_pct,
         within_band, classification, reason, lesson, engine_method,
         supersedes_id, created_by, created_at
  FROM plan.forecast_learning_journal;

GRANT SELECT ON public.v_forecast_learning_journal TO anon, authenticated, service_role;

COMMIT;
