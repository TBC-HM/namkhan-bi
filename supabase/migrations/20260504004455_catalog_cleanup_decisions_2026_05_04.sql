-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504004455
-- Name:    catalog_cleanup_decisions_2026_05_04
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Catalog cleanup decisions log.
-- Records the F&B manager's call on each dirty SKU surfaced by v_catalog_dirty.
-- The DB doesn't apply the decision automatically (source is Cloudbeds);
-- this is a queue of what-to-do that the operator works through.

CREATE TABLE IF NOT EXISTS public.catalog_cleanup_decisions (
  id                    bigserial PRIMARY KEY,
  -- SKU identity (matches v_catalog_dirty grain)
  description           text   NOT NULL,
  item_category_name    text,                          -- nullable; matches v_catalog_dirty
  -- Decision
  action_type           text   NOT NULL CHECK (action_type IN (
                          'merge_into',           -- duplicate of another SKU; merge in Cloudbeds
                          'split_variants',       -- slash/multi-variant name; needs to become N SKUs
                          'set_usali',            -- override USALI dept/subdept (rule-map fix)
                          'rename',               -- rename in Cloudbeds (add duration, fix typo)
                          'set_price',            -- the SKU is right but price was rung wrong
                          'set_category',         -- add item_category_name in Cloudbeds
                          'dismiss',              -- accept the flag, no action needed
                          'todo'                  -- noted but no decision yet
                        )),
  target_description    text,                          -- for merge_into / rename: target SKU name
  target_usali_dept     text,                          -- for set_usali
  target_usali_subdept  text,                          -- for set_usali
  target_category       text,                          -- for set_category
  target_price_usd      numeric(12, 2),                -- for set_price
  notes                 text,                          -- free-form decision context
  -- Workflow
  status                text   NOT NULL DEFAULT 'open' CHECK (status IN (
                          'open',                 -- decision recorded, action not yet applied
                          'applied',              -- F&B manager applied the change in Cloudbeds
                          'rejected'              -- decision reversed
                        )),
  decided_at            timestamptz NOT NULL DEFAULT NOW(),
  decided_by            text,
  applied_at            timestamptz,
  -- Idempotency: one open decision per (description, item_category_name)
  CONSTRAINT catalog_cleanup_uniq UNIQUE (description, item_category_name, status)
);

CREATE INDEX IF NOT EXISTS idx_catalog_cleanup_status ON public.catalog_cleanup_decisions (status);
CREATE INDEX IF NOT EXISTS idx_catalog_cleanup_action ON public.catalog_cleanup_decisions (action_type);
CREATE INDEX IF NOT EXISTS idx_catalog_cleanup_desc   ON public.catalog_cleanup_decisions (description);

GRANT SELECT, INSERT, UPDATE ON public.catalog_cleanup_decisions      TO authenticated, service_role;
GRANT USAGE, SELECT          ON public.catalog_cleanup_decisions_id_seq TO authenticated, service_role;

COMMENT ON TABLE public.catalog_cleanup_decisions IS
  'F&B manager decisions on dirty SKUs surfaced by v_catalog_dirty. One row per (description, item_category_name, status). DB does not auto-apply — manager works through the open queue and marks applied after fixing in Cloudbeds.';
