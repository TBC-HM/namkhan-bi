-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504213016
-- Name:    channel_contacts_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS revenue.channel_contacts (
  source_name           text PRIMARY KEY,
  account_id            text,
  property_url          text,
  channel_manager_name  text,
  channel_manager_role  text,
  channel_manager_email text,
  channel_manager_phone text,
  accounting_name       text,
  accounting_email      text,
  accounting_phone      text,
  connectivity_provider text,
  commission_pct        numeric(5,2),
  contract_start        date,
  contract_renewal      date,
  notes                 text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO revenue.channel_contacts (source_name, account_id, property_url, commission_pct, notes)
VALUES ('Booking.com', NULL, 'https://www.booking.com/hotel/la/the-namkhan.html', 18.00, 'Edit values via /settings/channel-contacts (coming) or direct DB.')
ON CONFLICT (source_name) DO NOTHING;

INSERT INTO revenue.channel_contacts (source_name, commission_pct) VALUES
  ('Expedia', NULL),
  ('Agoda', NULL),
  ('Airbnb', NULL),
  ('Direct', 0.00)
ON CONFLICT (source_name) DO NOTHING;

DROP VIEW IF EXISTS public.v_channel_contacts CASCADE;
CREATE VIEW public.v_channel_contacts AS
SELECT source_name, account_id, property_url, channel_manager_name, channel_manager_role,
       channel_manager_email, channel_manager_phone, accounting_name, accounting_email,
       accounting_phone, connectivity_provider, commission_pct, contract_start, contract_renewal,
       notes, updated_at
FROM revenue.channel_contacts;

GRANT SELECT ON public.v_channel_contacts TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON revenue.channel_contacts TO service_role;