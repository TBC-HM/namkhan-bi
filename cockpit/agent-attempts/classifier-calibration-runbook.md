# Classifier Post-Launch Calibration Runbook

**Ticket source:** pbs-overnight-fanout  
**Arm:** ops · **Intent:** monitor · **Urgency:** medium  
**Estimated effort:** 45 min per weekly review cycle  
**Scope:** Data curation only — no code changes expected

---

## Gate Check — Run BEFORE anything else

Confirm ≥50 uploads exist in the ingest queue:

```sql
SELECT COUNT(*) AS ingest_count
FROM marketing.media_ingest_queue;
```

> **If count < 50 → STOP.** Re-run this runbook after more uploads accumulate. Review is not meaningful below this threshold.

Confirm `pipeline_log->>'tier_assigned'` is being populated consistently:

```sql
SELECT
  COUNT(*) FILTER (WHERE pipeline_log->>'tier_assigned' IS NOT NULL) AS has_tier,
  COUNT(*) FILTER (WHERE pipeline_log->>'tier_assigned' IS NULL)     AS missing_tier,
  COUNT(*) AS total
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days';
```

> **If missing_tier / total > 20% → flag to PBS.** The diff query will not be reliable until this is resolved.

---

## Step 1 — Pull Classifier vs Final-Tier Disagreements (last 14 days)

```sql
SELECT
  id,
  asset_name,
  pipeline_log->>'classifier_tier'  AS classifier_tier,
  pipeline_log->>'tier_assigned'    AS final_tier,
  pipeline_log->>'should_call_gemini' AS gemini_called,
  pipeline_log->>'gemini_result'    AS gemini_result,
  created_at
FROM marketing.media_ingest_queue
WHERE
  created_at >= NOW() - INTERVAL '14 days'
  AND pipeline_log->>'classifier_tier' IS NOT NULL
  AND pipeline_log->>'tier_assigned'   IS NOT NULL
  AND pipeline_log->>'classifier_tier' <> pipeline_log->>'tier_assigned'
ORDER BY created_at DESC;
```

### Categorise each disagreement row into one of:

| Code | Meaning |
|------|---------|
| `CE` | Classifier Error — wrong prediction, correct final tier |
| `PO` | PBS Override — PBS deliberately changed tier |
| `MF` | Misleading Filename — filename hint led classifier astray |

> **Note:** Until PBS has a formal `pbs_override` column in the ingest queue, PO vs CE must be determined by reviewing chat history or PBS notes for that asset.  
> **Action for PBS:** Consider adding `pbs_override BOOLEAN DEFAULT FALSE` + `override_reason TEXT` columns to `media_ingest_queue` to make future diffs unambiguous.

---

## Step 2 — Audit `filename_keyword_map`

Pull all distinct filename tokens from recent uploads that are NOT yet in the keyword map:

```sql
-- Adjust token extraction logic to match your filename format
SELECT DISTINCT
  lower(regexp_replace(asset_name, '\.[^.]+$', '')) AS stem
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days'
ORDER BY stem;
```

Compare manually against existing rows in `filename_keyword_map`. For each content hint appearing in filenames but not mapped:

1. Determine correct tier assignment
2. Draft a new `INSERT` row:
   ```sql
   INSERT INTO marketing.filename_keyword_map (keyword, tier, added_by, added_at)
   VALUES ('<keyword>', '<tier>', 'pbs_calibration', NOW());
   ```
3. Collect all proposed inserts → apply in batch after PBS review

---

## Step 3 — Check `tier_archive` Population Rate

```sql
SELECT
  pipeline_log->>'tier_assigned' AS tier,
  COUNT(*)                        AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM marketing.media_ingest_queue
WHERE created_at >= NOW() - INTERVAL '14 days'
  AND pipeline_log->>'tier_assigned' IS NOT NULL
GROUP BY pipeline_log->>'tier_assigned'
ORDER BY count DESC;
```

> **If `tier_archive` > 40% of uploads → raise with PBS.**  
> Consider tightening `qc_score_bands` floor for archive or raising the QC/MP thresholds to push borderline assets to rejection rather than archive.

---

## Step 4 — Wasted Gemini Call Audit

Find assets where Gemini was invoked but the asset was discarded or demoted:

```sql
SELECT
  id,
  asset_name,
  pipeline_log->>'should_call_gemini' AS should_call_gemini,
  pipeline_log->>'gemini_result'      AS gemini_result,
  pipeline_log->>'tier_assigned'      AS final_tier,
  created_at
FROM marketing.media_ingest_queue
WHERE
  created_at >= NOW() - INTERVAL '14 days'
  AND pipeline_log->>'should_call_gemini' = 'true'
  AND pipeline_log->>'tier_assigned' IN ('discarded', 'tier_archive', 'rejected')
ORDER BY created_at DESC;
```

For each wasted call, identify the shared pattern (e.g., filename keyword, qc_score range, content type).  
Document patterns → propose tightened `classifier_rules` rows to prevent future wasted calls.

---

## Step 5 — Proposed Data-Only Changes

Collect approved changes from Steps 1–4 and apply:

### 5a. New `filename_keyword_map` rows
```sql
-- batch insert drafted in Step 2
```

### 5b. Adjusted `qc_score_bands` boundaries
```sql
UPDATE marketing.qc_score_bands
SET lower_bound = <new_value>
WHERE tier = '<tier>' AND band_name = '<band>';
-- document in PR/notes what the old value was and why it changed
```

### 5c. Tightened `classifier_rules` rows
```sql
UPDATE marketing.classifier_rules
SET threshold = <new_value>
WHERE rule_name = '<rule>';
```

> All data-only changes should be applied with an audit comment in `cockpit_audit_log` or noted in the weekly calibration note (Step 6).

---

## Step 6 — Code-Change Backlog Flags

If any disagreement pattern requires a change to `classify_pre_gemini` logic (not just data):

1. Log it as a GitHub issue with label `backlog`, priority `low`
2. Include: filename pattern, classifier output, expected output, frequency (n/50)
3. Do NOT apply code changes within this runbook — this is data curation only

---

## Step 7 — Weekly Calibration Note Template

```
## Classifier Calibration — Week N (YYYY-MM-DD)

**Ingest count reviewed:** N
**Disagreements found:** N (CE: N | PO: N | MF: N)
**Wasted Gemini calls:** N — pattern: [describe]
**tier_archive rate:** N%

### Data changes applied
- [x] filename_keyword_map: added N rows
- [ ] qc_score_bands: no change
- [ ] classifier_rules: proposed 1 tightening (pending PBS sign-off)

### Code backlog flags
- None / [link to GH issue]

### Next review
Week N+1 target date: YYYY-MM-DD
```

---

## Repeat Schedule

| Week | Action |
|------|--------|
| Week 1 | Full calibration pass (this runbook) |
| Week 2 | Repeat Steps 1–4; compare disagreement delta vs Week 1 |
| Week 3 | If disagreements < 5%, reduce to spot-check only |
| Week 4 | PBS decides: continue weekly, go monthly, or close calibration loop |

---

## Open Blockers (must be resolved by PBS before runbook is fully reliable)

| # | Blocker | Owner |
|---|---------|-------|
| 1 | Minimum 50 uploads required before review is meaningful | Pipeline (time-gated) |
| 2 | No `pbs_override` column → PO vs CE is manual | PBS to add column or process |
| 3 | `pipeline_log->>'tier_assigned'` consistency unconfirmed | Ingest pipeline team |
