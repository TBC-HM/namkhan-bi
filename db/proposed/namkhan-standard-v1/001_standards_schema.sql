CREATE SCHEMA IF NOT EXISTS standards;

-- TENANT-NEUTRAL. One row per external standard document.
CREATE TABLE IF NOT EXISTS standards.sources (
  source_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key  text UNIQUE NOT NULL,           -- 'slh_mystery_2026', 'asean_green', ...
  title       text NOT NULL,
  doc_id      uuid,                            -- dms.documents.doc_id, nullable for non-DMS sources
  authority   text NOT NULL,                   -- 'SLH', 'ASEAN', 'Travelife', 'GSTC'
  version     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- TENANT-NEUTRAL. The raw atoms, one row per question/criterion in a source.
CREATE TABLE IF NOT EXISTS standards.requirements (
  requirement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid NOT NULL REFERENCES standards.sources(source_id),
  section        text NOT NULL,
  subsection     text,
  question_no    int,
  text           text NOT NULL,
  weight         numeric,
  dept_code      text,
  dept_code_2    text,                         -- shared ownership, e.g. pool deck
  category       text,                         -- product | service | brand | cleanliness | sustainability
  verdict_2026   text,                         -- 'Yes' | 'No' | 'NA' — the 2026 result, where known
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, section, question_no)
);
CREATE INDEX IF NOT EXISTS idx_standards_req_dept ON standards.requirements (dept_code);
CREATE INDEX IF NOT EXISTS idx_standards_req_source ON standards.requirements (source_id);

-- TENANT-NEUTRAL. The merged Namkhan Standard: one row per real-world requirement.
CREATE TABLE IF NOT EXISTS standards.atoms (
  atom_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atom_key         text UNIQUE NOT NULL,
  dept_code        text NOT NULL,
  dept_code_2      text,
  title            text NOT NULL,
  requirement_text text NOT NULL,
  category         text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- TENANT-NEUTRAL. Citations: which source requirements a merged atom satisfies.
CREATE TABLE IF NOT EXISTS standards.atom_sources (
  atom_id        uuid NOT NULL REFERENCES standards.atoms(atom_id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES standards.requirements(requirement_id) ON DELETE CASCADE,
  PRIMARY KEY (atom_id, requirement_id)
);

-- PER TENANT. The only table in this schema that is property-scoped.
CREATE TABLE IF NOT EXISTS standards.sop_coverage (
  atom_id     uuid NOT NULL REFERENCES standards.atoms(atom_id) ON DELETE CASCADE,
  property_id bigint NOT NULL,
  sop_code    text NOT NULL,
  covered     boolean NOT NULL DEFAULT true,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atom_id, property_id, sop_code)
);
CREATE INDEX IF NOT EXISTS idx_standards_cov_prop ON standards.sop_coverage (property_id);

-- ---- public bridges (PostgREST reaches `public` only) ----
CREATE OR REPLACE VIEW public.v_standards_requirements AS
  SELECT r.requirement_id, r.source_id, s.source_key, s.authority,
         r.section, r.subsection, r.question_no, r.text, r.weight,
         r.dept_code, r.dept_code_2, r.category, r.verdict_2026
  FROM standards.requirements r
  JOIN standards.sources s ON s.source_id = r.source_id;

CREATE OR REPLACE VIEW public.v_standards_atoms AS
  SELECT a.atom_id, a.atom_key, a.dept_code, a.dept_code_2, a.title,
         a.requirement_text, a.category,
         count(x.requirement_id) AS source_count,
         string_agg(DISTINCT s.authority, ', ' ORDER BY s.authority) AS authorities
  FROM standards.atoms a
  LEFT JOIN standards.atom_sources x ON x.atom_id = a.atom_id
  LEFT JOIN standards.requirements r ON r.requirement_id = x.requirement_id
  LEFT JOIN standards.sources s ON s.source_id = r.source_id
  GROUP BY a.atom_id, a.atom_key, a.dept_code, a.dept_code_2, a.title,
           a.requirement_text, a.category;

-- Gap report per atom. Deliberately NO hardcoded property ids: L6 locks the ids
-- but forbids writing them into code, and a CROSS JOIN onto a literal tenant list
-- would also rot the moment a third property is onboarded. Callers pass the
-- property they are asking about; public.fn_standards_gap_summary(bigint) is the
-- property-aware entry point.
CREATE OR REPLACE VIEW public.v_standards_gap AS
  SELECT c.property_id, a.atom_id, a.atom_key, a.dept_code, a.title, a.category,
         bool_or(c.covered) AS covered,
         string_agg(DISTINCT c.sop_code, ', ') AS sop_codes
  FROM standards.atoms a
  JOIN standards.sop_coverage c ON c.atom_id = a.atom_id
  GROUP BY c.property_id, a.atom_id, a.atom_key, a.dept_code, a.title, a.category;

REVOKE ALL ON public.v_standards_requirements FROM anon;
REVOKE ALL ON public.v_standards_atoms        FROM anon;
REVOKE ALL ON public.v_standards_gap          FROM anon;
GRANT SELECT ON public.v_standards_requirements TO authenticated, service_role;
GRANT SELECT ON public.v_standards_atoms        TO authenticated, service_role;
GRANT SELECT ON public.v_standards_gap          TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- SECURITY FIX (applied same day, migration standards_gap_view_tenant_lockdown_v1)
--
-- v_standards_gap selects c.property_id and per-property coverage with NO tenant
-- filter. Granting it to `authenticated` let any logged-in user of either tenant
-- read the other's coverage — the same R1/L7 shape as the v_qa_dash_sop leak, and
-- a violation of the invariant that a bridge bypassing RLS must filter
-- property_id itself. The gap view is service_role only; callers go through
-- fn_standards_gap_summary(bigint) behind requirePropertyAccess() (L22).
--
-- v_standards_requirements and v_standards_atoms stay readable by authenticated
-- ON PURPOSE: they are tenant-neutral (no property_id column at all), which is
-- the point of the shared-corpus model.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.v_standards_gap FROM authenticated;
ALTER TABLE standards.sop_coverage ENABLE ROW LEVEL SECURITY;
