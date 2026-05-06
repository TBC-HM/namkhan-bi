-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502235900
-- Name:    phase1_22a_field_schema_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE VIEW marketing.v_settings_field_schema AS
SELECT
  c.table_name,
  c.column_name,
  c.ordinal_position,
  c.data_type,
  c.udt_name,
  (c.is_nullable = 'YES') AS nullable,
  c.column_default,
  CASE
    WHEN c.column_name IN ('property_id','contact_id','room_type_id','package_id','retreat_id','pricing_id','season_id','facility_id','activity_id','meeting_room_id','cert_id','id') THEN 'hidden'
    WHEN c.column_name IN ('created_at','updated_at','created_by','updated_by') THEN 'audit'
    WHEN c.data_type = 'ARRAY'                                   THEN 'array'
    WHEN c.data_type = 'jsonb'                                   THEN 'json'
    WHEN c.data_type = 'boolean'                                 THEN 'toggle'
    WHEN c.data_type IN ('integer','bigint','numeric','smallint','real','double precision') THEN 'number'
    WHEN c.data_type = 'date'                                    THEN 'date'
    WHEN c.data_type LIKE 'timestamp%'                           THEN 'datetime'
    WHEN c.data_type = 'time without time zone'                  THEN 'time'
    WHEN c.data_type = 'USER-DEFINED'                            THEN 'enum'
    WHEN c.column_name LIKE '%_url'                              THEN 'url'
    WHEN c.column_name LIKE '%email%'                            THEN 'email'
    WHEN c.column_name LIKE '%description%' OR c.column_name LIKE 'long_%' THEN 'textarea'
    WHEN c.column_name LIKE '%notes'                             THEN 'textarea'
    WHEN c.column_name LIKE '%hex%'                              THEN 'color'
    WHEN c.character_maximum_length > 200                        THEN 'textarea'
    WHEN c.data_type IN ('text','character varying')             THEN 'text'
    ELSE 'text'
  END AS input_type,
  initcap(replace(c.column_name, '_', ' ')) AS label
FROM information_schema.columns c
WHERE c.table_schema = 'marketing'
  AND c.table_name IN (
    'property_profile','property_contact','social_accounts','room_type_content',
    'booking_policies','certifications','facilities','activities_catalog',
    'meeting_rooms','meeting_packages','retreat_programs','retreat_pricing','seasons'
  )
ORDER BY c.table_name, c.ordinal_position;