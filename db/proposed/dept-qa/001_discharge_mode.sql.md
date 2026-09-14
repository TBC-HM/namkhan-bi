# 001_discharge_mode — audit copy

Applied live via Supabase MCP `apply_migration` (project `kpenyneooigsyuuomgct`),
migration name `atoms_discharge_mode`, on 2026-09-14. This file is the audit copy for
humans — `supabase/migrations/` in this repo is dead (stale since 2026-05) and nothing
here ever runs; the live database is the source of truth (CLAUDE.md invariant 1).

The Department QA / discharge-modes project treats each of the 2,164 compliance
obligations in `standards.atoms` as discharged one of four ways — `procedure` (an SOP),
`rule` (a trained constraint), `evidence` (proof held on file), or `observation` (scored
by audit, never closed by a document). `discharge_mode` stores that classification;
`mode_source` distinguishes the classifier's guess (`seeded`, from
`scripts/seed-discharge-modes.mjs`) from a HoD's correction (`edited`), which the
seeder must never overwrite on a re-run. `staff_wording` rides along in the same
migration (see Task 2 brief: splitting it into a later task would mean re-emitting
`v_standards_atoms` twice and would leave a later task selecting a column that does not
exist yet) — it is not populated until Task 6, the HoD plain-English rewrite used by the
later translation module.

```sql
-- Additive only (PBS standing order: create forward, never destroy).
ALTER TABLE standards.atoms ADD COLUMN IF NOT EXISTS discharge_mode text;
ALTER TABLE standards.atoms ADD COLUMN IF NOT EXISTS mode_source text;
ALTER TABLE standards.atoms ADD COLUMN IF NOT EXISTS staff_wording text;

COMMENT ON COLUMN standards.atoms.staff_wording IS
  'The HoD''s plain-English rewrite of requirement_text (used from Task 6). Auditor '
  'language translates badly — "Ample clean towels were provided and readily available" '
  'is not a sentence to hand a translator or a housekeeper. This row is what the later '
  'translation module works from (spec 3.0).';

ALTER TABLE standards.atoms DROP CONSTRAINT IF EXISTS atoms_discharge_mode_chk;
ALTER TABLE standards.atoms ADD CONSTRAINT atoms_discharge_mode_chk
  CHECK (discharge_mode IS NULL OR discharge_mode IN ('procedure','rule','evidence','observation'));

ALTER TABLE standards.atoms DROP CONSTRAINT IF EXISTS atoms_mode_source_chk;
ALTER TABLE standards.atoms ADD CONSTRAINT atoms_mode_source_chk
  CHECK (mode_source IS NULL OR mode_source IN ('seeded','edited'));

COMMENT ON COLUMN standards.atoms.discharge_mode IS
  'How this obligation is discharged: procedure (an SOP), rule (a trained constraint), '
  'evidence (proof held on file), observation (scored by audit, never closed by a document).';
COMMENT ON COLUMN standards.atoms.mode_source IS
  'seeded = set by scripts/seed-discharge-modes.mjs; edited = a HoD corrected it. '
  'The seeder NEVER overwrites edited.';

CREATE INDEX IF NOT EXISTS atoms_discharge_mode_idx ON standards.atoms (discharge_mode);
```

## Step 1b — re-emit `v_standards_atoms`

Applied live via `apply_migration`, migration name `v_standards_atoms_discharge_mode`.
`CREATE OR REPLACE VIEW` cannot rename or reorder existing columns, only tail-append —
so the three new columns are appended after `authorities`, and the same three are added
to the `GROUP BY` (the view aggregates over `atom_sources`, so every non-aggregated
column must be grouped; they are all functionally dependent on `atom_id`, the primary
key, so grouping them changes no rows).

```sql
CREATE OR REPLACE VIEW public.v_standards_atoms AS
 SELECT a.atom_id, a.atom_key, a.dept_code, a.dept_code_2, a.title,
    a.requirement_text, a.category,
    count(x.requirement_id) AS source_count,
    string_agg(DISTINCT s.authority, ', '::text ORDER BY s.authority) AS authorities,
    a.discharge_mode,
    a.mode_source,
    a.staff_wording
   FROM standards.atoms a
     LEFT JOIN standards.atom_sources x ON x.atom_id = a.atom_id
     LEFT JOIN standards.requirements r ON r.requirement_id = x.requirement_id
     LEFT JOIN standards.sources s ON s.source_id = r.source_id
  GROUP BY a.atom_id, a.atom_key, a.dept_code, a.dept_code_2, a.title,
           a.requirement_text, a.category,
           a.discharge_mode, a.mode_source, a.staff_wording;

REVOKE ALL ON public.v_standards_atoms FROM anon;
GRANT SELECT ON public.v_standards_atoms TO authenticated, service_role;
```

Verified: `SELECT count(*) atoms, count(discharge_mode) with_mode FROM public.v_standards_atoms;`
returned `atoms=2164` (unchanged from baseline) immediately after the re-emit.

## Step 4 — bridge functions

Applied live via `apply_migration`, migration name `standards_discharge_mode_bridges`.
See `002_discharge_mode_bridges.sql.md` in this directory for the audit copy.
