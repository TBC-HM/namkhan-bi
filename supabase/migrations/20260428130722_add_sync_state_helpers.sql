-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428130722
-- Name:    add_sync_state_helpers
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Track the last successful sync watermark per entity to enable incremental syncs
CREATE TABLE IF NOT EXISTS public.sync_watermarks (
  entity text PRIMARY KEY,
  last_synced_at timestamptz,
  last_cursor text,                -- pagination cursor or last id
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- Seed watermarks for existing entities
INSERT INTO public.sync_watermarks (entity, last_synced_at, metadata) VALUES
  ('hotels', NULL, '{"strategy":"full"}'),
  ('room_types', NULL, '{"strategy":"full"}'),
  ('rooms', NULL, '{"strategy":"full"}'),
  ('rate_plans', NULL, '{"strategy":"full"}'),
  ('rate_inventory', NULL, '{"strategy":"date_window","window_days":120}'),
  ('reservations', NULL, '{"strategy":"date_window_paged","window_days":1095}'),
  ('transactions', NULL, '{"strategy":"date_window","window_days":1095}'),
  ('guests', NULL, '{"strategy":"derived"}'),
  ('sources', NULL, '{"strategy":"full"}'),
  ('payment_methods', NULL, '{"strategy":"full"}'),
  ('item_categories', NULL, '{"strategy":"full"}'),
  ('items', NULL, '{"strategy":"full"}'),
  ('taxes_and_fees_config', NULL, '{"strategy":"full"}'),
  ('adjustments', NULL, '{"strategy":"per_reservation_recent"}'),
  ('tax_fee_records', NULL, '{"strategy":"per_reservation_recent"}'),
  ('add_ons', NULL, '{"strategy":"derived_from_transactions"}'),
  ('housekeeping_status', NULL, '{"strategy":"daily_snapshot"}'),
  ('market_segments', NULL, '{"strategy":"derived_from_reservations"}'),
  ('groups', NULL, '{"strategy":"full"}'),
  ('room_blocks', NULL, '{"strategy":"derived_from_groups"}'),
  ('house_accounts', NULL, '{"strategy":"full"}')
ON CONFLICT (entity) DO NOTHING;
