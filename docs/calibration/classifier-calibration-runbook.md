# Classifier Calibration Runbook
**Post-launch · Weeks 1–4 · Ops Arm**

> **Source**: pbs-overnight-fanout  
> **Intent**: monitor  
> **Urgency**: medium  
> **Estimated time**: ~45 min per weekly run  
> **Recommended owner**: Reviewer agent (PBS-supervised)

---

## Prerequisites — GATE CHECK (run these before any calibration work)

### Gate 1 — Minimum upload count
```sql
SELECT COUNT(*) AS total_uploads
FROM marketing.media_ingest_queue;
```
**Pass condition**: `total_uploads >= 50`  
**If < 50**: Stop. Re-schedule this runbook for a later date.

### Gate 2 — pipeline_log tier_assigned population
```sql
SELECT
  COUNT(*) AS total_log_rows,
  COUNT(*) FILTER (WHERE pipeline_log->>'tier_assigned' IS NOT NULL) AS with_tier,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE pipeline_log->>'tier_assigned' IS NOT NULL)
    / NULLIF(COUNT(*), 0), 1
  ) AS pct_populated
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days';
```
**Pass condition**: `pct_populated >= 80`  
**If < 80%**: The ingest pipeline is not writing `tier_assigned` consistently — calibration diff query will be unreliable. File a backlog ticket against the ingest pipeline before proceeding.

### Gate 3 — PBS override mechanism exists
Confirm there is a column or mechanism to record intentional PBS tier overrides  
(e.g. `pbs_override_tier`, `override_reason`, or equivalent) distinct from classifier output.  
**If absent**: All disagreements will be ambiguous — PBS must add this column before the diff is meaningful. Log as blocker.

---

## Step 1 — Pull classifier-vs-final-tier disagreements (last 14 days)

```sql
SELECT
  id,
  asset_filename,
  classifier_tier,
  pipeline_log->>'tier_assigned'  AS final_tier,
  should_call_gemini,
  qc_score,
  created_at
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND classifier_tier IS DISTINCT FROM (pipeline_log->>'tier_assigned')
ORDER BY created_at DESC;
```

For each disagreement row, categorise into one of:

| Category | Description |
|---|---|
| `classifier_error` | Classifier chose wrong tier; no override; filename was clear |
| `pbs_override` | PBS intentionally changed the tier post-classification |
| `misleading_filename` | Filename gave wrong signal; classifier was reasonable |
| `missing_keyword` | Filename contained an unmapped content hint |

---

## Step 2 — Audit filename_keyword_map for missing hints

```sql
-- Pull filenames of disagreement rows, then check if any token
-- appears in filenames but is absent from filename_keyword_map
SELECT keyword, tier_hint, weight
FROM marketing.filename_keyword_map
ORDER BY weight DESC;
```

For each `misleading_filename` or `missing_keyword` row from Step 1:
1. Tokenise the filename (split on `_`, `-`, `.`, spaces).
2. Check each token against `filename_keyword_map`.
3. Any token that reliably predicts the correct tier but is **not** in the map → candidate for a new row.
4. Propose inserts (data-only change, no code):

```sql
-- Example insert — adjust values after analysis
INSERT INTO marketing.filename_keyword_map (keyword, tier_hint, weight)
VALUES ('hero', 'tier_1', 1.5)
ON CONFLICT (keyword) DO NOTHING;
```

---

## Step 3 — Check tier_archive population rate

```sql
SELECT
  pipeline_log->>'tier_assigned' AS tier,
  COUNT(*) AS upload_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct_of_total
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY tier
ORDER BY upload_count DESC;
```

**Threshold check**: If `tier_archive` > 40% of total uploads:
- Review `qc_score_bands` lower bound — consider raising the minimum QC score for active tiers.
- Review `classifier_rules` for over-aggressive demotion patterns.
- Propose adjusted band boundaries (data-only change).

---

## Step 4 — Identify wasted Gemini calls

```sql
SELECT
  id,
  asset_filename,
  should_call_gemini,
  pipeline_log->>'tier_assigned'  AS final_tier,
  pipeline_log->>'gemini_result'  AS gemini_result,
  qc_score,
  created_at
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND should_call_gemini = TRUE
  AND (
    pipeline_log->>'tier_assigned' = 'tier_archive'
    OR pipeline_log->>'tier_assigned' IS NULL
  )
ORDER BY created_at DESC;
```

For each row returned, log the shared pattern (file type, qc_score range, filename prefix, etc.).  
If a clear pattern emerges → propose a `classifier_rules` row to short-circuit `should_call_gemini=false` for that pattern before Gemini is called.

---

## Step 5 — Propose data-only changes

Collate findings into three change categories:

### 5a. New filename_keyword_map rows
List tokens → tier_hint → weight. Submit as a SQL migration (no code change required).

### 5b. Adjusted qc_score_bands boundaries
Show current bands, proposed bands, and justification from the tier distribution data.

### 5c. Tightened classifier_rules rows
Any rule where the precision was < 70% across sampled disagreements → candidate for tightening threshold or adding a secondary condition.

---

## Step 6 — Flag code-change backlog items

If any disagreement pattern cannot be resolved by data changes alone  
(e.g. a structural gap in `classify_pre_gemini` logic), log it as:

- **Priority**: low / backlog
- **Component**: `classify_pre_gemini`
- **Description**: [specific case + example asset IDs]
- **Do NOT block** this calibration cycle on it.

---

## Step 7 — Weekly calibration note

Document findings in `docs/calibration/notes/week-N-YYYY-MM-DD.md` using this template:

```markdown
# Classifier Calibration — Week N (YYYY-MM-DD)

## Upload count: XX (Gate 1: PASS/FAIL)
## tier_assigned population: XX% (Gate 2: PASS/FAIL)

## Disagreements found: N
- classifier_error: N
- pbs_override: N
- misleading_filename: N
- missing_keyword: N

## Data changes proposed
- filename_keyword_map: N new rows
- qc_score_bands: [no change | adjusted lower bound from X to Y]
- classifier_rules: [no change | tightened rule X]

## Wasted Gemini calls: N (pattern: ...)

## Backlog code items: N
- [list]

## Next review: YYYY-MM-DD
```

Repeat weeks 2–4 post-launch.

---

## Blockers (must be resolved before first run)

| # | Blocker | Owner | Status |
|---|---|---|---|
| 1 | Minimum 50 uploads must exist | PBS / wait | ⏳ pending |
| 2 | PBS override column/mechanism must exist in `media_ingest_queue` | Schema Sage | ⏳ pending |
| 3 | `pipeline_log->>'tier_assigned'` must be consistently populated by ingest pipeline | Backend / ingest pipeline owner | ⏳ pending |

---

*Runbook authored by Code Carla · pbs-overnight-fanout · ops arm · monitor intent*
