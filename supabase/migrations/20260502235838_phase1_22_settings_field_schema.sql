-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502235838
-- Name:    phase1_22_settings_field_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- ============================================================================
-- v_settings_field_schema: tells the frontend which fields to render per table.
-- Frontend reads this and auto-generates form fields with correct input types.
-- ============================================================================
CREATE OR REPLACE VIEW marketing.v_settings_field_schema AS
SELECT
  c.table_name,
  c.column_name,
  c.ordinal_position,
  c.data_type,
  c.udt_name,
  c.is_nullable::boolean AS nullable,
  c.column_default,
  CASE
    WHEN c.column_name IN ('property_id','contact_id','room_type_id','package_id','retreat_id','pricing_id','season_id','facility_id','activity_id','meeting_room_id','cert_id','id') THEN 'hidden'
    WHEN c.column_name IN ('created_at','updated_at','created_by','updated_by') THEN 'audit'
    WHEN c.udt_name LIKE '_%'              THEN 'array'      -- text[], etc
    WHEN c.data_type = 'jsonb'             THEN 'json'
    WHEN c.data_type = 'boolean'           THEN 'toggle'
    WHEN c.data_type IN ('integer','bigint','numeric','smallint','real','double precision') THEN 'number'
    WHEN c.data_type = 'date'              THEN 'date'
    WHEN c.data_type LIKE 'timestamp%'     THEN 'datetime'
    WHEN c.data_type = 'time without time zone' THEN 'time'
    WHEN c.column_name LIKE '%_url'        THEN 'url'
    WHEN c.column_name LIKE '%email%'      THEN 'email'
    WHEN c.column_name LIKE '%description%' OR c.column_name LIKE 'long_%' THEN 'textarea'
    WHEN c.column_name LIKE '%notes'       THEN 'textarea'
    WHEN c.column_name LIKE '%hex%'        THEN 'color'
    WHEN c.character_maximum_length > 200  THEN 'textarea'
    WHEN c.data_type IN ('text','character varying') THEN 'text'
    WHEN c.data_type LIKE 'USER-DEFINED'   THEN 'enum'
    ELSE 'text'
  END AS input_type,
  -- Field labels for UI (snake_case → Title Case)
  initcap(replace(c.column_name, '_', ' ')) AS label
FROM information_schema.columns c
WHERE c.table_schema = 'marketing'
  AND c.table_name IN (
    'property_profile','property_contact','social_accounts','room_type_content',
    'booking_policies','certifications','facilities','activities_catalog',
    'meeting_rooms','meeting_packages','retreat_programs','retreat_pricing','seasons'
  )
ORDER BY c.table_name, c.ordinal_position;

COMMENT ON VIEW marketing.v_settings_field_schema IS
  'Per-column metadata for auto-generating Settings UI forms. Frontend reads this to build forms dynamically.';

GRANT SELECT ON marketing.v_settings_field_schema TO authenticated;

-- ============================================================================
-- Auto-stamp updated_by on writes (audit who edited what)
-- ============================================================================
CREATE OR REPLACE FUNCTION marketing.stamp_audit() RETURNS trigger
LANGUAGE plpgsql AS $f$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    BEGIN NEW.created_by := auth.uid(); EXCEPTION WHEN OTHERS THEN END;
  END IF;
  BEGIN NEW.updated_by := auth.uid(); EXCEPTION WHEN OTHERS THEN END;
  RETURN NEW;
END $f$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='marketing' AND c.relkind='r'
      AND c.relname IN ('property_profile','property_contact','room_type_content',
                        'booking_policies','certifications','facilities','activities_catalog',
                        'meeting_rooms','meeting_packages','retreat_programs','retreat_pricing','seasons')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_stamp_audit ON marketing.%I', t);
    EXECUTE format('CREATE TRIGGER trg_stamp_audit BEFORE INSERT OR UPDATE ON marketing.%I FOR EACH ROW EXECUTE FUNCTION marketing.stamp_audit()', t);
  END LOOP;
END $$;