-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503204740
-- Name:    docs_knowledge_v1_indexes_importance_search
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- docs/knowledge v1: importance tier + search infrastructure
-- ============================================================================
-- 1) Expose 'docs' schema via PostgREST  (MERGE — never overwrite!)
-- 2) Add importance enum-style col + default
-- 3) GIN indexes for fast search (tsv + array overlap)
-- 4) Trigger to auto-build search_tsv
-- 5) Two public RPCs (kept in public so frontend doesn't need extra schema):
--    - docs_search()  → keyword search with filters (for /knowledge search box)
--    - docs_topk()    → top-k retrieval for /api/docs/ask Q/A synthesis
-- ============================================================================

-- 1. Expose docs to PostgREST  (current: public, graphql_public, marketing,
--    governance, guest, gl, suppliers, fa, inv, proc, sales, ops, plan, dq, kpi)
ALTER ROLE authenticator SET pgrst.db_schemas TO
  'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc, sales, ops, plan, dq, kpi, docs';
NOTIFY pgrst, 'reload config';

-- 2. Importance tier (5 levels) — defaults to 'standard'
ALTER TABLE docs.documents
  ADD COLUMN IF NOT EXISTS importance text NOT NULL DEFAULT 'standard';
ALTER TABLE docs.documents DROP CONSTRAINT IF EXISTS docs_importance_chk;
ALTER TABLE docs.documents ADD CONSTRAINT docs_importance_chk
  CHECK (importance IN ('critical','standard','note','research','reference'));

-- 3. GIN indexes  (tsv + arrays + per-field filters)
CREATE INDEX IF NOT EXISTS docs_search_tsv_idx ON docs.documents USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS docs_keywords_gin_idx ON docs.documents USING GIN (keywords);
CREATE INDEX IF NOT EXISTS docs_tags_gin_idx ON docs.documents USING GIN (tags);
CREATE INDEX IF NOT EXISTS docs_doc_type_idx ON docs.documents (doc_type);
CREATE INDEX IF NOT EXISTS docs_importance_idx ON docs.documents (importance);
CREATE INDEX IF NOT EXISTS docs_external_party_idx ON docs.documents (external_party);
CREATE INDEX IF NOT EXISTS docs_valid_until_idx ON docs.documents (valid_until)
  WHERE valid_until IS NOT NULL;

-- 4. Auto-build search_tsv from title + summary + keywords + tags + body excerpt
CREATE OR REPLACE FUNCTION docs.tsv_build()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_lo,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.title_fr,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.external_party,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.keywords,' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags,' '),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.summary,'')), 'C') ||
    setweight(to_tsvector('simple', left(coalesce(NEW.body_markdown,''), 8000)), 'D');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS docs_tsv_trg ON docs.documents;
CREATE TRIGGER docs_tsv_trg
  BEFORE INSERT OR UPDATE OF title, title_lo, title_fr, external_party, keywords, tags, summary, body_markdown
  ON docs.documents
  FOR EACH ROW EXECUTE FUNCTION docs.tsv_build();

-- 5. Backfill tsv for the 185 existing rows
UPDATE docs.documents SET title = title;  -- triggers tsv_build via UPDATE OF title

-- 6. RPC: docs_search() — keyword search with filters
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
  WITH query AS (
    SELECT CASE WHEN q IS NULL OR length(trim(q)) = 0
                THEN NULL
                ELSE plainto_tsquery('simple', q) END AS tsq
  )
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

-- 7. RPC: docs_topk() — top-k for Q/A synthesis (returns body excerpt)
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
  WITH query AS (
    SELECT plainto_tsquery('simple', coalesce(q,'')) AS tsq
  )
  SELECT
    d.doc_id, d.title, d.doc_type, d.external_party,
    d.valid_from, d.valid_until, d.importance, d.summary,
    -- Highlight up to ~3000 chars around matching terms; falls back to first 3000
    CASE WHEN d.body_markdown IS NULL THEN coalesce(d.summary,'')
         ELSE coalesce(
                ts_headline('simple', d.body_markdown, (SELECT tsq FROM query),
                  'MaxWords=400, MinWords=200, MaxFragments=4, FragmentDelimiter=" … "'),
                left(d.body_markdown, 3000))
    END AS body_excerpt,
    ts_rank(d.search_tsv, (SELECT tsq FROM query)) AS rank
  FROM docs.documents d, query
  WHERE d.status = 'active'
    AND d.search_tsv @@ query.tsq
  ORDER BY rank DESC
  LIMIT lim;
$$;
GRANT EXECUTE ON FUNCTION public.docs_topk(text,int) TO authenticated, anon;

-- 8. Reload PostgREST so new RPCs are immediately callable
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.docs_search IS
  'Keyword search over docs.documents with importance/type/party/year filters. Returns ranked list.';
COMMENT ON FUNCTION public.docs_topk IS
  'Top-k retrieval for Q/A synthesis. Returns body excerpt with matched terms highlighted.';
COMMENT ON COLUMN docs.documents.importance IS
  'critical (contracts/audits/insurance) | standard (SOPs/financial) | note (memos) | research (market data) | reference (templates)';
