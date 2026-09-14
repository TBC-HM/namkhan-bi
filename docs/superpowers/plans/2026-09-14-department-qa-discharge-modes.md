# Department QA & Discharge Modes — Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every department its own QA page, where its obligations are grouped by how they are actually discharged — procedure, rule, evidence, observation — and a HoD can correct any of it in place.

**Architecture:** A pure TS classifier (`lib/standards/dischargeMode.ts`, mirroring the existing `deptMap.ts`) assigns a mode to each of the 2,164 atoms; a seed script writes them; `standards.atoms` gains `discharge_mode` + `mode_source` so HoD edits survive re-seeding. One new SECURITY DEFINER bridge, `fn_dept_qa_payload(pid, dept)`, feeds a new server-component page at `/h/[property_id]/operations/quality/[dept]`. Editing goes through a single tenancy-checked PATCH route.

**Tech Stack:** Next.js 14 App Router (RSC), TypeScript, Supabase Postgres 17 via MCP `apply_migration`, jest + ts-jest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-14-department-qa-and-self-audit-design.md`

**Plan 2 (not this plan):** the self-audit engine, the phone run surface, and SLH analytics — spec §3 Parts C and D.

## Global Constraints

- **npm only** (`package-lock.json`). Never pnpm/yarn. Commit lockfile changes with `package.json`.
- **`npx tsc --noEmit` is the only honest type gate** — `next.config.js` sets `ignoreBuildErrors: true`, so Vercel builds succeed on type errors. Run it before every push.
- **Pre-existing baseline, do not "fix" and do not be confused by it:** `tsc --noEmit` reports **8 errors** in `app/marketing/page.tsx` and `lib/rules/marketing.ts`. They are on `origin/main`, unrelated to this work. Your bar is **zero NEW errors**, checked with `npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -E '^\S+\(' | grep -v marketing`.
- **Never run bare `npm test`** — `jest.config.js` has `roots: ['<rootDir>']`, which picks up `.claude/worktrees` and reports ~50 failures belonging to other sessions. Always run targeted: `npx jest <path>`.
- **`npm run prebuild` must pass** (it2-orphans + guard-invariants) before every push.
- **No `property_id` defaults.** `?? 260955` is a bug and fails the prebuild ratchet. Resolve from the route param; missing = 400, not Namkhan.
- **Every API route touching tenant data** starts with `requirePropertyAccess(req, rawPropertyId)` from `lib/tenancy.ts`.
- **Every new `public.v_*` / `fn_*`** ends with `REVOKE ALL ... FROM anon;` and `GRANT ... TO authenticated, service_role;` (ADR-277).
- **`supabase/migrations/` is DEAD.** Schema changes go via Supabase MCP `apply_migration`. Audit copies under `db/proposed/dept-qa/`.
- **Server reads use `getSupabaseAdmin()`** from `lib/supabaseAdmin.ts`. **Never import `@/lib/supabase` in a `'use client'` file** — it silently downgrades to anon.
- **Theme tokens under `app/h/[property_id]/**`:** `--tbl-bg`, `--tbl-fg`, `--tbl-fg-mute`, `--tbl-border`, `--tbl-border-strong`, `--tbl-bg-elev`. Never `--ink-*`/`--bd-*`/`--surf-*` — they render black-on-black on Donna.
- **Never define a React component inside an async Server Component** and use it as `<Component/>` — runtime Digest crash with no build error.
- **Spec §3.0 — content lives in rows, not components.** Any string a user reads that is content (obligation text, HoD re-wording, SOP body, finding text) comes from a row carrying a `language` column. Only chrome (headings, buttons, status words) may be literal in TSX. This is what makes the later translation module additive.
- **Property IDs:** Namkhan 260955, Donna 1000001. Never hardcode; take from route params.
- **Dates/numbers:** hand-built UTC helpers, never `Intl` — Node's ICU and the browser's disagree on NBSP vs U+202F, which React reports as hydration error #425.

---

### Task 1: Discharge-mode classifier

Pure function, no I/O, mirroring `lib/standards/deptMap.ts`. This is the one piece with real branching logic, so it is the one piece that gets a real test.

**Files:**
- Create: `lib/standards/dischargeMode.ts`
- Test: `lib/standards/__tests__/dischargeMode.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type DischargeMode = 'procedure' | 'rule' | 'evidence' | 'observation'` and `export function dischargeModeFor(input: { authority: string; sourceTitle: string; category: string | null; text: string }): DischargeMode`

- [ ] **Step 1: Write the failing test**

```ts
// lib/standards/__tests__/dischargeMode.test.ts
import { dischargeModeFor } from '../dischargeMode';

const slh = (text: string) => ({
  authority: 'SLH', sourceTitle: 'SLH Mystery Inspection 2026 - The Namkhan',
  category: 'service', text,
});

describe('SLH mystery inspection is always an observation', () => {
  it.each([
    'Your first impressions of the bathroom met expectations of a luxury experience.',
    'You were respectfully addressed by your name or title (sir/madam).',
    'Check/tab was presented and processed seamlessly.',
    'Welcome amenity was offered upon arrival (i.e. cold towel, beverage, local amenity).',
    'A towel and/or linen reuse program was implemented and followed by housekeeping staff.',
  ])('%s', (text) => {
    expect(dischargeModeFor(slh(text))).toBe('observation');
  });

  it('does NOT catch the SLH Minimum Standards Chart, which is not an inspection', () => {
    expect(dischargeModeFor({
      authority: 'SLH', sourceTitle: 'SLH Minimum Standards Chart',
      category: 'service', text: 'Rooms are serviced daily.',
    })).toBe('procedure');
  });
});

describe('sustainability-family authorities are evidence unless prohibitive', () => {
  const sus = (text: string, authority = 'GSTC') =>
    ({ authority, sourceTitle: 'GSTC Industry Criteria', category: 'sustainability', text });

  it.each([
    ['Land ownership and tenure rights are documented.', 'evidence'],
    ['Goals for reducing energy consumption are in place.', 'evidence'],
    ['Keep an up-to-date list of all legislation.', 'evidence'],
    ['Is your current Travelife certificate displayed?', 'evidence'],
  ])('%s -> %s', (text, mode) => {
    expect(dischargeModeFor(sus(text))).toBe(mode);
  });

  it('a prohibition is a rule even in a sustainability source', () => {
    expect(dischargeModeFor(sus('Shall not misuse the certificate or the certification logo.')))
      .toBe('rule');
  });
});

describe('procedure-shaped categories', () => {
  it.each([
    ['PM', 'Namkhan Preventive Maintenance Catalogue', 'compliance', 'AC filter clean (per room)'],
    ['Namkhan', 'Namkhan Service & Operations Standards', 'service_operations', 'Evening turndown service'],
    ['SLH', 'SLH Minimum Standards Chart', 'cleanliness', 'Bathroom surfaces disinfected daily'],
  ])('%s/%s -> procedure', (authority, sourceTitle, category, text) => {
    expect(dischargeModeFor({ authority, sourceTitle, category, text })).toBe('procedure');
  });
});

describe('house commercial standards split on prohibition', () => {
  const house = (text: string) => ({
    authority: 'Namkhan', sourceTitle: 'Namkhan House Operating Standards',
    category: 'commercial', text,
  });
  it('a prohibition is a rule', () => {
    expect(dischargeModeFor(house('The rate floor is Owner-only — the floor is never cut.')))
      .toBe('rule');
  });
  it('a cadence is a procedure', () => {
    expect(dischargeModeFor(house('Rate review runs weekly — Monday, 90 minutes maximum.')))
      .toBe('procedure');
  });
});

describe('unmatched defaults to procedure (asks the most, never silently excuses)', () => {
  it('falls through', () => {
    expect(dischargeModeFor({
      authority: 'Unknown', sourceTitle: 'Something new', category: null, text: 'A thing.',
    })).toBe('procedure');
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx jest lib/standards/__tests__/dischargeMode.test.ts`
Expected: FAIL — `Cannot find module '../dischargeMode'`

- [ ] **Step 3: Write the classifier**

```ts
// lib/standards/dischargeMode.ts
//
// How is this obligation actually discharged? The Standard measured all 2,164
// against one question — "is there an SOP?" — which is a category error for most of
// them. Demanding an SOP for "You felt safe and secure at all times during the stay"
// cannot succeed; that is an inspector's verdict, not a procedure.
//
// RULES ARE ORDERED MOST-SPECIFIC-FIRST and the order is load-bearing, exactly as in
// deptMap.ts. The mystery-inspection rule must precede every category rule, because
// those requirements carry service/cleanliness/brand categories and would otherwise be
// classified as procedures.

export type DischargeMode = 'procedure' | 'rule' | 'evidence' | 'observation';

export interface DischargeInput {
  authority: string;
  sourceTitle: string;
  category: string | null;
  text: string;
}

// "shall not", "never", "must not", "is prohibited", "only <role> may"
const PROHIBITION = /\b(shall not|must not|never|may not|is prohibited|are prohibited|do not|owner-only)\b/i;

// A thing you hold and can show: a document, a record, a register, a goal on paper.
const EVIDENCE_WORDS =
  /\b(document|documented|record|recorded|register|registry|list|policy|policies|plan|certificate|certification|report|goals?|written|in writing|evidence|log|displayed|published|available (?:to|for) (?:guests|public)|awareness of)\b/i;

// Authorities whose corpus is overwhelmingly "hold proof of this", not "do this".
const EVIDENCE_AUTHORITIES = new Set(['GSTC', 'Travelife', 'Sustainability', 'ASEAN', 'Legal']);

// Categories that describe a repeatable act someone performs.
const PROCEDURE_CATEGORIES = new Set([
  'service', 'cleanliness', 'service_operations', 'product', 'safety',
]);

export function dischargeModeFor(input: DischargeInput): DischargeMode {
  const text = (input.text || '').trim();
  const title = (input.sourceTitle || '').trim();
  const category = (input.category || '').trim();
  const authority = (input.authority || '').trim();

  // 1. A mystery inspection records what an inspector EXPERIENCED. Uniformly past
  //    tense and second person ("You were respectfully addressed by your name").
  //    Source-level, not wording-level: the wording is consistent enough that a
  //    regex on tense would only add false negatives.
  if (/mystery inspection/i.test(title)) return 'observation';

  // 2. A prohibition is a standing rule wherever it appears — it outranks the
  //    authority default, so "shall not misuse the certification logo" in a
  //    sustainability source is a rule, not a document to file.
  if (PROHIBITION.test(text)) return 'rule';

  // 3. Brand obligations are constraints on how we present ourselves.
  if (category === 'brand') return 'rule';

  // 4. Preventive maintenance is scheduled work, always.
  if (authority === 'PM') return 'procedure';

  // 5. Categories that name an act.
  if (PROCEDURE_CATEGORIES.has(category)) return 'procedure';

  // 6. Compliance-family authorities: a document unless it named an act above.
  if (EVIDENCE_AUTHORITIES.has(authority)) return 'evidence';

  // 7. Anything else that talks like paperwork.
  if (EVIDENCE_WORDS.test(text)) return 'evidence';

  // 8. Default to the mode that ASKS THE MOST. A wrong `procedure` shows a HoD an
  //    Activate CTA they can dismiss; a wrong `evidence` silently excuses a real
  //    procedure from ever needing an SOP.
  return 'procedure';
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx jest lib/standards/__tests__/dischargeMode.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Confirm no new type errors**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -E '^\S+\(' | grep -v marketing`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/standards/dischargeMode.ts lib/standards/__tests__/dischargeMode.test.ts
git commit -m "feat(standards): classify how each obligation is actually discharged

Four modes, not one question. The Standard measured all 2,164 obligations against
'is there an SOP?', which is a category error for most: you cannot write an SOP for
'You felt safe and secure at all times during the stay'.

Ordered most-specific-first like deptMap.ts, and the order is load-bearing — the
mystery-inspection rule must precede the category rules or 338 SLH observations get
classified as procedures. Unmatched defaults to procedure deliberately: a wrong
procedure shows a dismissable CTA, a wrong evidence silently excuses a real one."
```

---

### Task 2: Column, seed, and verified counts

**Files:**
- Create: `db/proposed/dept-qa/001_discharge_mode.sql.md` (audit copy of the migration)
- Create: `scripts/seed-discharge-modes.mjs`
- Migration applied via MCP `apply_migration`, name `atoms_discharge_mode`

**Interfaces:**
- Consumes: `dischargeModeFor` from Task 1.
- Produces: `standards.atoms.discharge_mode` (text, nullable) and `standards.atoms.mode_source` (text, `'seeded' | 'edited'`).

- [ ] **Step 1: Apply the migration via MCP**

All three columns land here, together, even though `staff_wording` is not used until
Task 6 — Tasks 3, 4 and 5 all read `v_standards_atoms`, and that view is re-emitted
once at Step 1b below. Splitting the columns across tasks would mean re-emitting the
view twice and would leave Task 4 selecting a column that does not exist yet.

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

- [ ] **Step 1b: Re-emit `v_standards_atoms` to expose the three new columns**

Tasks 3, 4 and 5 all read this view; none of them work until it carries the columns.
`CREATE OR REPLACE VIEW` **cannot rename or reorder columns — appending to the tail is
safe, anything else needs DROP then CREATE.** These three are appended, so a replace is
fine. Fetch the current definition first — do not work from an old copy:

```sql
SELECT pg_get_viewdef('public.v_standards_atoms'::regclass, true);
```

Re-emit it with `a.discharge_mode`, `a.mode_source`, `a.staff_wording` added to the
SELECT list **after** the existing columns, and to the `GROUP BY` (the view aggregates
over `atom_sources`, so every non-aggregated column must be grouped). Then:

```sql
REVOKE ALL ON public.v_standards_atoms FROM anon;
GRANT SELECT ON public.v_standards_atoms TO authenticated, service_role;
```

Verify nothing regressed — the count must be unchanged at 2,164:

```sql
SELECT count(*) AS atoms, count(discharge_mode) AS with_mode FROM public.v_standards_atoms;
```

- [ ] **Step 2: Save the audit copy**

Write the exact SQL above to `db/proposed/dept-qa/001_discharge_mode.sql.md` with a one-paragraph header explaining why the column exists. `supabase/migrations/` is dead — do not add a file there.

- [ ] **Step 3: Write the seed script**

```js
// scripts/seed-discharge-modes.mjs
//
// Classifies every atom that has no HoD correction. Re-runnable: rows with
// mode_source='edited' are never touched, so a HoD's fix survives every re-seed.
import { createClient } from '@supabase/supabase-js';
import { dischargeModeFor } from '../lib/standards/dischargeMode.ts';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await sb.rpc('fn_standards_atoms_for_classification');
if (error) { console.error(error); process.exit(1); }

const updates = rows
  .filter((r) => r.mode_source !== 'edited')
  .map((r) => ({
    atom_id: r.atom_id,
    discharge_mode: dischargeModeFor({
      authority: r.authority ?? '', sourceTitle: r.source_title ?? '',
      category: r.category, text: r.requirement_text ?? '',
    }),
  }));

const { error: wErr } = await sb.rpc('fn_standards_set_discharge_modes', { p_rows: updates });
if (wErr) { console.error(wErr); process.exit(1); }

const counts = updates.reduce((a, u) => ({ ...a, [u.discharge_mode]: (a[u.discharge_mode] ?? 0) + 1 }), {});
console.log(`classified ${updates.length} atoms:`, counts);
```

- [ ] **Step 4: Add the two bridges the script needs**

Apply via MCP, migration name `standards_discharge_mode_bridges`:

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_atoms_for_classification()
RETURNS TABLE (atom_id uuid, authority text, source_title text, category text,
               requirement_text text, mode_source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','standards','pg_temp'
AS $$
  SELECT a.atom_id,
         (SELECT min(s.authority) FROM standards.atom_sources x
            JOIN standards.requirements r ON r.requirement_id = x.requirement_id
            JOIN standards.sources s ON s.source_id = r.source_id
           WHERE x.atom_id = a.atom_id),
         (SELECT min(s.title) FROM standards.atom_sources x
            JOIN standards.requirements r ON r.requirement_id = x.requirement_id
            JOIN standards.sources s ON s.source_id = r.source_id
           WHERE x.atom_id = a.atom_id),
         a.category, a.requirement_text, a.mode_source
    FROM standards.atoms a;
$$;

CREATE OR REPLACE FUNCTION public.fn_standards_set_discharge_modes(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','standards','pg_temp'
AS $$
DECLARE v int;
BEGIN
  UPDATE standards.atoms a
     SET discharge_mode = e->>'discharge_mode', mode_source = 'seeded'
    FROM jsonb_array_elements(p_rows) e
   WHERE a.atom_id = (e->>'atom_id')::uuid
     AND COALESCE(a.mode_source, 'seeded') <> 'edited';   -- never clobber a HoD fix
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v);
END $$;

REVOKE ALL ON FUNCTION public.fn_standards_atoms_for_classification() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.fn_standards_set_discharge_modes(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_atoms_for_classification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_standards_set_discharge_modes(jsonb) TO authenticated, service_role;
```

- [ ] **Step 5: Run the seeder and verify the split is sane**

Run: `node --experimental-strip-types scripts/seed-discharge-modes.mjs`

Then verify via MCP:

```sql
SELECT discharge_mode, count(*) FROM standards.atoms GROUP BY 1 ORDER BY 2 DESC;
SELECT count(*) AS unclassified FROM standards.atoms WHERE discharge_mode IS NULL;
```

Expected: `unclassified = 0`; `observation` ≈ 338 (the SLH 2026 mystery inspection);
`procedure` the largest group; all four modes present. **If `observation` is not ~338,
the ordering in Task 1 is wrong — the mystery-inspection rule is being shadowed.**

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-discharge-modes.mjs db/proposed/dept-qa/001_discharge_mode.sql.md
git commit -m "feat(standards): seed discharge modes, never clobbering a HoD fix

mode_source='edited' is the latch: the seeder is re-runnable forever and a HoD's
correction survives every run. Verified observation lands at ~338, which is the SLH
2026 mystery inspection — if that number moves, a category rule is shadowing the
source rule and the ordering has regressed."
```

---

### Task 3: Per-mode coverage in the Standard payload

**Files:**
- Modify: `public.fn_standards_payload` (MCP, migration `standards_payload_per_mode_coverage`)
- Modify: `app/h/[property_id]/operations/standard/types.ts`
- Modify: `app/h/[property_id]/operations/standard/StandardBrowser.tsx`

**Interfaces:**
- Consumes: `standards.atoms.discharge_mode` from Task 2.
- Produces: `totals.by_mode` — an array of `{ mode, atoms, covered, coverable }`, where `coverable` is false for `rule` (no training store exists) and for `observation` (scored by audit, never closed).

- [ ] **Step 1: Extend the payload**

Re-emit `fn_standards_payload` (fetch the current definition first with `pg_get_functiondef` — it has been modified three times today; do not work from an old copy) and add to the `totals` object:

```sql
'by_mode', (
  SELECT COALESCE(jsonb_agg(x ORDER BY x.atoms DESC), '[]'::jsonb) FROM (
    SELECT COALESCE(a.discharge_mode,'procedure') AS mode,
           count(*) AS atoms,
           count(*) FILTER (WHERE a.covered) AS covered,
           -- `rule` has NO training store anywhere on the platform, and `observation`
           -- is scored by audit, never closed by a document. Reporting 0% for either
           -- would read as failure; reporting 100% would be a lie. The UI shows
           -- neither, and this flag is how it knows.
           (COALESCE(a.discharge_mode,'procedure') IN ('procedure','evidence')) AS coverable
      FROM a GROUP BY 1) x
),
```

End the migration with the standard REVOKE/GRANT pair.

- [ ] **Step 2: Verify against live data**

```sql
SELECT public.fn_standards_payload(260955, NULL)->'totals'->'by_mode';
```

Expected: four rows; `atoms` across them sums to 2,164; `coverable` true only for
`procedure` and `evidence`.

- [ ] **Step 3: Add the type**

```ts
// app/h/[property_id]/operations/standard/types.ts — add to StandardTotals
/** coverage split by how each obligation is actually discharged */
by_mode: Array<{
  mode: 'procedure' | 'rule' | 'evidence' | 'observation';
  atoms: number;
  covered: number;
  /** false for rule (no training store exists) and observation (scored, not closed) */
  coverable: boolean;
}>;
```

- [ ] **Step 4: Replace the single coverage stat with the honest split**

In `StandardBrowser.tsx`, under the existing stat grid, render one line per mode. For
`coverable: false`, print the count and the reason instead of a percentage:

```tsx
{(t?.by_mode ?? []).map((m) => (
  <li key={m.mode} className="flex flex-wrap items-baseline gap-x-2">
    <b className="capitalize">{m.mode}</b>
    <span className="tabular-nums">{nInt(m.atoms)}</span>
    {m.coverable
      ? <span className="text-neutral-600">
          {nInt(m.covered)} covered · {((100 * m.covered) / Math.max(m.atoms, 1)).toFixed(1)}%
        </span>
      : <span className="text-neutral-500">
          {m.mode === 'rule'
            ? 'no coverage measure — there is no training store yet'
            : 'scored by audit, never closed by a document'}
        </span>}
  </li>
))}
```

- [ ] **Step 5: Typecheck, guards**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -E '^\S+\(' | grep -v marketing` → no output
Run: `npm run prebuild` → both guards pass

- [ ] **Step 6: Commit**

```bash
git add "app/h/[property_id]/operations/standard/types.ts" "app/h/[property_id]/operations/standard/StandardBrowser.tsx"
git commit -m "fix(standards): 12% coverage was a category error, not a score

Coverage split by discharge mode. procedure and evidence get a real percentage; rule
and observation get a stated reason instead of a number, because there is no training
store on the platform and an observation is scored by audit rather than closed by a
document. A 0% there would read as failure and a 100% would be a lie."
```

---

### Task 4: The department QA bridge

**Files:**
- Create: `public.fn_dept_qa_payload(bigint, text)` via MCP, migration `dept_qa_payload`
- Create: `db/proposed/dept-qa/002_dept_qa_payload.sql.md`

**Interfaces:**
- Consumes: `discharge_mode` (Task 2), `ops.departments`, `ops.v_staff_register`, `knowledge.qa_audits`, `standards.sop_coverage`, `knowledge.qa_findings`.
- Produces: one jsonb payload with keys `dept`, `people`, `obligations`, `scores`, `open`.

- [ ] **Step 1: Create the bridge**

One RPC for the whole page — same contract as `fn_qa_dash_payload` and
`fn_standards_payload`. The page computes nothing.

```sql
CREATE OR REPLACE FUNCTION public.fn_dept_qa_payload(p_property_id bigint, p_dept text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','standards','ops','knowledge','pg_temp'
AS $$
WITH cov AS (
  SELECT atom_id, bool_or(covered) AS covered, min(sop_code) FILTER (WHERE covered) AS sop_code
    FROM standards.sop_coverage WHERE property_id = p_property_id GROUP BY atom_id
),
a AS (
  SELECT v.atom_id, v.title, v.requirement_text, v.authorities, v.category,
         COALESCE(v.discharge_mode,'procedure') AS discharge_mode,
         v.mode_source, v.staff_wording,
         (v.dept_code IS DISTINCT FROM p_dept) AS is_shared,
         COALESCE(c.covered,false) AS covered, c.sop_code
    FROM public.v_standards_atoms v LEFT JOIN cov c ON c.atom_id = v.atom_id
   WHERE p_dept IN (v.dept_code, v.dept_code_2)
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'property_id', p_property_id,
  'dept_code', p_dept,
  'dept_name', (SELECT max(name) FROM ops.departments
                 WHERE property_id = p_property_id AND code = p_dept),
  'people', (
    SELECT jsonb_build_object(
      'active', count(*) FILTER (WHERE s.is_active),
      'rows', COALESCE(jsonb_agg(jsonb_build_object(
        'staff_id', s.staff_id, 'name', s.full_name, 'position', s.position_title
      ) ORDER BY s.full_name) FILTER (WHERE s.is_active), '[]'::jsonb))
      FROM ops.v_staff_register s
     WHERE s.property_id = p_property_id AND s.dept_code = p_dept
  ),
  'obligations', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'atom_id', a.atom_id, 'title', a.title, 'text', a.requirement_text,
      'staff_wording', a.staff_wording,
      'authorities', a.authorities, 'category', a.category,
      'mode', a.discharge_mode, 'mode_source', a.mode_source,
      'covered', a.covered, 'sop_code', a.sop_code, 'is_shared', a.is_shared
    ) ORDER BY a.discharge_mode, a.covered, a.title), '[]'::jsonb) FROM a
  ),
  'by_mode', (
    SELECT COALESCE(jsonb_agg(x ORDER BY x.atoms DESC), '[]'::jsonb) FROM (
      SELECT discharge_mode AS mode, count(*) AS atoms,
             count(*) FILTER (WHERE covered) AS covered,
             (discharge_mode IN ('procedure','evidence')) AS coverable
        FROM a GROUP BY 1) x
  ),
  'scores', (
    SELECT jsonb_build_object(
      'slh_pct', round(100.0*sum(total_score)/NULLIF(sum(max_score),0), 1),
      'slh_worst_pct', round(min(pct_score), 1),
      'slh_sections', count(*),
      'slh_audited_at', max(audited_at)::date,
      'slh_top_miss', (array_agg(top_miss ORDER BY pct_score ASC))[1])
      FROM knowledge.qa_audits
     WHERE property_id = p_property_id AND dept_code = p_dept
       AND audit_type = 'slh_mystery_inspection'
  ),
  'open', (
    SELECT jsonb_build_object(
      'findings_open', count(*) FILTER (WHERE f.status <> 'closed'),
      'findings_total', count(*))
      FROM knowledge.qa_findings f
     WHERE f.property_id = p_property_id AND f.dept_code = p_dept
  )
);
$$;

REVOKE ALL ON FUNCTION public.fn_dept_qa_payload(bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_dept_qa_payload(bigint, text) TO authenticated, service_role;
```

**Before writing this, confirm the real column names** on `ops.v_staff_register` and
`knowledge.qa_findings` with `information_schema.columns` — the names above
(`staff_id`, `full_name`, `position_title`, `is_active`, `dept_code`, `status`) are the
expected ones, and a wrong name is a runtime error that the typechecker cannot catch
because it lives inside a SQL string.

`v_standards_atoms` already exposes `discharge_mode`, `mode_source` and `staff_wording`
— that was done in Task 2, Step 1b. If those columns are missing here, Task 2 is
incomplete; go back rather than patching around it.

- [ ] **Step 2: Verify for a department with real data**

```sql
SELECT public.fn_dept_qa_payload(260955,'housekeeping')->'by_mode' AS modes,
       public.fn_dept_qa_payload(260955,'housekeeping')->'scores' AS scores,
       jsonb_array_length(public.fn_dept_qa_payload(260955,'housekeeping')->'obligations') AS n;
```

Expected: `n` = 355 (Housekeeping's obligations including shared), `scores.slh_pct` ≈ 93.9,
`scores.slh_worst_pct` = 79.3.

Also check a department with zero staff — `SELECT public.fn_dept_qa_payload(260955,'gm')->'people'`
— and confirm it returns `{"active": 0, "rows": []}` rather than null. The spec calls
this out: GM, HR, Purchasing, Finance and Sales & Marketing have obligations and no one
in the staff register, and that must render as truth, not as an error.

- [ ] **Step 3: Save the audit copy and commit**

```bash
git add db/proposed/dept-qa/002_dept_qa_payload.sql.md
git commit -m "feat(quality): one RPC behind the department QA page

Same contract as the sibling dashboards — the page computes nothing and formats only.
Departments with obligations and no staff (GM 456, HR 235, Purchasing 126) return an
empty people block rather than null, because that is the truth and it must not render
as an error."
```

---

### Task 5: The department QA page, read-only

**Files:**
- Create: `app/h/[property_id]/operations/quality/[dept]/page.tsx`
- Create: `app/h/[property_id]/operations/quality/[dept]/DepartmentQa.tsx`
- Create: `app/h/[property_id]/operations/quality/[dept]/types.ts`

**Interfaces:**
- Consumes: `fn_dept_qa_payload(pid, dept)` from Task 4.
- Produces: the route `/h/[property_id]/operations/quality/[dept]`, linked from Task 7.

- [ ] **Step 1: Types transcribed from the payload**

Write `types.ts` mirroring the jsonb exactly — `DeptQaPayload`, `Obligation`,
`ModeRow`, `PersonRow`. Transcribe from `information_schema` / the verified payload,
not from memory; a mistyped column is then a compile error rather than a silent `—`.

- [ ] **Step 2: Server component**

`page.tsx` follows the sibling at `app/h/[property_id]/operations/quality/page.tsx`:
`getSupabaseAdmin().rpc(...)`, `dynamic = 'force-dynamic'`, `notFound()` on a
non-numeric `property_id`, and an error card that **keeps the navigation shell** rather
than throwing — losing the strip is the failure the wrapper exists to prevent.

Render the Operations department strip via `DEPT_CFG.operations.subPages` +
`rewriteSubPagesForProperty`, as the sibling does.

- [ ] **Step 3: Client component, five blocks**

`DepartmentQa.tsx` (`'use client'`, and therefore **never** importing `@/lib/supabase`):

1. **Who we are** — headcount and names; when `people.active === 0`, say
   *"No one in the staff register for this department — these obligations sit with management"*,
   not an empty table.
2. **What we must do** — obligations grouped by mode, each group with its own heading
   and a one-line explanation of what closes it. Procedures show the SOP code (reuse the
   `SopLink` pattern) or the Activate CTA; evidence shows held/missing; rules render as
   a plain list with no coverage claim; observations link to the SLH section.
3. **How we scored** — `scores.slh_pct`, with `slh_worst_pct` called out when it is
   materially lower, and `slh_top_miss` beneath.
4. **What's open** — findings open vs total.
5. **Run an audit** — a disabled placeholder button labelled *"Self-audits — coming in
   the next build"*. Do not wire it; the engine is Plan 2.

Use only `--tbl-*` theme tokens. Hand-built UTC date/number helpers, never `Intl`.

- [ ] **Step 4: Verify each of the three shapes**

Run `npm run dev` and check:
- `/h/260955/operations/quality/housekeeping` — 11 staff, 355 obligations grouped, 93.9% with the 79.3% outlier
- `/h/260955/operations/quality/gm` — 456 obligations, empty-people message, no crash
- `/h/260955/operations/quality/boat` — 4 obligations, the small-department shape

- [ ] **Step 5: Typecheck and guards**

Run: `npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -E '^\S+\(' | grep -v marketing` → no output
Run: `npm run prebuild` → passes

- [ ] **Step 6: Commit**

```bash
git add "app/h/[property_id]/operations/quality/[dept]"
git commit -m "feat(quality): a QA page per department

A Boat crew member carries 4 obligations; a Housekeeping attendant carries 355. One
shared list of 2,164 cannot serve both, which is why nobody was using it. Obligations
are grouped by how they are discharged, never as one flat list.

Departments with obligations and no staff say so in words rather than rendering an
empty table that reads as a bug."
```

---

### Task 6: Edit in place

PBS standing requirement: seeded values are a starting point, never canon.

**Files:**
- Create: `app/api/quality/obligation/route.ts`
- Modify: `app/h/[property_id]/operations/quality/[dept]/DepartmentQa.tsx`
- Migration `standards_edit_atom` via MCP (the `staff_wording` column already exists — Task 2)

**Interfaces:**
- Consumes: Task 4's payload, Task 5's component.
- Produces: `PATCH /api/quality/obligation` accepting `{ property_id, atom_id, discharge_mode?, staff_wording? }`.

- [ ] **Step 1: Write-bridge**

The `staff_wording` column already exists — added in Task 2, Step 1, and already
exposed on `v_standards_atoms`. Only the write path is new here.

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_edit_atom(
  p_property_id bigint, p_atom_id uuid, p_mode text DEFAULT NULL, p_staff_wording text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','standards','pg_temp'
AS $$
BEGIN
  IF p_mode IS NOT NULL AND p_mode NOT IN ('procedure','rule','evidence','observation') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_mode');
  END IF;
  UPDATE standards.atoms
     SET discharge_mode = COALESCE(p_mode, discharge_mode),
         mode_source    = CASE WHEN p_mode IS NOT NULL THEN 'edited' ELSE mode_source END,
         staff_wording  = COALESCE(p_staff_wording, staff_wording)
   WHERE atom_id = p_atom_id;
  RETURN jsonb_build_object('ok', FOUND);
END $$;

REVOKE ALL ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) TO authenticated, service_role;
```

**Note the tenancy shape honestly:** `standards.atoms` is a tenant-NEUTRAL shared
corpus, so `p_property_id` does not scope the write — it exists so the route can
authorise the caller. An edit made by Namkhan changes the shared atom. That is correct
today (one property uses the corpus) and **must be revisited before a third tenant is
onboarded**; record it in the function comment.

- [ ] **Step 2: The route, tenancy first**

```ts
// app/api/quality/obligation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePropertyAccess } from '@/lib/tenancy';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.atom_id) return NextResponse.json({ ok: false, error: 'atom_id_required' }, { status: 400 });
  if (body.property_id == null) return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });

  // UNTRUSTED until this returns. No default, ever.
  const propertyId = await requirePropertyAccess(req, body.property_id);

  const { data, error } = await getSupabaseAdmin().rpc('fn_standards_edit_atom', {
    p_property_id: propertyId,
    p_atom_id: body.atom_id,
    p_mode: body.discharge_mode ?? null,
    p_staff_wording: body.staff_wording ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Wire the UI**

On each obligation row: a mode `<select>` (four options) and an "edit wording" text
input, both PATCHing on change and optimistically updating local state. Show a small
`edited` marker where `mode_source === 'edited'` so a HoD can see their own corrections.

- [ ] **Step 4: Verify the latch survives a re-seed**

1. Change one obligation's mode in the UI.
2. Confirm `SELECT discharge_mode, mode_source FROM standards.atoms WHERE atom_id = '<id>'` shows `edited`.
3. Re-run `node --experimental-strip-types scripts/seed-discharge-modes.mjs`.
4. Confirm the row is **unchanged**. This is the whole point of `mode_source`.

- [ ] **Step 5: Typecheck, guards, commit**

```bash
npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -E '^\S+\(' | grep -v marketing
npm run prebuild
git add app/api/quality/obligation/route.ts "app/h/[property_id]/operations/quality/[dept]/DepartmentQa.tsx"
git commit -m "feat(quality): HoDs correct the Standard in place

Seeded values are a starting point, never canon (PBS). Mode and plain-English wording
are both editable; mode_source flips to 'edited' and the seeder never touches those
rows again — verified by re-running the seeder against an edited row.

staff_wording is load-bearing for the later translation module: auditor language
translates badly, and the HoD's plain version is what should reach a member of staff
in any language."
```

---

### Task 7: Link the department pages from the Standard

**Files:**
- Modify: `app/h/[property_id]/operations/standard/StandardBrowser.tsx`

**Interfaces:**
- Consumes: the route from Task 5.
- Produces: navigation into it. No nav-strip change, so **no protected-path decision is
  needed** — `lib/nav-subgroups.ts` is untouched by this plan.

- [ ] **Step 1: Point the department name at its QA page**

The By-department table currently links each department name to `?dept=<code>` on the
same page. Keep that as the in-page filter, and add a second link — "Open department" —
to `/h/${pid}/operations/quality/${d.dept_code}`.

- [ ] **Step 2: Verify and commit**

Check `/h/260955/operations/standard`, click through to three departments.

```bash
npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -E '^\S+\(' | grep -v marketing
npm run prebuild
git add "app/h/[property_id]/operations/standard/StandardBrowser.tsx"
git commit -m "feat(standards): every department name is a door to its QA page"
```

---

## Done when

- Four discharge modes across all 2,164 atoms, none null, `observation` ≈ 338
- The Standard reports coverage per mode, with `rule` and `observation` showing a stated
  reason rather than a misleading percentage
- `/h/260955/operations/quality/housekeeping` renders 11 staff, 355 grouped obligations,
  93.9% with the 79.3% outlier
- A HoD edit survives a re-run of the seeder
- Zero new `tsc` errors; both prebuild guards pass; targeted jest green

## Not in this plan (Plan 2)

The self-audit engine (`audit_templates`, `audit_template_questions`, `audit_runs`,
`audit_answers`), the `ops.task_catalog` cycle wiring, the phone run surface, the
findings-on-No write, last-verified dates, and the SLH analytics section. The "Run an
audit" button ships disabled in Task 5 and is wired in Plan 2.
