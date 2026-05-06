-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213251
-- Name:    retreat_compiler_book_rpcs_rls
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS book.bookings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retreat_slug      text NOT NULL,
  variant_id        uuid REFERENCES compiler.variants(id) ON DELETE SET NULL,
  public_token      text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  guest_first_name  text NOT NULL,
  guest_last_name   text NOT NULL,
  guest_email       text NOT NULL,
  guest_phone       text,
  guest_country     text,
  party_size        int NOT NULL,
  arrival_date      date NOT NULL,
  departure_date    date NOT NULL,
  nights            int GENERATED ALWAYS AS ((departure_date - arrival_date)::int) STORED,
  config_jsonb      jsonb NOT NULL DEFAULT '{}',
  config_total_usd  numeric,
  config_source     text CHECK (config_source IN ('default','guest_custom','operator_preload')) DEFAULT 'default',
  config_share_token text UNIQUE,
  add_ons_jsonb     jsonb DEFAULT '[]',
  special_requests  text,
  total_usd         numeric NOT NULL,
  deposit_usd       numeric NOT NULL,
  balance_usd       numeric NOT NULL,
  deposit_paid_usd  numeric NOT NULL DEFAULT 0,
  balance_paid_usd  numeric NOT NULL DEFAULT 0,
  balance_due_date  date,
  fx_rate_at_book   numeric,
  fx_lock_id        uuid REFERENCES pricing.fx_locks(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_session_id text,
  cloudbeds_reservation_id text,
  status            text NOT NULL CHECK (status IN ('held','confirmed','deposit_paid','paid_full','cancelled','refunded','no_show')) DEFAULT 'held',
  cancellation_reason text,
  cancelled_at      timestamptz,
  source_campaign_id uuid REFERENCES web.campaigns(id) ON DELETE SET NULL,
  referrer_url      text,
  utm_jsonb         jsonb DEFAULT '{}',
  ip_hash           text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK(departure_date >= arrival_date),
  CHECK(party_size > 0)
);
DROP TRIGGER IF EXISTS set_book_bookings_updated_at ON book.bookings;
CREATE TRIGGER set_book_bookings_updated_at BEFORE UPDATE ON book.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE INDEX IF NOT EXISTS idx_book_bookings_token ON book.bookings(public_token);
CREATE INDEX IF NOT EXISTS idx_book_bookings_email ON book.bookings(guest_email, status);
CREATE INDEX IF NOT EXISTS idx_book_bookings_status ON book.bookings(status, arrival_date);
CREATE INDEX IF NOT EXISTS idx_book_bookings_retreat ON book.bookings(retreat_slug, arrival_date);

CREATE TABLE IF NOT EXISTS book.payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES book.bookings(id) ON DELETE RESTRICT,
  stripe_event_id   text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  amount_usd        numeric NOT NULL,
  fee_usd           numeric DEFAULT 0,
  net_usd           numeric,
  payment_type      text NOT NULL CHECK (payment_type IN ('deposit','balance','addon','refund')),
  status            text NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  scheduled_for     timestamptz,
  processed_at      timestamptz,
  raw_payload       jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_book_payments_booking ON book.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_book_payments_scheduled ON book.payments(scheduled_for) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS book.cancellations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid NOT NULL REFERENCES book.bookings(id) ON DELETE CASCADE,
  cancelled_by      text NOT NULL CHECK (cancelled_by IN ('guest','host','system')),
  days_before_arrival int,
  refund_pct        int,
  refund_amount_usd numeric,
  reason_code       text,
  reason_notes      text,
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS book.reconcile_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        uuid REFERENCES book.bookings(id) ON DELETE SET NULL,
  alert_type        text NOT NULL CHECK (alert_type IN ('cb_missing','cb_mismatch','stripe_missing','total_mismatch','date_mismatch')),
  details_jsonb     jsonb,
  resolved_at       timestamptz,
  resolved_by       uuid,
  resolution_notes  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_book_reconcile_open ON book.reconcile_alerts(created_at DESC) WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION web.capture_lead(
  p_email text, p_first_name text DEFAULT NULL, p_country text DEFAULT NULL,
  p_source_page_id uuid DEFAULT NULL, p_consents text[] DEFAULT ARRAY['marketing']::text[],
  p_ip_hash text DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_utm jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  v_subscriber_id uuid;
  v_token text;
  v_eu boolean := p_country = ANY (ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
BEGIN
  INSERT INTO web.subscribers (email, first_name, country, source_page_id, utm_jsonb, lifecycle_stage)
  VALUES (lower(p_email), p_first_name, p_country, p_source_page_id, p_utm, 'new')
  ON CONFLICT (email) DO UPDATE SET
    first_name = COALESCE(web.subscribers.first_name, EXCLUDED.first_name),
    country    = COALESCE(web.subscribers.country, EXCLUDED.country),
    updated_at = now()
  RETURNING id INTO v_subscriber_id;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO web.consents (subscriber_id, consent_type, granted, granted_at, ip_hash, user_agent, page_id, double_opt_in_token)
  SELECT v_subscriber_id, ct, true, now(), p_ip_hash, p_user_agent, p_source_page_id,
         CASE WHEN v_eu THEN v_token ELSE NULL END
  FROM unnest(p_consents) AS ct;

  RETURN jsonb_build_object(
    'subscriber_id', v_subscriber_id,
    'opt_in_required', v_eu,
    'double_opt_in_token', CASE WHEN v_eu THEN v_token ELSE NULL END
  );
END $fn$;

CREATE OR REPLACE FUNCTION web.track_event(
  p_session_id text, p_event_type text,
  p_page_id uuid DEFAULT NULL, p_retreat_id uuid DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL, p_value_usd numeric DEFAULT NULL,
  p_properties jsonb DEFAULT '{}',
  p_ip_hash text DEFAULT NULL, p_country text DEFAULT NULL,
  p_device text DEFAULT NULL, p_referrer text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE v_id bigint;
BEGIN
  INSERT INTO web.events (session_id, event_type, page_id, retreat_id, campaign_id, value_usd, properties_jsonb, ip_hash, country, device, referrer_url)
  VALUES (p_session_id, p_event_type, p_page_id, p_retreat_id, p_campaign_id, p_value_usd, p_properties, p_ip_hash, p_country, p_device, p_referrer)
  RETURNING id INTO v_id;
  RETURN v_id;
END $fn$;

DO $blk$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname IN ('catalog','pricing','compiler','book','web','content')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
  END LOOP;
END $blk$;

GRANT USAGE ON SCHEMA catalog, pricing, compiler, book, web, content
  TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA content TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA pricing TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA compiler TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA web TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA book TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pricing TO service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA compiler TO service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA web TO service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA book TO service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA content TO service_role;

GRANT EXECUTE ON FUNCTION web.capture_lead(text,text,text,uuid,text[],text,text,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION web.track_event(text,text,uuid,uuid,uuid,numeric,jsonb,text,text,text,text) TO anon, authenticated;