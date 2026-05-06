-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503212825
-- Name:    docs_topk_or_join_natural_language
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- v2: docs_topk + docs_search now build an OR-joined tsquery from input.
-- This means natural-language queries like "fire kitchen" return docs with
-- ANY matching token (ranked by total weight) instead of requiring ALL.
-- Single-token queries still work the same.
--
-- Token cleaning: lowercase, strip punctuation, drop tokens < 2 chars.

-- Helper: convert a free-text input into a sane OR tsquery
CREATE OR REPLACE FUNCTION public.docs_query_clean(q text)
RETURNS tsquery LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cleaned text;
  tokens  text[];
  joined  text;
BEGIN
  IF q IS NULL OR length(trim(q)) = 0 THEN RETURN NULL; END IF;
  -- lowercase + replace any non-alphanumeric with space
  cleaned := lower(regexp_replace(q, '[^a-zA-Z0-9\s]', ' ', 'g'));
  -- split, drop empties + 1-char tokens
  SELECT array_agg(t) INTO tokens
  FROM (SELECT unnest(string_to_array(cleaned, ' ')) AS t) s
  WHERE length(t) >= 2;
  IF tokens IS NULL OR array_length(tokens, 1) = 0 THEN RETURN NULL; END IF;
  joined := array_to_string(tokens, ' | ');
  -- to_tsquery requires lexemes already cleaned; we sanitized above
  BEGIN
    RETURN to_tsquery('simple', joined);
  EXCEPTION WHEN OTHERS THEN
    -- if anything weird slipped through, fall back to plainto
    RETURN plainto_tsquery('simple', q);
  END;
END $$;

-- Update docs_topk to use OR matching
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
    AND query.tsq IS NOT NULL
    AND d.search_tsv @@ query.tsq
  ORDER BY rank DESC
  LIMIT lim;
$$;
GRANT EXECUTE ON FUNCTION public.docs_topk(text,int) TO authenticated, anon;

-- Update docs_search the same way (so the search UI also benefits)
CREATE OR REPLACE FUNCTION public.docs_search(
  q              text,
  filter_type    text DEFAULT NULL,
  filter_importance text DEFAULT NULL,
  filter_party   text DEFAULT NULL,
  filter_year    int  DEFAULT NULL,
  lim            int  DEFAULT 50
) RETURNS TABLE (
  doc_id            uuid,
  title             text,
  doc_type          text,
  doc_subtype       text,
  importance        text,
  sensitivity       text,
  external_party    text,
  valid_from        date,
  valid_until       date,
  summary           text,
  tags              text[],
  storage_bucket    text,
  storage_path      text,
  rank              real
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, docs
AS $$
  WITH query AS (SELECT public.docs_query_clean(q) AS tsq)
  SELECT
    d.doc_id, d.title, d.doc_type, d.doc_subtype, d.importance, d.sensitivity,
    d.external_party, d.valid_from, d.valid_until, d.summary, d.tags,
    d.storage_bucket, d.storage_path,
    CASE WHEN (SELECT tsq FROM query) IS NULL THEN 0
         ELSE ts_rank(d.search_tsv, (SELECT tsq FROM query)) END AS rank
  FROM docs.documents d, query
  WHERE d.status = 'active'
    AND (query.tsq IS NULL OR d.search_tsv @@ query.tsq)
    AND (filter_type IS NULL OR d.doc_type = filter_type)
    AND (filter_importance IS NULL OR d.importance = filter_importance)
    AND (filter_party IS NULL OR d.external_party ILIKE '%' || filter_party || '%')
    AND (filter_year IS NULL OR
         extract(year from d.valid_from)::int = filter_year OR
         extract(year from d.valid_until)::int = filter_year OR
         d.period_year = filter_year)
  ORDER BY rank DESC, d.valid_from DESC NULLS LAST, d.created_at DESC
  LIMIT lim;
$$;
GRANT EXECUTE ON FUNCTION public.docs_search(text,text,text,text,int,int) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
