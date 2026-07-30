-- db/proposed/build/md-intake/001_md_intake_guards_and_bridge.sql
-- md-intake-v1 · PROPOSED DDL — NOT APPLIED. PBS approval required before any
-- CREATE/ALTER runs (builder never executes DDL; event triggers auto-log).
--
-- Why:
-- 1. external_id guard: the md-intake API dedups brief sources app-side
--    (query-before-insert). A partial unique index makes the guard a DB
--    invariant so two concurrent uploads of the same filename can never
--    produce duplicate canon rows.
-- 2. PostgREST bridge law (claude_md §0.5): the md-intake route currently
--    reads dms.documents / documentation.build_briefs via the service-role
--    schema() client (the established repo pattern — see
--    app/api/marketing/docs/upload/route.ts and app/api/specs/route.ts).
--    These public.v_* bridge views let the read paths converge on the
--    bridge law; once applied, the route's audit-first reads should be
--    switched to the views.

-- ── 1 · Duplicate-source guard ──────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_dms_documents_brief_source_external_id
  ON dms.documents (external_id)
  WHERE doc_subtype = 'brief_source';

-- ── 2 · Bridge view: brief sources (read-only, no body by default listing) ──
CREATE OR REPLACE VIEW public.v_brief_sources AS
SELECT
  d.doc_id,
  d.external_id,
  d.title,
  d.file_name,
  d.file_checksum,
  d.file_size_bytes,
  d.source,
  d.body_markdown,
  d.created_at
FROM dms.documents d
WHERE d.doc_subtype = 'brief_source';

GRANT SELECT ON public.v_brief_sources TO anon, authenticated, service_role;

-- ── 3 · Bridge view: active brief priorities (for next-free-low-number calc) ─
CREATE OR REPLACE VIEW public.v_build_brief_priorities AS
SELECT b.slug, b.status, b.priority, b.goal_id, b.created_at
FROM documentation.build_briefs b
WHERE b.status NOT IN ('shipped', 'archived');

GRANT SELECT ON public.v_build_brief_priorities TO anon, authenticated, service_role;

-- After apply: NOTIFY pgrst, 'reload schema';
