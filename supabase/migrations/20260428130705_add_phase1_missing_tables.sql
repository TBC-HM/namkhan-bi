-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428130705
-- Name:    add_phase1_missing_tables
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================
-- Phase 1: Add 4 missing tables for Cloudbeds endpoints
-- All ADD-only. No drops, no alters of existing tables.
-- ============================================================

-- 1) payment_methods (from getPaymentMethods)
CREATE TABLE IF NOT EXISTS public.payment_methods (
  payment_method_id text PRIMARY KEY,
  property_id bigint REFERENCES public.hotels(property_id),
  name text NOT NULL,
  method_type text,            -- credit_card, cash, bank_transfer, etc.
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  raw jsonb,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_property ON public.payment_methods(property_id);

-- 2) item_categories (from getItemCategories)
CREATE TABLE IF NOT EXISTS public.item_categories (
  item_category_id text PRIMARY KEY,
  property_id bigint REFERENCES public.hotels(property_id),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  raw jsonb,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_item_categories_property ON public.item_categories(property_id);

-- 3) items (from getItems)
CREATE TABLE IF NOT EXISTS public.items (
  item_id text PRIMARY KEY,
  property_id bigint REFERENCES public.hotels(property_id),
  item_category_id text REFERENCES public.item_categories(item_category_id),
  name text NOT NULL,
  description text,
  unit_price numeric,
  currency text,
  is_active boolean DEFAULT true,
  is_taxable boolean,
  charge_type text,                -- per_night, per_stay, per_unit
  raw jsonb,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_property ON public.items(property_id);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(item_category_id);

-- 4) taxes_and_fees_config (master config; tax_fee_records stays as per-reservation)
CREATE TABLE IF NOT EXISTS public.taxes_and_fees_config (
  config_id text PRIMARY KEY,
  property_id bigint REFERENCES public.hotels(property_id),
  name text NOT NULL,
  kind text,                       -- 'tax' or 'fee'
  rate_pct numeric,
  flat_amount numeric,
  applied_to text,                 -- room_rate, items, etc.
  is_inclusive boolean,
  is_active boolean DEFAULT true,
  raw jsonb,
  synced_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_taxes_config_property ON public.taxes_and_fees_config(property_id);

-- ============================================================
-- Add unique constraints on existing empty tables that need them
-- so upserts can use ON CONFLICT
-- ============================================================

-- adjustments — primary key already on adjustment_id, OK
-- house_accounts — pkey on house_account_id, OK
-- groups — pkey on group_id, OK
-- market_segments — pkey on segment_id, OK
-- rate_plans — pkey on rate_id, OK
-- rate_inventory — already has unique on (property_id, room_type_id, rate_id, inventory_date), OK
-- housekeeping_status — already has unique on (property_id, room_id, snapshot_date), OK

-- room_blocks needs unique constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.room_blocks'::regclass 
      AND contype = 'u'
  ) THEN
    ALTER TABLE public.room_blocks
      ADD CONSTRAINT room_blocks_group_room_date_uq UNIQUE (group_id, room_type_id, block_date);
  END IF;
END$$;

-- add_ons needs unique constraint for idempotent upsert (line-item per reservation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.add_ons'::regclass 
      AND contype = 'u'
  ) THEN
    ALTER TABLE public.add_ons
      ADD CONSTRAINT add_ons_res_item_uq UNIQUE (reservation_id, item_name, posted_date);
  END IF;
END$$;

-- tax_fee_records needs unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.tax_fee_records'::regclass 
      AND contype = 'u'
  ) THEN
    ALTER TABLE public.tax_fee_records
      ADD CONSTRAINT tax_fee_records_uq UNIQUE (reservation_id, tax_or_fee_name, posted_date);
  END IF;
END$$;

-- Helpful index on transactions for reservation joins
CREATE INDEX IF NOT EXISTS idx_transactions_reservation 
  ON public.transactions(reservation_id) 
  WHERE reservation_id IS NOT NULL;

-- Helpful index on transactions by date range queries
CREATE INDEX IF NOT EXISTS idx_transactions_date 
  ON public.transactions(transaction_date) 
  WHERE transaction_date IS NOT NULL;
