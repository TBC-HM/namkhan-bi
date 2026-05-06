-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504135941
-- Name:    v_knowledge_overview_for_data_agent
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Lightweight DB overview view so the data agent can answer questions like:
-- "how many docs do we have", "how many SOPs", "what schemas exist", etc.
-- Aggregates docs.documents stats + schema-level row estimates from pg_class.

CREATE OR REPLACE VIEW public.v_knowledge_overview AS
SELECT
  'docs' AS metric_group,
  'total_documents' AS metric,
  COUNT(*)::bigint AS value,
  jsonb_build_object(
    'with_body', COUNT(*) FILTER (WHERE length(coalesce(body_markdown,'')) >= 200),
    'critical', COUNT(*) FILTER (WHERE importance = 'critical'),
    'standard', COUNT(*) FILTER (WHERE importance = 'standard'),
    'unique_parties', COUNT(DISTINCT external_party) FILTER (WHERE external_party IS NOT NULL)
  ) AS details
FROM docs.documents
UNION ALL
SELECT
  'docs', 'by_doc_type', COUNT(*)::bigint,
  jsonb_object_agg(doc_type, n)
FROM (
  SELECT doc_type, COUNT(*) AS n FROM docs.documents
  WHERE status='active' GROUP BY doc_type
) t
UNION ALL
SELECT
  'docs', 'chunks_indexed', COUNT(*)::bigint,
  jsonb_build_object(
    'distinct_docs', COUNT(DISTINCT doc_id),
    'avg_chunks_per_doc',
      ROUND((COUNT(*)::numeric / NULLIF(COUNT(DISTINCT doc_id),0))::numeric, 1)
  )
FROM docs.chunks
UNION ALL
SELECT
  'storage', 'bucket_files', COUNT(*)::bigint,
  jsonb_object_agg(bucket_id, files)
FROM (
  SELECT bucket_id, COUNT(*) AS files FROM storage.objects GROUP BY bucket_id
) s;

GRANT SELECT ON public.v_knowledge_overview TO authenticated, anon, service_role;

COMMENT ON VIEW public.v_knowledge_overview IS
  'Knowledge/docs/storage rollup for data agent. Use for "how many docs by type/importance/party" questions.';
