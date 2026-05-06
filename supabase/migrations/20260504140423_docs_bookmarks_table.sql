-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504140423
-- Name:    docs_bookmarks_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- docs.bookmarks: stored URLs/links with category + tags + tsv search
-- ============================================================================
CREATE TABLE IF NOT EXISTS docs.bookmarks (
  bookmark_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint DEFAULT 260955,
  url           text NOT NULL,
  title         text,
  description   text,
  category      text,           -- 'pms','partner','reference','industry','tools','admin','news','other'
  tags          text[] DEFAULT '{}',
  importance    text DEFAULT 'standard'
                CHECK (importance IN ('critical','standard','note','research','reference')),
  is_active     boolean DEFAULT true,
  search_tsv    tsvector,
  added_by      uuid,
  added_by_name text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (property_id, url)
);

CREATE INDEX IF NOT EXISTS bookmarks_search_tsv_idx ON docs.bookmarks USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS bookmarks_category_idx ON docs.bookmarks (category);
CREATE INDEX IF NOT EXISTS bookmarks_tags_gin_idx ON docs.bookmarks USING GIN (tags);

-- Auto-build tsv from title + description + url + category + tags
CREATE OR REPLACE FUNCTION docs.bookmarks_tsv_build()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.url,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.category,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags,' '),'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.description,'')), 'D');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookmarks_tsv_trg ON docs.bookmarks;
CREATE TRIGGER bookmarks_tsv_trg
  BEFORE INSERT OR UPDATE OF title, description, url, category, tags
  ON docs.bookmarks
  FOR EACH ROW EXECUTE FUNCTION docs.bookmarks_tsv_build();

ALTER TABLE docs.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bookmarks_read ON docs.bookmarks;
CREATE POLICY bookmarks_read ON docs.bookmarks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS bookmarks_top ON docs.bookmarks;
CREATE POLICY bookmarks_top ON docs.bookmarks FOR ALL TO authenticated
  USING (app.is_top_level()) WITH CHECK (app.is_top_level());

GRANT SELECT ON docs.bookmarks TO authenticated, anon;

COMMENT ON TABLE docs.bookmarks IS
  'Stored URLs/links — partner portals, industry references, tools, admin pages.';
