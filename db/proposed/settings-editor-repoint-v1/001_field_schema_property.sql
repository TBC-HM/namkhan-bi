-- APPLIED 2026-09-09 via Supabase MCP apply_migration as
--   `settings_field_schema_add_property_content_scopes`
-- after PBS approval. This file is the audit copy; the applied version differs in two
-- ways found during the pre-apply check:
--   · content.property_banking and property.licenses were added to the WHERE list —
--     banking/licenses live in `content`/`property`, not `property` alone.
--   · marketing.v_settings_field_schema is NOT a no-op passthrough after all: it selects
--     named columns, so it had to be replaced too or the new table_schema column would
--     never reach the caller. The note at the bottom of this file was wrong.
-- The separation caveat below was resolved in the same change: the legacy editor now
-- takes an explicit ?property_id and shows a picker instead of defaulting to 260955.
-- brief: settings-editor-repoint-v1
--
-- PROBLEM
-- marketing.property_profile / property_contact / booking_policies /
-- property_banking / property_licenses were dropped. SECTION_TO_TABLE still
-- pointed 7 sections at them, so identity, location, brand, contacts, booking
-- policies, banking and licenses have NO working editor anywhere: the
-- /h/[pid]/settings/property page reads property.* read-only, and the only
-- editor wrote marketing.*.
--
-- The live data is in property.*, every table has a clean PK and carries
-- property_id:
--   property.identity  (pk property_id)   property.location (pk property_id)
--   property.brand     (pk property_id)   property.policies (pk property_id)
--   property.contacts  (pk contact_id)    property.licenses (pk id)
--
-- BLOCKER
-- content.v_settings_field_schema — which drives the editor's form rendering —
-- is hardcoded to table_schema = 'marketing' AND a fixed 15-table list, so it
-- returns nothing for property.*. This is the only DDL the repoint needs.
--
-- CHANGE: additive only. Same columns, same order (CREATE OR REPLACE is safe —
-- no rename, no reorder), plus a table_schema column appended at the tail so
-- callers can disambiguate. Nothing is dropped; the marketing rows keep coming
-- back exactly as today.
--
-- NOT INCLUDED, and deliberately: repointing SECTION_TO_TABLE would make the
-- LEGACY /settings/property/[section] editor live again, and that editor is
-- hardcoded to PROPERTY_ID 260955 with no tenant selector. Turning it back on
-- as-is would hand every operator a Namkhan-only editor reachable from Donna's
-- context — a separation regression. Either give it a tenant selector in the
-- same change, or build the editor on the canonical /h/[pid] surface and retire
-- the legacy tree. That is an owner call, not a migration.

CREATE OR REPLACE VIEW content.v_settings_field_schema AS
SELECT table_name, column_name, ordinal_position, data_type, udt_name,
       is_nullable::text = 'YES' AS nullable, column_default,
       CASE
         WHEN column_name = ANY (ARRAY['property_id','contact_id','room_type_id','package_id',
              'retreat_id','pricing_id','season_id','facility_id','activity_id',
              'meeting_room_id','cert_id','id']) THEN 'hidden'
         WHEN column_name = ANY (ARRAY['created_at','updated_at','created_by','updated_by']) THEN 'audit'
         WHEN data_type = 'ARRAY'     THEN 'array'
         WHEN data_type = 'jsonb'     THEN 'json'
         WHEN data_type = 'boolean'   THEN 'toggle'
         WHEN data_type = ANY (ARRAY['integer','bigint','numeric','smallint','real','double precision']) THEN 'number'
         WHEN data_type = 'date'      THEN 'date'
         WHEN data_type LIKE 'timestamp%' THEN 'datetime'
         WHEN data_type = 'time without time zone' THEN 'time'
         WHEN data_type = 'USER-DEFINED' THEN 'enum'
         WHEN column_name LIKE '%\_url'  THEN 'url'
         WHEN column_name LIKE '%email%' THEN 'email'
         WHEN column_name LIKE '%description%' OR column_name LIKE 'long\_%' THEN 'textarea'
         WHEN column_name LIKE '%notes'  THEN 'textarea'
         WHEN column_name LIKE '%hex%'   THEN 'color'
         WHEN character_maximum_length > 200 THEN 'textarea'
         WHEN data_type = ANY (ARRAY['text','character varying']) THEN 'text'
         ELSE 'text'
       END AS input_type,
       initcap(replace(column_name, '_', ' ')) AS label,
       table_schema                                   -- tail-append, safe
FROM information_schema.columns
WHERE (table_schema = 'marketing' AND table_name = ANY (ARRAY[
         'property_profile','property_contact','social_accounts','room_type_content',
         'booking_policies','certifications','facilities','activities_catalog',
         'meeting_rooms','meeting_packages','retreat_programs','retreat_pricing',
         'seasons','social_channel_rules','social_programs']))
   OR (table_schema = 'property' AND table_name = ANY (ARRAY[
         'identity','location','brand','policies','contacts','licenses',
         'certifications','facilities','activities','seasons','social','rooms',
         'owner_entity','communications','sales_config']))
ORDER BY table_schema, table_name, ordinal_position;

-- marketing.v_settings_field_schema is a plain passthrough and needs no change.
-- No new public object, so no anon GRANT/REVOKE is required (ADR-277 unaffected).
