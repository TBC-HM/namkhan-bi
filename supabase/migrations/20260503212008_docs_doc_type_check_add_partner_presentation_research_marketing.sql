-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503212008
-- Name:    docs_doc_type_check_add_partner_presentation_research_marketing
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Align doc_type CHECK constraint with the v1 classifier output.
-- Adds: partner, presentation, research, marketing (and 'note' as alias for meeting_note compatibility).
-- Keeps all 18 existing values so the 185 historical rows remain valid.

ALTER TABLE docs.documents DROP CONSTRAINT IF EXISTS documents_doc_type_check;
ALTER TABLE docs.documents ADD CONSTRAINT documents_doc_type_check
  CHECK (doc_type IN (
    -- Existing 18 values (preserved)
    'legal','compliance','insurance','sop','brand','template','meeting_note','markdown',
    'kb_article','vendor_doc','hr_doc','guest_doc','financial','recipe_doc',
    'training_material','audit','external_feed','other',
    -- New v1 classifier additions
    'partner','presentation','research','marketing','note'
  ));

COMMENT ON CONSTRAINT documents_doc_type_check ON docs.documents IS
  'v1 classifier types (partner/presentation/research/marketing/note) added 2026-05-03 alongside the original 18.';
