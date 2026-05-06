-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503230218
-- Name:    docs_chunks_paragraph_retrieval
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- docs.chunks: paragraph-level retrieval for "show me the paragraph not the doc"
-- ============================================================================
-- Each row in docs.documents can have N rows in docs.chunks (≈ 1 per paragraph).
-- chunk-level tsv → docs_ask_chunks() RPC returns top-3 paragraphs across ALL docs.
-- No embeddings — uses simple tsv (same config as docs.documents) + OR-joined tsquery.
-- ============================================================================

CREATE TABLE IF NOT EXISTS docs.chunks (
  chunk_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id       uuid NOT NULL REFERENCES docs.documents(doc_id) ON DELETE CASCADE,
  chunk_idx    int NOT NULL,           -- ordinal within the doc (0,1,2…)
  page_num     int,                    -- best-effort page number, null if unknown
  content      text NOT NULL,          -- the chunk text
  char_start   int,                    -- offset in body_markdown
  char_end     int,
  search_tsv   tsvector,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS docs_chunks_doc_idx ON docs.chunks (doc_id, chunk_idx);
CREATE INDEX IF NOT EXISTS docs_chunks_tsv_idx ON docs.chunks USING GIN (search_tsv);

-- Auto-build tsv on insert/update
CREATE OR REPLACE FUNCTION docs.chunks_tsv_build()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv := to_tsvector('simple', coalesce(NEW.content, ''));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS docs_chunks_tsv_trg ON docs.chunks;
CREATE TRIGGER docs_chunks_tsv_trg
  BEFORE INSERT OR UPDATE OF content
  ON docs.chunks
  FOR EACH ROW EXECUTE FUNCTION docs.chunks_tsv_build();

-- Enable RLS, mirror docs.documents read policy
ALTER TABLE docs.chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chunks_read ON docs.chunks;
CREATE POLICY chunks_read ON docs.chunks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM docs.documents d
    WHERE d.doc_id = docs.chunks.doc_id
      AND (
        d.sensitivity = 'public' OR
        d.sensitivity = 'internal' OR
        d.owner_user_id = auth.uid() OR
        app.is_top_level() OR
        (d.sensitivity = 'confidential' AND
         app.has_role(ARRAY['owner','gm','hod','auditor']))
      )
  )
);
GRANT SELECT ON docs.chunks TO authenticated, anon;

-- RPC: returns top-N matching paragraph chunks across all docs
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
    AND query.tsq IS NOT NULL
    AND c.search_tsv @@ query.tsq
  ORDER BY rank DESC
  LIMIT lim;
$$;
GRANT EXECUTE ON FUNCTION public.docs_ask_chunks(text,int) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE docs.chunks IS
  'Paragraph-level chunks for fine-grained retrieval. Built at ingest from body_markdown.';
COMMENT ON FUNCTION public.docs_ask_chunks IS
  'Returns top-N matching paragraphs across all docs. Use for "the paragraph not the doc" Q/A.';
