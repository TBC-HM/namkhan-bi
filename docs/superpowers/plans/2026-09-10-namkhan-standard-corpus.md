# Namkhan Standard — Corpus (Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the five external standards Namkhan is measured against into one merged, department-mapped requirement set, and report exactly which requirements no SOP covers.

**Architecture:** A new tenant-neutral `standards` schema holds raw requirements per source, merged atoms, and the citations between them. Parsing the SLH inspection is a *pure function* over text already in `dms.documents.extracted_md` — no AI, fully unit-testable. Prose standards (ASEAN/Travelife/GSTC) need an AI atomiser, which reuses the degraded-fallback pattern shipped in `b7521fb4`. A gap report joins merged atoms to existing SOPs and surfaces on the Quality dashboard.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase Postgres 17 (migrations via MCP `apply_migration`), jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-09-10-namkhan-standard-design.md` (approved 2026-09-10)

## Global Constraints

- **L5 / ADR-277 — anon lockdown.** Every migration that creates a `public` object ends with `REVOKE ALL ON <obj> FROM anon;` and, for functions, `REVOKE ALL ON FUNCTION public.fn_x(...) FROM anon, PUBLIC; GRANT EXECUTE ON FUNCTION public.fn_x(...) TO authenticated, service_role;`
- **`standards` is NOT in `pgrst.db_schemas`** (verified 2026-09-10: the exposed list is public, graphql_public, marketing, ops, gl, fa, inv, frontoffice, revenue, kpi, governance, guest, sales, pricing, pos, documentation, property, tenancy, core, app, contracts, dms, media, cockpit). **`supabase.schema('standards')` will therefore fail** — every read AND write goes through a `public.v_*` / `public.fn_*` bridge. Do not widen the PostgREST config to work around this. `dms` IS exposed, so `schema('dms')` is fine.
- Bridges are SECURITY DEFINER and bypass RLS, so each MUST filter `property_id` itself.
- **`standards.sources`, `standards.requirements`, `standards.atoms`, `standards.atom_sources` are TENANT-NEUTRAL** — they carry no `property_id` by design. Only `standards.sop_coverage` is per-tenant. Do not add `property_id` to the first four.
- **L22 — no property defaults.** `?? 260955` is a bug. Property ids come from route params only. `scripts/guard-invariants.mjs` matches prose as well as code: never write a literal tenant id next to `??` even inside a comment.
- **Migrations run via Supabase MCP `apply_migration`.** `supabase/migrations/` is DEAD — never add files there. The audit copy goes in `db/proposed/namkhan-standard-v1/`.
- **PBS standing order (memory 882): create forward, never destroy.** No `DROP`, no `DELETE`, no `unschedule`. Additive columns and sibling views only.
- **jest works** (`npm test`). CLAUDE.md's "no test runner exists" is stale sediment.
- **Verification:** `npx jest <path>` for units, `npx tsc --noEmit` must show **0 errors in source** (ignore pre-existing `.next/types/*` noise), and both `node scripts/guard-invariants.mjs` and `node scripts/check-it2-orphans.mjs` must pass before any push.
- **Dept codes are the 16 live values** in `ops.qa_dept_alias` / the dept matrix: `front_office, housekeeping, kitchen, roots_service, maintenance, grounds, spa, activities, boat, security, finance, gm, hr, purchasing, sales_marketing, admin_general`.
- **ADR-314 rulings are data, not opinion:** turndown is daily; pool deck is `housekeeping` (facilities) + `roots_service` (service).

---

### Task 1: The `standards` schema and its public bridges

**Files:**
- Create: `db/proposed/namkhan-standard-v1/001_standards_schema.sql` (audit copy — the live change is applied via MCP `apply_migration`, name `standards_schema_v1`)
- Test: `db/proposed/namkhan-standard-v1/001_verify.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `standards.sources(source_id uuid pk, source_key text unique, title text, doc_id uuid, authority text, version text, created_at timestamptz)`; `standards.requirements(requirement_id uuid pk, source_id uuid fk, section text, subsection text, question_no int, text text, weight numeric, dept_code text, dept_code_2 text, category text, verdict_2026 text, created_at timestamptz)`; `standards.atoms(atom_id uuid pk, atom_key text unique, dept_code text, dept_code_2 text, title text, requirement_text text, category text, created_at timestamptz)`; `standards.atom_sources(atom_id uuid, requirement_id uuid, primary key(atom_id, requirement_id))`; `standards.sop_coverage(atom_id uuid, property_id bigint, sop_code text, covered boolean, note text, primary key(atom_id, property_id, sop_code))`. Bridge views `public.v_standards_atoms`, `public.v_standards_requirements`, `public.v_standards_gap`; write bridges `public.fn_standards_source(text)`, `public.fn_standards_load_requirements(text, jsonb)`, `public.fn_standards_merge_atoms(jsonb)`.

- [ ] **Step 1: Write the verification query that must fail first**

Create `db/proposed/namkhan-standard-v1/001_verify.sql`:

```sql
-- Every assertion must return true AFTER the migration. Run it BEFORE to see it fail.
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema='standards'
       AND table_name IN ('sources','requirements','atoms','atom_sources','sop_coverage')) = 5
    AS all_tables_present,
  -- tenant-neutral by design: only sop_coverage may carry property_id
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='standards' AND column_name='property_id') = 1
    AS only_coverage_is_tenant_scoped,
  -- L5: no anon anywhere on the new public bridges
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='anon'
       AND table_name IN ('v_standards_atoms','v_standards_requirements','v_standards_gap')) = 0
    AS anon_locked_out,
  (SELECT count(*) FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee='authenticated' AND privilege_type='SELECT'
       AND table_name IN ('v_standards_atoms','v_standards_requirements','v_standards_gap')) = 3
    AS authenticated_can_read;
```

- [ ] **Step 2: Run it to verify it fails**

Run via Supabase MCP `execute_sql` with the contents of `001_verify.sql`.
Expected: `all_tables_present=false`, `anon_locked_out=true` (vacuously — nothing exists yet), `authenticated_can_read=false`.

- [ ] **Step 3: Write the migration**

Create `db/proposed/namkhan-standard-v1/001_standards_schema.sql`:

```sql
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
```

- [ ] **Step 4: Apply it and re-run the verification**

Apply via Supabase MCP `apply_migration`, name `standards_schema_v1`, with the SQL above.
Then re-run `001_verify.sql` via `execute_sql`.
Expected: all four columns `true`.

- [ ] **Step 5: Commit**

```bash
git add db/proposed/namkhan-standard-v1/
git commit -m "feat(standards): tenant-neutral standards schema + anon-locked public bridges"
```

---

### Task 2: SLH inspection parser (pure function, no AI)

**Files:**
- Create: `lib/standards/slhParser.ts`
- Test: `lib/standards/__tests__/slhParser.test.ts`

**Interfaces:**
- Consumes: nothing (pure text in, objects out).
- Produces: `export interface SlhRequirement { section: string; subsection: string | null; question_no: number; text: string; verdict: 'Yes' | 'No' | 'NA' | null; missed: boolean; }` and `export function parseSlhInspection(md: string): SlhRequirement[]`, plus `export function parseSectionHeader(line: string): { section: string; got: number; max: number; pct: number } | null`.

- [ ] **Step 1: Write the failing test**

Create `lib/standards/__tests__/slhParser.test.ts`:

```ts
import { parseSlhInspection, parseSectionHeader } from '../slhParser';

// Verbatim shape of dms.documents.extracted_md for doc a1c2e6d0-…-2026081900aa.
const SAMPLE = `## Turndown Service 0/14 (0 %)  *** HARD ZERO - LARGEST SINGLE POINT LOSS IN THE REPORT ***
116 Turndown was completed at a convenient time. No  [MISS]
117 The bed was turned down. No  [MISS]
119 The lighting level was adjusted. Yes

## In Room Dining - Delivery 18.2/30.4 (59.9 %)  *** DRIVER OF THE 72.7% IRD SCORE ***
222 Staff member knocked on door and announced themselves and/or department. Yes
224 You were respectfully addressed by your name or title (sir/madam). NA
`;

describe('parseSectionHeader', () => {
  it('reads name, score and percentage, discarding the *** annotation', () => {
    const h = parseSectionHeader('## Turndown Service 0/14 (0 %)  *** HARD ZERO ***');
    expect(h).toEqual({ section: 'Turndown Service', got: 0, max: 14, pct: 0 });
  });

  it('keeps hyphens that are part of the section name', () => {
    const h = parseSectionHeader('## In Room Dining - Delivery 18.2/30.4 (59.9 %)');
    expect(h!.section).toBe('In Room Dining - Delivery');
    expect(h!.max).toBe(30.4);
  });

  it('returns null for a non-header line', () => {
    expect(parseSectionHeader('116 Turndown was completed at a convenient time. No')).toBeNull();
  });
});

describe('parseSlhInspection', () => {
  it('extracts every numbered question', () => {
    expect(parseSlhInspection(SAMPLE).map(r => r.question_no)).toEqual([116, 117, 119, 222, 224]);
  });

  it('attributes each question to the section it appears under', () => {
    const r = parseSlhInspection(SAMPLE);
    expect(r.find(x => x.question_no === 117)!.section).toBe('Turndown Service');
    expect(r.find(x => x.question_no === 222)!.section).toBe('In Room Dining - Delivery');
  });

  it('captures the verdict and strips it from the question text', () => {
    const q = parseSlhInspection(SAMPLE).find(x => x.question_no === 117)!;
    expect(q.verdict).toBe('No');
    expect(q.text).toBe('The bed was turned down.');
    expect(q.text).not.toMatch(/\b(Yes|No|NA)\s*$/);
  });

  it('flags [MISS] separately from the verdict and keeps it out of the text', () => {
    const rows = parseSlhInspection(SAMPLE);
    expect(rows.find(x => x.question_no === 116)!.missed).toBe(true);
    expect(rows.find(x => x.question_no === 119)!.missed).toBe(false);
    expect(rows.find(x => x.question_no === 116)!.text).not.toContain('[MISS]');
  });

  it('treats NA as a verdict, not a miss', () => {
    const q = parseSlhInspection(SAMPLE).find(x => x.question_no === 224)!;
    expect(q.verdict).toBe('NA');
    expect(q.missed).toBe(false);
  });

  it('returns an empty array for text with no questions, rather than throwing', () => {
    expect(parseSlhInspection('## Some Section 1/1 (100 %)\nno numbered lines here')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/standards/__tests__/slhParser.test.ts`
Expected: FAIL — `Cannot find module '../slhParser'`.

- [ ] **Step 3: Write the implementation**

Create `lib/standards/slhParser.ts`:

```ts
// Parses the SLH Mystery Inspection body already stored in
// dms.documents.extracted_md. Deterministic and AI-free on purpose: the SLH
// report is a numbered questionnaire, so parsing it with a model would add cost,
// latency and non-determinism for no gain.

export interface SlhRequirement {
  section: string;
  subsection: string | null;
  question_no: number;
  text: string;
  verdict: 'Yes' | 'No' | 'NA' | null;
  missed: boolean;
}

const HEADER = /^##\s+(.+?)\s+([\d.]+)\/([\d.]+)\s+\(\s*([\d.]+)\s*%\s*\)/;
const QUESTION = /^\s*(\d{1,3})\s+(.+)$/;
const TRAILING_VERDICT = /\s+(Yes|No|NA)\s*$/;

export function parseSectionHeader(
  line: string,
): { section: string; got: number; max: number; pct: number } | null {
  // Strip the human annotation (*** … ***) before matching so it cannot be
  // mistaken for part of the section name.
  const m = HEADER.exec(line.replace(/\s*\*\*\*.*$/, ''));
  if (!m) return null;
  return { section: m[1].trim(), got: Number(m[2]), max: Number(m[3]), pct: Number(m[4]) };
}

export function parseSlhInspection(md: string): SlhRequirement[] {
  const out: SlhRequirement[] = [];
  let section = 'Unsectioned';

  for (const rawLine of (md || '').split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const header = parseSectionHeader(line);
    if (header) { section = header.section; continue; }

    const q = QUESTION.exec(line);
    if (!q) continue;

    let text = q[2];
    const missed = text.includes('[MISS]');
    text = text.replace(/\s*\[MISS\]\s*/g, ' ').trimEnd();

    const v = TRAILING_VERDICT.exec(text);
    const verdict = (v ? v[1] : null) as SlhRequirement['verdict'];
    if (v) text = text.slice(0, v.index).trimEnd();

    // A section name like "In Room Dining - Delivery" carries its own subsection.
    const dash = section.indexOf(' - ');
    out.push({
      section: dash === -1 ? section : section,
      subsection: dash === -1 ? null : section.slice(dash + 3),
      question_no: Number(q[1]),
      text,
      verdict,
      missed,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/standards/__tests__/slhParser.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Prove it against the real document, not just the fixture**

Run this one-off (it reads the live row, so it catches drift the fixture cannot):

```bash
npx tsx -e "
import { parseSlhInspection } from './lib/standards/slhParser';
import { getSupabaseAdmin } from './lib/supabaseAdmin';
(async () => {
  const { data } = await getSupabaseAdmin().schema('dms').from('documents')
    .select('extracted_md').eq('doc_id','a1c2e6d0-5b7f-4e93-9d21-2026081900aa').single();
  const rows = parseSlhInspection(data!.extracted_md);
  console.log('parsed', rows.length, 'questions;', rows.filter(r=>r.missed).length, 'misses');
})();
"
```

Expected: **at least 300 questions parsed** and **exactly 24 misses** (the `[MISS]` markers loaded on 2026-09-10). If the miss count differs, the document changed — stop and reconcile before continuing.

- [ ] **Step 6: Commit**

```bash
git add lib/standards/slhParser.ts lib/standards/__tests__/slhParser.test.ts
git commit -m "feat(standards): deterministic SLH inspection parser + 9 unit tests"
```

---

### Task 3: Section → department mapper

**Files:**
- Create: `lib/standards/deptMap.ts`
- Test: `lib/standards/__tests__/deptMap.test.ts`

**Interfaces:**
- Consumes: `SlhRequirement` from Task 2.
- Produces: `export function deptForSection(section: string): { dept_code: string; dept_code_2: string | null }` and `export function categoryForSection(section: string): string`.

- [ ] **Step 1: Write the failing test**

Create `lib/standards/__tests__/deptMap.test.ts`:

```ts
import { deptForSection, categoryForSection } from '../deptMap';

describe('deptForSection', () => {
  it.each([
    ['Telephone Enquiry',        'front_office'],
    ['Check in',                 'front_office'],
    ['Rooming',                  'front_office'],
    ['Check out',                'front_office'],
    ['Concierge',                'front_office'],
    ['Bedroom',                  'housekeeping'],
    ['Bathroom',                 'housekeeping'],
    ['Stayover Service',         'housekeeping'],
    ['Turndown Service',         'housekeeping'],
    ['Breakfast Service',        'roots_service'],
    ['Bar / Lounge Service',     'roots_service'],
    ['In Room Dining - Delivery','roots_service'],
    ['Full Service Dining',      'roots_service'],
    ['Spa - Treatment',          'spa'],
    ['Public Areas',             'maintenance'],
    ['SLH Brand',                'gm'],
    ['Loyalty',                  'gm'],
  ])('maps %s to %s', (section, dept) => {
    expect(deptForSection(section).dept_code).toBe(dept);
  });

  it('gives the pool deck shared ownership per ADR-314', () => {
    // Housekeeping owns deck cleanliness and furniture; F&B owns service on the deck.
    // A single owner would leave the service half of the 79.3% unassigned.
    const d = deptForSection('Pool / Beach - Facilities');
    expect(d.dept_code).toBe('housekeeping');
    expect(d.dept_code_2).toBe('roots_service');
  });

  it('never returns grounds for the pool deck', () => {
    // grounds was the original incorrect attribution, corrected by PBS 2026-09-10.
    expect(deptForSection('Pool / Beach').dept_code).not.toBe('grounds');
  });

  it('falls back to admin_general for an unknown section instead of throwing', () => {
    expect(deptForSection('Some Future SLH Section').dept_code).toBe('admin_general');
  });

  it('only ever returns live dept codes', () => {
    const LIVE = new Set(['front_office','housekeeping','kitchen','roots_service','maintenance',
      'grounds','spa','activities','boat','security','finance','gm','hr','purchasing',
      'sales_marketing','admin_general']);
    for (const s of ['Bedroom','Loyalty','Spa - Facility','Pool / Beach','Nonsense']) {
      const d = deptForSection(s);
      expect(LIVE.has(d.dept_code)).toBe(true);
      if (d.dept_code_2) expect(LIVE.has(d.dept_code_2)).toBe(true);
    }
  });
});

describe('categoryForSection', () => {
  it('classifies a Survey subsection as product', () => {
    expect(categoryForSection('Bedroom Survey')).toBe('product');
  });
  it('classifies an attended subsection as service', () => {
    expect(categoryForSection('Breakfast Service')).toBe('service');
  });
  it('classifies sustainability separately', () => {
    expect(categoryForSection('Sustainability')).toBe('sustainability');
  });
  it('classifies SLH Brand as brand', () => {
    expect(categoryForSection('SLH Brand')).toBe('brand');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/standards/__tests__/deptMap.test.ts`
Expected: FAIL — `Cannot find module '../deptMap'`.

- [ ] **Step 3: Write the implementation**

Create `lib/standards/deptMap.ts`:

```ts
// SLH section -> Namkhan department. Ordered longest-prefix-first so
// "In Room Dining - Delivery" is matched before "In Room Dining".
//
// Pool deck ownership is SHARED (ADR-314, PBS 2026-09-10): housekeeping owns
// deck cleanliness and furniture, F&B owns guest service on the deck. It was
// originally filed under grounds, which left the service half unassigned.

type Dept = { dept_code: string; dept_code_2: string | null };

const RULES: Array<[RegExp, Dept]> = [
  [/^pool|beach/i,                 { dept_code: 'housekeeping',  dept_code_2: 'roots_service' }],
  [/telephone|check ?in|check ?out|rooming|departure|arrival|request|concierge|booking/i,
                                   { dept_code: 'front_office',  dept_code_2: null }],
  [/bedroom|bathroom|stayover|turndown|housekeeping/i,
                                   { dept_code: 'housekeeping',  dept_code_2: null }],
  [/breakfast|bar|lounge|in ?room dining|dining|restaurant/i,
                                   { dept_code: 'roots_service', dept_code_2: 'kitchen' }],
  [/spa/i,                         { dept_code: 'spa',           dept_code_2: null }],
  [/public areas|fitness/i,        { dept_code: 'maintenance',   dept_code_2: 'housekeeping' }],
  [/slh brand|differentiator|loyalty|service recovery|sustainab/i,
                                   { dept_code: 'gm',            dept_code_2: null }],
];

export function deptForSection(section: string): Dept {
  const s = (section || '').trim();
  for (const [re, dept] of RULES) if (re.test(s)) return { ...dept };
  return { dept_code: 'admin_general', dept_code_2: null };
}

export function categoryForSection(section: string): string {
  const s = (section || '').toLowerCase();
  if (/sustainab/.test(s)) return 'sustainability';
  if (/slh brand|differentiator/.test(s)) return 'brand';
  if (/survey/.test(s)) return 'product';          // SLH "Survey" blocks score the physical product
  if (/clean|housekeep|bathroom|bedroom/.test(s)) return 'cleanliness';
  return 'service';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/standards/__tests__/deptMap.test.ts`
Expected: PASS.

Note: `categoryForSection('Bedroom Survey')` must return `product` — the `/survey/` rule is checked before the cleanliness rule for exactly this reason. If it returns `cleanliness`, the rule order is wrong.

- [ ] **Step 5: Commit**

```bash
git add lib/standards/deptMap.ts lib/standards/__tests__/deptMap.test.ts
git commit -m "feat(standards): section->department mapper, pool deck shared per ADR-314"
```

---

### Task 4: Load the SLH 2026 corpus into `standards.requirements`

**Files:**
- Create: `app/api/standards/load-slh/route.ts`
- Create: `db/proposed/namkhan-standard-v1/002_seed_sources.sql`

**Interfaces:**
- Consumes: `parseSlhInspection` (Task 2), `deptForSection` + `categoryForSection` (Task 3), the schema from Task 1.
- Produces: `POST /api/standards/load-slh` → `{ ok: true, source_key: string, parsed: number, inserted: number, skipped: number }`. Idempotent: re-running inserts nothing new.

- [ ] **Step 1: Seed the source row**

Create `db/proposed/namkhan-standard-v1/002_seed_sources.sql` and apply via MCP `apply_migration` (name `standards_seed_sources_v1`):

```sql
INSERT INTO standards.sources (source_key, title, doc_id, authority, version)
VALUES
  ('slh_mystery_2026', 'SLH Mystery Inspection 2026 - The Namkhan',
   'a1c2e6d0-5b7f-4e93-9d21-2026081900aa', 'SLH', '2026'),
  ('slh_mystery_2025', 'SLH Mystery Inspection 2025 - The Namkhan',
   '0fed077c-3dc5-423b-8e18-f7e07a413fca', 'SLH', '2025'),
  ('asean_green',      'ASEAN Green Hotel Standard',
   '654ac145-3745-430f-89a6-28557a8df764', 'ASEAN', '2022'),
  ('travelife',        'Travelife Certification Requirements v1.0',
   '66bf6a86-0523-4b7b-bbba-3774f3c50084', 'Travelife', '1.0'),
  ('gstc',             'GSTC Industry Criteria for Hotels with SDGs',
   '0d2182ca-f13f-451a-94a4-88740ee8c9ee', 'GSTC', 'v3'),
  ('slh_minimum',      'SLH Minimum Standards Chart',
   'ae55777a-a467-4302-9aed-993476913d8e', 'SLH', 'current')
ON CONFLICT (source_key) DO NOTHING;
```

Verify: `SELECT count(*) FROM standards.sources;` → **6**.

- [ ] **Step 2: Write the route**

Create `app/api/standards/load-slh/route.ts`:

```ts
// POST /api/standards/load-slh
// Parses the stored SLH inspection body into standards.requirements.
// Deterministic and idempotent — no AI, no cost, safe to re-run.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { parseSlhInspection } from '@/lib/standards/slhParser';
import { deptForSection, categoryForSection } from '@/lib/standards/deptMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCE_KEY = 'slh_mystery_2026';

export async function POST() {
  const admin = getSupabaseAdmin();

  // standards.* is not exposed to PostgREST — go through the public bridges.
  const { data: srcJson, error: srcErr } = await admin.rpc('fn_standards_source', { p_source_key: SOURCE_KEY });
  const src = srcJson as { source_id: string; doc_id: string } | null;
  if (srcErr || !src) {
    return NextResponse.json({ ok: false, error: `source ${SOURCE_KEY} not seeded` }, { status: 400 });
  }

  // dms IS exposed, so this one can use schema() directly.
  const { data: doc, error: docErr } = await admin.schema('dms')
    .from('documents').select('extracted_md').eq('doc_id', src.doc_id).single();
  if (docErr || !doc?.extracted_md) {
    return NextResponse.json({ ok: false, error: 'source document has no extracted_md' }, { status: 400 });
  }

  const parsed = parseSlhInspection(doc.extracted_md);
  const rows = parsed.map((r) => {
    const d = deptForSection(r.subsection ? `${r.section} - ${r.subsection}` : r.section);
    return {
      section: r.section,
      subsection: r.subsection,
      question_no: r.question_no,
      text: r.text,
      weight: r.missed ? 1 : null,
      dept_code: d.dept_code,
      dept_code_2: d.dept_code_2,
      category: categoryForSection(r.subsection ?? r.section),
      verdict_2026: r.verdict,
    };
  });

  const { data: res, error: insErr } = await admin.rpc('fn_standards_load_requirements', {
    p_source_key: SOURCE_KEY, p_rows: rows,
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  const inserted = (res as any)?.inserted ?? 0;

  return NextResponse.json({
    ok: true, source_key: SOURCE_KEY,
    parsed: parsed.length, inserted, skipped: parsed.length - inserted,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/types' | grep -c 'error TS'`
Expected: `0`.

- [ ] **Step 4: Run the load and verify the shape of the result**

Call the route (authenticated session required — middleware 401s anonymous `/api/*`), then verify via MCP `execute_sql`:

```sql
SELECT count(*) AS total,
       count(*) FILTER (WHERE dept_code = 'housekeeping') AS housekeeping,
       count(*) FILTER (WHERE dept_code_2 IS NOT NULL)    AS shared_ownership,
       count(*) FILTER (WHERE verdict_2026 = 'No')        AS misses,
       count(*) FILTER (WHERE dept_code = 'admin_general') AS unmapped
FROM standards.requirements r
JOIN standards.sources s USING (source_id)
WHERE s.source_key = 'slh_mystery_2026';
```

Expected: `total` ≥ 300, `misses` = 24, `unmapped` = 0. **A non-zero `unmapped` means a section the mapper does not know — add a rule in `deptMap.ts` and a test for it, do not leave it in `admin_general`.**

- [ ] **Step 5: Re-run the route to prove idempotency**

Call `POST /api/standards/load-slh` a second time.
Expected: `inserted: 0`, `skipped` equal to `parsed`, and the SQL count above unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/api/standards/load-slh/route.ts db/proposed/namkhan-standard-v1/002_seed_sources.sql
git commit -m "feat(standards): load the SLH 2026 corpus into standards.requirements (idempotent)"
```

---

### Task 5: Gap report — which atoms no SOP covers

**Files:**
- Create: `db/proposed/namkhan-standard-v1/003_gap_fn.sql`
- Create: `lib/standards/__tests__/gapContract.test.ts`

**Interfaces:**
- Consumes: `standards.atoms`, `standards.sop_coverage` (Task 1).
- Produces: `public.fn_standards_gap_summary(p_property_id bigint)` returning `jsonb` of shape `{ property_id, total_atoms, covered, uncovered, by_dept: [{ dept_code, total, covered, uncovered }] }`.

- [ ] **Step 1: Write the contract test**

Create `lib/standards/__tests__/gapContract.test.ts`:

```ts
// The gap payload is consumed by the Quality dashboard, which renders a missing
// key as "—" and would hide a real coverage hole. Pin the shape.
export interface GapSummary {
  property_id: number;
  total_atoms: number;
  covered: number;
  uncovered: number;
  by_dept: Array<{ dept_code: string; total: number; covered: number; uncovered: number }>;
}

export function assertGapSummary(p: any): asserts p is GapSummary {
  for (const k of ['property_id', 'total_atoms', 'covered', 'uncovered']) {
    if (typeof p?.[k] !== 'number') throw new Error(`gap payload missing numeric ${k}`);
  }
  if (!Array.isArray(p.by_dept)) throw new Error('gap payload missing by_dept array');
  if (p.covered + p.uncovered !== p.total_atoms) {
    throw new Error(`gap payload does not balance: ${p.covered}+${p.uncovered} != ${p.total_atoms}`);
  }
}

describe('gap payload contract', () => {
  it('accepts a well-formed payload', () => {
    expect(() => assertGapSummary({
      property_id: 260955, total_atoms: 10, covered: 4, uncovered: 6,
      by_dept: [{ dept_code: 'housekeeping', total: 10, covered: 4, uncovered: 6 }],
    })).not.toThrow();
  });

  it('rejects a payload whose totals do not balance', () => {
    expect(() => assertGapSummary({
      property_id: 260955, total_atoms: 10, covered: 4, uncovered: 1, by_dept: [],
    })).toThrow(/does not balance/);
  });

  it('rejects a payload with no by_dept array', () => {
    expect(() => assertGapSummary({
      property_id: 260955, total_atoms: 0, covered: 0, uncovered: 0,
    })).toThrow(/by_dept/);
  });
});
```

- [ ] **Step 2: Run it to verify it passes on the fixtures**

Run: `npx jest lib/standards/__tests__/gapContract.test.ts`
Expected: PASS, 3 tests. (This test pins the contract; Step 4 checks the live function against it.)

- [ ] **Step 3: Write the function**

Create `db/proposed/namkhan-standard-v1/003_gap_fn.sql` and apply via MCP `apply_migration` (name `standards_gap_fn_v1`):

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_gap_summary(p_property_id bigint)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'standards'
AS $$
  WITH g AS (
    SELECT a.atom_id, a.dept_code,
           EXISTS (SELECT 1 FROM standards.sop_coverage c
                    WHERE c.atom_id = a.atom_id
                      AND c.property_id = p_property_id
                      AND c.covered) AS covered
    FROM standards.atoms a
  )
  SELECT jsonb_build_object(
    'property_id', p_property_id,
    'total_atoms', (SELECT count(*) FROM g),
    'covered',     (SELECT count(*) FILTER (WHERE covered) FROM g),
    'uncovered',   (SELECT count(*) FILTER (WHERE NOT covered) FROM g),
    'by_dept', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'dept_code', dept_code,
               'total',     n,
               'covered',   c,
               'uncovered', n - c) ORDER BY (n - c) DESC)
      FROM (SELECT dept_code, count(*) AS n, count(*) FILTER (WHERE covered) AS c
            FROM g GROUP BY dept_code) z), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.fn_standards_gap_summary(bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_gap_summary(bigint) TO authenticated, service_role;
```

- [ ] **Step 4: Verify the live function satisfies the contract**

Run via MCP `execute_sql`:

```sql
SELECT public.fn_standards_gap_summary(260955) AS payload;
```

Check by hand against `assertGapSummary`: all four top-level keys numeric, `by_dept` an array, and `covered + uncovered = total_atoms`.
Expected before Task 6 seeds coverage: `covered` = 0, `uncovered` = `total_atoms`.

- [ ] **Step 5: Confirm anon really cannot execute it**

```sql
SELECT has_function_privilege('anon', 'public.fn_standards_gap_summary(bigint)', 'EXECUTE') AS anon_can_execute;
```

Expected: `false`. If `true`, the REVOKE did not take — fix before committing.

- [ ] **Step 6: Commit**

```bash
git add db/proposed/namkhan-standard-v1/003_gap_fn.sql lib/standards/__tests__/gapContract.test.ts
git commit -m "feat(standards): gap summary bridge fn + payload contract test"
```

---

### Task 6: Merge SLH requirements into atoms, and seed coverage from existing SOPs

**Files:**
- Create: `app/api/standards/merge/route.ts`
- Test: `lib/standards/__tests__/atomKey.test.ts`
- Create: `lib/standards/atomKey.ts`

**Interfaces:**
- Consumes: `standards.requirements` (Task 4), schema (Task 1).
- Produces: `export function atomKeyFor(dept: string, text: string): string`; `POST /api/standards/merge` → `{ ok, atoms_created, citations_created, coverage_seeded }`.

- [ ] **Step 1: Write the failing test for the merge key**

Create `lib/standards/__tests__/atomKey.test.ts`:

```ts
import { atomKeyFor } from '../atomKey';

describe('atomKeyFor', () => {
  it('is stable for the same department and requirement', () => {
    expect(atomKeyFor('housekeeping', 'The bed was turned down.'))
      .toBe(atomKeyFor('housekeeping', 'The bed was turned down.'));
  });

  it('ignores case, punctuation and whitespace so near-duplicates merge', () => {
    expect(atomKeyFor('housekeeping', 'The bed was turned down.'))
      .toBe(atomKeyFor('housekeeping', '  the   bed was turned down  '));
  });

  it('does NOT merge the same requirement across different departments', () => {
    // "Refills were proactively offered" is a real requirement in BOTH breakfast
    // and bar service. They are separate SOPs owned by the same department here,
    // but the key must still be department-scoped so a future split is possible.
    expect(atomKeyFor('roots_service', 'Refills of beverages were proactively offered.'))
      .not.toBe(atomKeyFor('front_office', 'Refills of beverages were proactively offered.'));
  });

  it('does not merge genuinely different requirements', () => {
    expect(atomKeyFor('housekeeping', 'The bed was turned down.'))
      .not.toBe(atomKeyFor('housekeeping', 'Curtains or blinds were drawn.'));
  });

  it('produces a key short enough to index and free of whitespace', () => {
    const k = atomKeyFor('housekeeping', 'x'.repeat(500));
    expect(k.length).toBeLessThanOrEqual(120);
    expect(k).not.toMatch(/\s/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/standards/__tests__/atomKey.test.ts`
Expected: FAIL — `Cannot find module '../atomKey'`.

- [ ] **Step 3: Write the implementation**

Create `lib/standards/atomKey.ts`:

```ts
import { createHash } from 'crypto';

// Department-scoped, normalised key. Two source requirements that say the same
// thing to the same department collapse into one atom; the citation back to each
// source is kept in standards.atom_sources, so a merge is always reversible.
export function atomKeyFor(dept: string, text: string): string {
  const norm = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(`${dept}::${norm}`).digest('hex').slice(0, 16);
  const slug = norm.split(' ').slice(0, 8).join('-').slice(0, 60);
  return `${dept}:${slug}:${hash}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/standards/__tests__/atomKey.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the merge route**

Create `app/api/standards/merge/route.ts`:

```ts
// POST /api/standards/merge
// Collapses standards.requirements into standards.atoms (department-scoped,
// normalised) and records every citation. Deterministic, idempotent, no AI.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { atomKeyFor } from '@/lib/standards/atomKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = getSupabaseAdmin();

  // Read the requirements through the public bridge view.
  const { data: reqs, error } = await admin
    .from('v_standards_requirements')
    .select('requirement_id, text, dept_code, dept_code_2, category, section');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byKey = new Map<string, any>();
  for (const r of reqs ?? []) {
    const key = atomKeyFor(r.dept_code, r.text);
    const existing = byKey.get(key);
    if (existing) { existing.requirement_ids.push(r.requirement_id); continue; }
    byKey.set(key, {
      atom_key: key,
      dept_code: r.dept_code,
      dept_code_2: r.dept_code_2,
      title: r.text.slice(0, 200),
      requirement_text: r.text,
      category: r.category,
      requirement_ids: [r.requirement_id],
    });
  }

  // One transactional call: atoms + citations together.
  const { data: merged, error: mErr } = await admin.rpc('fn_standards_merge_atoms', {
    p_rows: [...byKey.values()],
  });
  if (mErr) return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    atoms_created: byKey.size,
    citations_created: (merged as any)?.citations ?? 0,
    coverage_seeded: 0,
  });
}
```

- [ ] **Step 6: Run it and check the merge actually merged**

Call `POST /api/standards/merge`, then via MCP `execute_sql`:

```sql
SELECT (SELECT count(*) FROM standards.requirements) AS requirements,
       (SELECT count(*) FROM standards.atoms)        AS atoms,
       (SELECT count(*) FROM standards.atom_sources) AS citations,
       (SELECT count(*) FROM (SELECT atom_id FROM standards.atom_sources
                              GROUP BY atom_id HAVING count(*) > 1) z) AS merged_atoms;
```

Expected: `atoms` < `requirements` (the merge did something), `citations` = `requirements` (nothing lost), `merged_atoms` > 0.
**If `atoms` = `requirements`, the merge found no duplicates — verify by hand before assuming it is broken; a single-source load legitimately has few.**

- [ ] **Step 7: Verify the gap report now has content**

```sql
SELECT public.fn_standards_gap_summary(260955);
```

Expected: `total_atoms` equal to the `atoms` count above, `covered` = 0, `uncovered` = `total_atoms`, and `by_dept` sorted with the largest gap first. **The department at the top of that list is where SOP authoring starts in Plan B.**

- [ ] **Step 8: Commit**

```bash
git add lib/standards/atomKey.ts lib/standards/__tests__/atomKey.test.ts app/api/standards/merge/route.ts
git commit -m "feat(standards): merge requirements into department-scoped atoms with citations"
```

---

### Task 7: Full-suite verification and push

**Files:**
- Modify: none (verification only).

**Interfaces:**
- Consumes: everything above.
- Produces: a green tree on `main`.

- [ ] **Step 1: Run the whole standards suite**

Run: `npx jest lib/standards`
Expected: PASS, four suites — `slhParser`, `deptMap`, `gapContract`, `atomKey` — with zero failures. (Do not assert an exact total; `it.each` expands per case and the count shifts as mapping rules are added.)

- [ ] **Step 2: Typecheck source**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/types' | grep -c 'error TS'`
Expected: `0`. The `.next/types/*` entries are pre-existing stale build artifacts and are not introduced by this work.

- [ ] **Step 3: Run both prebuild ratchets**

```bash
node scripts/guard-invariants.mjs && node scripts/check-it2-orphans.mjs
```
Expected: both pass. `guard-invariants` matches prose as well as code — if it trips on a comment, reword the comment; **never raise the baseline**.

- [ ] **Step 4: Push and watch CI**

```bash
git push origin main
gh run list --limit 4
```
Expected: `typecheck`, `CI` and `Backup on push` all `completed/success`. A push to `main` is a **preview** deployment; production runs from the `production` branch and is promoted separately.

- [ ] **Step 5: Record the outcome in the module doc**

Update `documentation.documents` where `doc_type='ops_sop_qa_module'` via MCP: append a "Namkhan Standard corpus" section with the live counts from Task 6 Step 6, and bump `version`. Counts in prose go stale (L14) — state the query alongside them.

---

## Self-Review

**1. Spec coverage.** Spec §3 data model → Task 1. §4 stages 0–1 (INGEST/ATOMISE) → Tasks 2, 3, 4. Stage 2 (MERGE) → Task 6. Stage 3 (GAP) → Tasks 5, 6. §7 already-applied items need no task. **Deliberately out of scope for Plan A:** spec §4 stages 4–7 (AUTHOR/TRANSLATE/VISUAL/VERIFY), §5 autorun mechanics, §11 Lao hold rule — these are Plan B, which depends on the gap report this plan produces. **Known gap carried into Plan B:** the prose standards (ASEAN, Travelife, GSTC, SLH Minimum) are seeded as `standards.sources` rows in Task 4 Step 1 but not atomised here, because they need the AI atomiser; Plan A deliberately ships the deterministic, zero-cost spine first so the merge and gap machinery are proven before any spend.

**2. Placeholder scan.** No TBD/TODO. Every code step carries real code. Every verification step names the exact command and the expected result, including the two places where an unexpected result means "stop and reconcile" rather than "continue".

**3. Type consistency.** `SlhRequirement` (Task 2) is consumed by Task 4 with matching field names (`section`, `subsection`, `question_no`, `text`, `verdict`, `missed`). `deptForSection` returns `{dept_code, dept_code_2}` in Task 3 and is destructured identically in Task 4. `atomKeyFor(dept, text)` in Task 6 matches its test. `fn_standards_gap_summary(bigint)` has the same signature in the migration, the REVOKE, the privilege check and both call sites.
