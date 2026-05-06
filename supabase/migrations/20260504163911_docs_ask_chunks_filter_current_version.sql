-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504163911
-- Name:    docs_ask_chunks_filter_current_version
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Update docs_ask_chunks to default to is_current_version=true.
-- Use this whenever doc Q/A doesn't explicitly want history.

CREATE OR REPLACE FUNCTION public.docs_ask_chunks(
  q   text,
  lim int DEFAULT 6
) RETURNS TABLE (
  chunk_id       uuid,
  doc_id         uuid,
  doc_title      text,
  doc_type       text,
  external_party text,
  importance     text,
  page_num       int,
  chunk_idx      int,
  content        text,
  rank           real
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, docs
AS $$
  WITH query AS (SELECT public.docs_query_clean(q) AS tsq)
  SELECT
    c.chunk_id, c.doc_id, d.title AS doc_title, d.doc_type,
    d.external_party, d.importance, c.page_num, c.chunk_idx,
    c.content,
    ts_rank(c.search_tsv, (SELECT tsq FROM query)) AS rank
  FROM docs.chunks c
  JOIN docs.documents d ON d.doc_id = c.doc_id
  CROSS JOIN query
  WHERE d.status = 'active'
    AND (d.is_current_version = true OR d.is_current_version IS NULL)
    AND query.tsq IS NOT NULL
    AND c.search_tsv @@ query.tsq
  ORDER BY rank DESC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.docs_ask_chunks(text,int) TO authenticated, anon;

-- Also update docs_topk
CREATE OR REPLACE FUNCTION public.docs_topk(
  q   text,
  lim int DEFAULT 8
) RETURNS TABLE (
  doc_id         uuid,
  title          text,
  doc_type       text,
  external_party text,
  valid_from     date,
  valid_until    date,
  importance     text,
  summary        text,
  body_excerpt   text,
  rank           real
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, docs
AS $$
  WITH query AS (SELECT public.docs_query_clean(q) AS tsq)
  SELECT
    d.doc_id, d.title, d.doc_type, d.external_party,
    d.valid_from, d.valid_until, d.importance, d.summary,
    CASE WHEN d.body_markdown IS NULL THEN coalesce(d.summary,'')
         ELSE coalesce(
                ts_headline('simple', d.body_markdown, (SELECT tsq FROM query),
                  'MaxWords=400, MinWords=200, MaxFragments=4, FragmentDelimiter=" … "'),
                left(d.body_markdown, 3000))
    END AS body_excerpt,
    ts_rank(d.search_tsv, (SELECT tsq FROM query)) AS rank
  FROM docs.documents d, query
  WHERE d.status = 'active'
    AND (d.is_current_version = true OR d.is_current_version IS NULL)
    AND query.tsq IS NOT NULL
    AND d.search_tsv @@ query.tsq
  ORDER BY rank DESC
  LIMIT lim;
$$;
GRANT EXECUTE ON FUNCTION public.docs_topk(text,int) TO authenticated, anon;
