# Namkhan Standard — Corpus Completion (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Namkhan Standard — atomise the four remaining standards plus preventive maintenance so the ten empty departments gain real requirements, merge cross-source duplicates into single origin-tagged atoms, and anchor or retire the 458 unanchored SOP proposals.

**Architecture:** Plan A built the schema and loaded SLH by deterministic parsing. The remaining sources are prose, so they need an AI atomiser — which reuses the never-throw degraded pattern shipped in `b7521fb4`. Cross-source duplicates cannot be caught by exact text (ASEAN and SLH word the same requirement differently), so atoms are embedded with pgvector and only near-duplicate pairs inside one department are handed to the model to adjudicate. `standards.atom_sources` already carries many-to-many citations, so an atom demanded by two bodies is tagged with both automatically.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase Postgres 17 + pgvector 0.8.0, Anthropic Claude Haiku, jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-09-10-namkhan-standard-design.md` (approved 2026-09-10)
**Predecessor:** `docs/superpowers/plans/2026-09-10-namkhan-standard-corpus.md` (Plan A — complete, branch `feat/namkhan-standard-quality`)

## Global Constraints

- **L5 / ADR-277 — anon lockdown.** Every `public` object ends with `REVOKE ALL ... FROM anon`. Functions: `REVOKE ALL ON FUNCTION ... FROM anon, PUBLIC` then an explicit GRANT. **Write bridges are `service_role` ONLY** — never `authenticated`. This was a Critical finding in Plan A: an authenticated grant on a corpus write bridge lets any tenant user inject rows into the shared standard.
- **`standards` is NOT in `pgrst.db_schemas`.** `supabase.schema('standards')` fails at runtime. All access via `public` bridges. `dms`, `ops` and `knowledge` ARE exposed.
- **`standards.sources/requirements/atoms/atom_sources` are TENANT-NEUTRAL** — no `property_id`. Only `sop_coverage` is per-tenant.
- **`public.fn_standards_atom_key` is a hand port of `lib/standards/atomKey.ts`.** If either changes, BOTH change, or the merge stops being idempotent and mints duplicate atoms.
- **Never DROP/DELETE owner data.** Derived data (atoms, atom_sources) may be rebuilt because it regenerates in full from `standards.requirements`. Proposals are owner data: archive via `status='skipped'`, never delete.
- **Budget: USD 250/month (ADR-313)**, checked before each model call, halt + owner signal on cap.
- **AI calls must be metered.** Use `fn_meter_ai_call` — `fn_record_token_use` silently prices Haiku at $0.
- **Classification/atomisation must never hard-fail an ingest.** Follow `classifyWithFallback` in `lib/docs/classifier.ts`: degrade, flag, persist for review.
- **Two owner checkpoints are mandatory** and are NOT agent decisions: the proposal match rate before archiving, and the 36 unmapped position titles (the latter belongs to Plan C).
- **Dept codes** are the 16 live values; the prose sources use their own vocabulary and MUST be mapped onto those, defaulting to `admin_general` only when genuinely unmappable.

---

### Task 1: Prose requirement atomiser (AI, never throws)

**Files:**
- Create: `lib/standards/proseAtomiser.ts`
- Test: `lib/standards/__tests__/proseAtomiser.test.ts`

**Interfaces:**
- Consumes: nothing at runtime (the model call is injected for tests).
- Produces: `export interface ProseRequirement { text: string; section: string | null; dept_hint: string | null; category: string | null; }` and `export async function atomiseChunk(opts: { text: string; heading: string | null; authority: string; _call?: (prompt: string) => Promise<string> }): Promise<{ requirements: ProseRequirement[]; degraded: boolean; error: string | null }>`.

- [ ] **Step 1: Write the failing test**

```ts
import { atomiseChunk, parseAtomiserReply } from '../proseAtomiser';

const GOOD = JSON.stringify({ requirements: [
  { text: 'The hotel implements a linen and towel re-use programme.', section: '3.2 Water', dept_hint: 'housekeeping', category: 'sustainability' },
  { text: 'Guests are informed of the re-use programme in the room.', section: '3.2 Water', dept_hint: 'housekeeping', category: 'sustainability' },
]});

describe('parseAtomiserReply', () => {
  it('parses a well-formed reply', () => {
    expect(parseAtomiserReply(GOOD)).toHaveLength(2);
  });
  it('strips ```json fences the model adds despite instructions', () => {
    expect(parseAtomiserReply('```json\n' + GOOD + '\n```')).toHaveLength(2);
  });
  it('returns [] rather than throwing on unparseable output', () => {
    expect(parseAtomiserReply('I could not find any requirements.')).toEqual([]);
  });
  it('drops entries with no text instead of emitting empty requirements', () => {
    const bad = JSON.stringify({ requirements: [{ text: '' }, { text: '   ' }, { text: 'Real one.' }] });
    expect(parseAtomiserReply(bad)).toHaveLength(1);
  });
  it('caps runaway output at 40 requirements per chunk', () => {
    const many = JSON.stringify({ requirements: Array.from({ length: 200 }, (_, i) => ({ text: `Requirement ${i}` })) });
    expect(parseAtomiserReply(many).length).toBeLessThanOrEqual(40);
  });
});

describe('atomiseChunk', () => {
  it('never throws when the model call fails', async () => {
    const r = await atomiseChunk({ text: 'x', heading: null, authority: 'ASEAN',
      _call: async () => { throw new Error('Anthropic 400: credit balance is too low'); } });
    expect(r.degraded).toBe(true);
    expect(r.requirements).toEqual([]);
    expect(r.error).toContain('credit balance');
  });
  it('returns requirements and degraded=false on success', async () => {
    const r = await atomiseChunk({ text: 'x', heading: '3.2 Water', authority: 'ASEAN', _call: async () => GOOD });
    expect(r.degraded).toBe(false);
    expect(r.requirements).toHaveLength(2);
  });
  it('falls back to the chunk heading when the model omits a section', async () => {
    const noSection = JSON.stringify({ requirements: [{ text: 'A rule.' }] });
    const r = await atomiseChunk({ text: 'x', heading: '3.2 Water', authority: 'ASEAN', _call: async () => noSection });
    expect(r.requirements[0].section).toBe('3.2 Water');
  });
  it('never emits a requirement longer than 600 chars', async () => {
    const long = JSON.stringify({ requirements: [{ text: 'y'.repeat(2000) }] });
    const r = await atomiseChunk({ text: 'x', heading: null, authority: 'GSTC', _call: async () => long });
    expect(r.requirements[0].text.length).toBeLessThanOrEqual(600);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx jest lib/standards/__tests__/proseAtomiser.test.ts`
Expected: FAIL — `Cannot find module '../proseAtomiser'`.

- [ ] **Step 3: Implement**

The prompt must instruct the model to extract ONLY normative requirements (things the hotel must
do), one per entry, in the source's own words where possible, and to return `{"requirements":[...]}`
with no prose. `atomiseChunk` wraps the call in try/catch and returns
`{requirements: [], degraded: true, error}` on any failure — it must never throw, because a single
bad chunk must not fail a 350-chunk run. `parseAtomiserReply` strips code fences, tolerates
non-JSON by returning `[]`, drops empty texts, truncates each text to 600 chars, and caps the array
at 40. Default `_call` posts to Anthropic using the vault-first key resolution already in
`lib/docs/classifier.ts` (`getAnthropicKey`), and meters via `fn_meter_ai_call`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest lib/standards/__tests__/proseAtomiser.test.ts` — expected PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/standards/proseAtomiser.ts lib/standards/__tests__/proseAtomiser.test.ts
git commit -m "feat(standards): prose requirement atomiser, degrades instead of throwing"
```

---

### Task 2: Vocabulary mapper — source terms onto the 16 live departments

**Files:**
- Modify: `lib/standards/deptMap.ts`
- Test: `lib/standards/__tests__/deptMap.test.ts`

**Interfaces:**
- Produces: `export function deptForProseHint(hint: string | null, sectionText: string): { dept_code: string; dept_code_2: string | null }`.

- [ ] **Step 1: Write the failing test**

The prose sources speak a different vocabulary from SLH's guest-journey sections. Test that the
back-of-house terms land on the right department — these are the ten that currently have ZERO
requirements, which is the entire point of this plan:

```ts
import { deptForProseHint } from '../deptMap';

describe('deptForProseHint — back of house', () => {
  it.each([
    ['food safety, HACCP, cold chain',            'kitchen'],
    ['kitchen hygiene and pest control',          'kitchen'],
    ['landscaping, irrigation, pool plant',       'grounds'],
    ['energy consumption and metering',           'maintenance'],
    ['water consumption and wastewater',          'maintenance'],
    ['chemical storage and handling',             'maintenance'],
    ['fire safety systems and drills',            'security'],
    ['staff welfare, wages, working hours',       'hr'],
    ['child protection policy',                   'hr'],
    ['training and competency records',           'hr'],
    ['supplier selection and local sourcing',     'purchasing'],
    ['waste segregation and recycling',           'grounds'],
    ['community engagement and donations',        'gm'],
    ['guest communication of sustainability',     'gm'],
  ])('maps %s to %s', (hint, dept) => {
    expect(deptForProseHint(hint, '').dept_code).toBe(dept);
  });

  it('falls back to admin_general only when genuinely unmappable', () => {
    expect(deptForProseHint('miscellaneous administrative matters', '').dept_code).toBe('admin_general');
  });

  it('uses the section text when the hint is null', () => {
    expect(deptForProseHint(null, 'Kitchen waste and food storage temperatures').dept_code).toBe('kitchen');
  });

  it('only ever returns live dept codes', () => {
    const LIVE = new Set(['front_office','housekeeping','kitchen','roots_service','maintenance',
      'grounds','spa','activities','boat','security','finance','gm','hr','purchasing',
      'sales_marketing','admin_general']);
    for (const h of ['HACCP','energy','child protection','nonsense xyz', null]) {
      expect(LIVE.has(deptForProseHint(h, '').dept_code)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `Cannot find deptForProseHint`.

- [ ] **Step 3: Implement** `deptForProseHint` as an ordered rule list over `hint + ' ' + sectionText`, most specific first, reusing the existing `RULES` ordering discipline. **Add a comment recording that order is load-bearing and why** — Plan A's final review found the original ordering misfiled 26 real rows.

- [ ] **Step 4: Run tests** — expected PASS. Then run the whole suite: `npx jest lib/standards`.

- [ ] **Step 5: Commit**

```bash
git add lib/standards/deptMap.ts lib/standards/__tests__/deptMap.test.ts
git commit -m "feat(standards): map prose-source vocabulary onto the 16 live departments"
```

---

### Task 3: Atomise the four prose sources

**Files:**
- Create: `app/api/standards/atomise/route.ts`

**Interfaces:**
- Consumes: `atomiseChunk` (Task 1), `deptForProseHint` (Task 2), `public.fn_standards_load_requirements` (Plan A).
- Produces: `POST /api/standards/atomise` body `{ source_key: string, limit?: number }` → `{ ok, source_key, chunks_processed, requirements_extracted, inserted, degraded_chunks, cost_usd }`.

- [ ] **Step 1: Write the route**

Reads `brain.chunks` for the source's `doc_id` (the `brain` schema is NOT PostgREST-exposed —
add a `public.fn_standards_source_chunks(p_source_key text)` bridge, `service_role` only, returning
`chunk_no, heading, text`). For each chunk call `atomiseChunk`, map each requirement through
`deptForProseHint`, and load via `fn_standards_load_requirements`. Track `degraded_chunks`
separately and **return 200 with the count**, never a 500 — a partial atomisation is a resumable
state, not a failure. Check month-to-date spend against the ADR-313 cap BEFORE each call and stop
cleanly when reached.

`question_no` is NULL for prose sources, so the `UNIQUE (source_id, section, question_no)`
constraint will NOT dedupe them. **Idempotency comes from `fn_standards_atom_key` at merge time
instead** — re-running atomise creates duplicate `requirements` rows but they collapse to the same
atom. State this in a comment; it is the single most surprising thing about this route.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit 2>&1 | grep -v '^\.next/types' | grep -c 'error TS'` → `0`.

- [ ] **Step 3: Run for one source first, smallest, and READ the output**

Run for `slh_minimum` (14 chunks — cheapest, and its requirements should be recognisable).
Then inspect by hand before spending on the rest:

```sql
SELECT section, dept_code, category, left(text,110) AS requirement
FROM standards.requirements r JOIN standards.sources s USING (source_id)
WHERE s.source_key='slh_minimum' ORDER BY dept_code LIMIT 25;
```

**STOP AND RECONCILE IF:** requirements are summaries rather than obligations, more than ~20% land
in `admin_general`, or the same requirement appears many times with trivial wording differences.
Any of those means the prompt needs work, and fixing it after 350 chunks costs 25× more.

- [ ] **Step 4: Run the remaining three** — `asean_green` (188), `travelife` (117), `gstc` (31).

- [ ] **Step 5: Verify the ten empty departments filled**

```sql
SELECT dept_code, count(*) AS requirements,
       string_agg(DISTINCT s.authority, ', ') AS origins
FROM standards.requirements r JOIN standards.sources s USING (source_id)
GROUP BY dept_code ORDER BY count(*) DESC;
```

Expected: `kitchen`, `grounds`, `security`, `hr`, `purchasing` all non-zero. **If kitchen is still
zero, the plan has failed its main purpose** — stop and fix the mapper before continuing.

- [ ] **Step 6: Commit**

```bash
git add app/api/standards/atomise/route.ts db/proposed/namkhan-standard-v2/
git commit -m "feat(standards): atomise ASEAN, Travelife, GSTC and SLH Minimum into the corpus"
```

---

### Task 4: Preventive maintenance as a requirement source

**Files:**
- Create: `db/proposed/namkhan-standard-v2/001_pm_source.sql`

**Interfaces:**
- Produces: a `standards.sources` row `pm_catalog`, and one requirement per active `ops.task_catalog` row.

- [ ] **Step 1: Seed the source and load, in one migration**

71 active PM tasks, only 11 with an SOP link — each task is a standing obligation with no procedure
behind it, which is a direct cause of the 2.6% PM completion rate. Each becomes a requirement whose
text is the task title plus its description, `section = 'Preventive Maintenance'`,
`question_no = NULL`, `dept_code` resolved from `ops.task_catalog.dept_id`.

**Discover before writing:** `ops.task_catalog.dept_id` is NOT the text dept code used elsewhere —
Plan A's join on it silently returned zero for every department. Establish what it actually
references first (`\d ops.task_catalog`, then the referenced table) and map to the 16 live codes.

- [ ] **Step 2: Verify**

```sql
SELECT count(*) AS pm_requirements,
       count(*) FILTER (WHERE dept_code='admin_general') AS unmapped
FROM standards.requirements r JOIN standards.sources s USING (source_id)
WHERE s.source_key='pm_catalog';
```
Expected: 71 requirements, `unmapped` = 0.

- [ ] **Step 3: Commit**

---

### Task 5: Semantic dedup — one atom, many origin tags

**Files:**
- Create: `db/proposed/namkhan-standard-v2/002_atom_embeddings.sql`
- Create: `app/api/standards/dedupe/route.ts`
- Test: `lib/standards/__tests__/dedupe.test.ts`

**Interfaces:**
- Produces: `standards.atoms.embedding vector(1536)`; `public.fn_standards_dedupe_candidates(p_threshold float)` returning candidate pairs within one department; `POST /api/standards/dedupe` → `{ ok, candidates, merged, kept_separate, cost_usd }`.
- Also: `export function shouldAutoMerge(similarity: number): 'merge' | 'ask' | 'keep'` (pure, tested).

- [ ] **Step 1: Write the failing test for the threshold policy**

```ts
import { shouldAutoMerge } from '../dedupe';

describe('shouldAutoMerge', () => {
  it('auto-merges only near-identical text', () => {
    expect(shouldAutoMerge(0.98)).toBe('merge');
  });
  it('asks the model in the ambiguous band', () => {
    expect(shouldAutoMerge(0.90)).toBe('ask');
    expect(shouldAutoMerge(0.86)).toBe('ask');
  });
  it('keeps clearly different requirements apart without spending a call', () => {
    expect(shouldAutoMerge(0.70)).toBe('keep');
  });
  it('never merges below the ask floor', () => {
    for (const s of [0, 0.5, 0.84]) expect(shouldAutoMerge(s)).toBe('keep');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Implement** — `>= 0.95` merge, `0.85–0.95` ask the model, `< 0.85` keep. The bands
are deliberately conservative: a wrong merge silently deletes a requirement from the standard,
which is worse than a duplicate a human can spot.

- [ ] **Step 4: Add the embedding column and candidate function**

`ALTER TABLE standards.atoms ADD COLUMN IF NOT EXISTS embedding vector(1536);` plus an ivfflat
index. `fn_standards_dedupe_candidates` returns pairs **within the same `dept_code` only** —
cross-department similarity is meaningless here and would quadratically inflate the candidate set.

- [ ] **Step 5: Run dedupe and verify nothing was lost**

```sql
SELECT (SELECT count(*) FROM standards.requirements) AS requirements,
       (SELECT count(*) FROM standards.atom_sources) AS citations,
       (SELECT count(*) FROM standards.atoms)        AS atoms,
       (SELECT count(*) FROM standards.requirements r
         WHERE NOT EXISTS (SELECT 1 FROM standards.atom_sources s
                            WHERE s.requirement_id = r.requirement_id)) AS orphans;
```
**`citations` must equal `requirements`, and `orphans` must be 0.** A merge that loses a citation
has deleted a requirement from the standard.

- [ ] **Step 6: Verify the origin tags — the thing PBS actually asked for**

```sql
SELECT authorities, count(*) AS atoms
FROM public.v_standards_atoms GROUP BY authorities ORDER BY count(*) DESC;
```
Expected: rows like `ASEAN, SLH` and `SLH, Travelife` — atoms demanded by more than one body,
carrying every origin. **If every row is a single authority, cross-source dedup did not fire** and
the thresholds or the embeddings need investigating before this ships.

- [ ] **Step 7: Commit**

---

### Task 6: Triage the 458 unanchored proposals — OWNER CHECKPOINT

**Files:**
- Create: `app/api/standards/triage-proposals/route.ts`

**Interfaces:**
- Produces: `POST /api/standards/triage-proposals` body `{ dry_run: boolean }` → `{ ok, total, matched, unmatched, sample_matches, sample_unmatched }`.

- [ ] **Step 1: Implement dry-run FIRST and default it to true**

Embed each open proposal's `title + purpose_short`, match against atoms **in the same department**,
apply the same bands as Task 5. `dry_run: true` writes NOTHING and returns counts plus 10 examples
from each side.

- [ ] **Step 2: Run the dry run and REPORT TO PBS — do not proceed**

This is a **mandatory owner checkpoint**. Archiving most of the SOP backlog is visible to
operators even though it is reversible. Report: total, matched, unmatched, and the two samples.
**Wait for an explicit decision before any write.**

- [ ] **Step 3: On approval, apply**

Matched → keep `status='proposed'`, record the atom in `tags`. Unmatched → `status='skipped'`,
with the reason in `tags`. **No DELETE.** Every row stays and is recoverable with one UPDATE.

- [ ] **Step 4: Verify reversibility**

```sql
SELECT status, count(*) FROM knowledge.sop_proposals
WHERE property_id=260955 GROUP BY status;
```
Confirm nothing vanished: the totals before and after must be identical, only the split changes.

- [ ] **Step 5: Commit**

---

### Task 7: Full verification

- [ ] **Step 1:** `npx jest lib/standards` — all suites pass.
- [ ] **Step 2:** `npx tsc --noEmit 2>&1 | grep -v '^\.next/types' | grep -c 'error TS'` → `0`.
- [ ] **Step 3:** `node scripts/guard-invariants.mjs && node scripts/check-it2-orphans.mjs` — both pass. If guard-invariants trips on a comment, **reword the comment; never raise the baseline.**
- [ ] **Step 4:** Confirm every new `public` object is anon-locked and every WRITE bridge is service_role only:

```sql
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'fn_standards%' ORDER BY 1;
```
Expected: `anon` false everywhere; `authenticated` false on every write bridge.

- [ ] **Step 5:** Report total spend against the ADR-313 cap from `ai_token_meter`.
- [ ] **Step 6:** Push the branch and confirm CI green.

---

## Out of scope — Plan C, "the operating layer"

Deliberately excluded so this plan stays one coherent deliverable (a complete, anchored, tagged
standard). Plan C covers: the navigation fold (6 tabs → 3, needs a protected-path decision row for
`lib/nav-subgroups.ts`), position assignment in the staff drawer (`position_code` + a dropdown of
the 38 defined positions, mirroring `SkillsEditor`, scoped by verified property_id — NOT copying
the L22 gap filed as finding #682), the acknowledgement chain on the unused `dms.acknowledgments`
(ops manager → HoD → worker, derived from `hr.positions.job_grade`), and worker logins.

SOP authoring — the expensive generation pass — comes after both, because it needs the complete
corpus from this plan and the acknowledgement chain from Plan C.

## Self-Review

**1. Spec coverage.** Spec §4 stage 1 (ATOMISE) → Tasks 1–4. Stage 2 (MERGE) → Task 5. The spec's
stages 4–7 (AUTHOR/TRANSLATE/VISUAL/VERIFY) and §5 autorun remain future work, now correctly
sequenced after Plan C. §11's Lao hold rule is untouched and still binds SOP authoring.

**2. Placeholder scan.** No TBD/TODO. Every test step carries real test code. Three steps are
explicit stop-and-reconcile gates (Task 3 Step 3, Task 3 Step 5, Task 5 Step 6) and one is a
mandatory owner checkpoint (Task 6 Step 2).

**3. Type consistency.** `ProseRequirement` (Task 1) is consumed by Task 3 with matching field
names. `deptForProseHint` returns the same `{dept_code, dept_code_2}` shape as the existing
`deftForSection`. `shouldAutoMerge` returns the same three-value union in its test and its use.
`fn_standards_load_requirements(text, jsonb)` is called with the signature Plan A created.

**4. Known risk carried forward.** Task 3 notes that prose requirements have `question_no = NULL`,
so the `UNIQUE (source_id, section, question_no)` constraint does not dedupe them and re-running
atomise duplicates `requirements` rows — collapsing only at merge time. That is the most likely
source of confusion for whoever runs this.
