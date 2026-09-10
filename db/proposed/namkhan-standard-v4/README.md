# namkhan-standard-v4 — Stage 3 (GAP): coverage mapping

Audit copy of migrations applied via Supabase MCP on 2026-09-10.
`supabase/migrations/` is DEAD in this repo; this directory is the trail.

Applied, in order:

1. `standards_coverage_provenance_columns` — additive `method`, `strength`,
   `confidence`, `updated_at` on `standards.sop_coverage`.
2. `standards_map_declared_coverage` (+ `_fix_ambiguity`) —
   `standards.fn_map_declared_coverage` / `public.fn_standards_map_coverage`.
3. `standards_sop_chunks_v2` — `standards.sop_chunks`, `fn_build_sop_chunks`,
   and the two edge-function RPCs.
4. `standards_sop_chunk_claim_stable_window` — stable offset windows.
5. `standards_similarity_suggestions` (+ `_searchpath`) —
   `standards.fn_map_similarity_suggestions` / `public.fn_standards_suggest_coverage`.
6. `standards_payload_v3_coverage_strength` — payload exposes the three strengths.

Edge function: `standards-embed-sops` (v2), sibling of `standards-embed`.

## The three strengths, and why they are never one number

| strength | method | how it is decided | count |
|---|---|---|---|
| `exact` | `declared_req` | the SOP names the requirement (sustainability `req_code`) | 52 |
| `declared` | `declared_law` | the SOP names the LAW; credited with all its obligations | 156 |
| `suggested` | `similarity` | embedding proposed it; `covered` stays FALSE | 296 |

`covered` = exact + declared = **208 of 1,777**. Suggestions count as nothing.

## Why similarity never auto-accepts

Measured on the live corpus before the mapper was written: every atom's best
match scores above 0.78, and 989 sit in 0.85–0.90 — the distribution has no
natural separation, so gte-small is not discriminative on this text. Hand-reading
the top 14 pairs gave ~9 right, 4 tangential, 1 flatly wrong ("Potable water
quality tested" matched `SOP-ENG-001-Pool-Chemistry`; drinking water is not pool
water). ~64% precision at the BEST end, with 1,748 of 1,777 atoms below it.

A 0.85 auto-accept would have declared 1,018 requirements covered with roughly
half of them wrong — in a compliance tool. The 0.87 cut is chosen for
reviewability, not confidence.

## Operational notes

- `WORKER_RESOURCE_LIMIT` (HTTP 546): the Edge worker dies at ~12 gte-small runs.
  Batch size is 10 and the caller drives ~79 invocations.
- Claim windows must be STABLE (`p_offset` over all chunks ordered by
  `sop_code, chunk_no`). "Next N unembedded" makes every concurrent worker claim
  the same rows, because none has written yet.
- pgvector lives in `extensions`; any function using `<=>` needs it on the
  search_path or fails with "operator does not exist".
- TENANCY: `knowledge.sop_content` has NO `property_id`. Ownership is
  `ops.qa_dash_source_map.owns_global_registers` (Namkhan true, Donna false).
  Both mappers check it first and write nothing for a non-owner. Verified:
  `fn_standards_map_coverage(1000001)` returns `skipped_not_register_owner`.

## Recovering the exact DDL

Deliberately not transcribed here. Invariant 1 makes the live database the source
of truth for schema, and a hand-copied DDL that drifts is worse than none — it
reads as authoritative while being wrong. Pull the deployed definitions:

```sql
SELECT pg_get_functiondef(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE (n.nspname = 'standards' AND p.proname IN
         ('fn_map_declared_coverage','fn_build_sop_chunks','fn_map_similarity_suggestions'))
    OR (n.nspname = 'public' AND p.proname LIKE 'fn_standards_%');
```

## Re-running after SOPs change

```sql
SELECT * FROM public.fn_standards_build_sop_chunks();   -- rebuild chunks
-- then re-embed (see standards-embed-sops; batch 10, stable offsets), then:
SELECT * FROM public.fn_standards_map_coverage(260955);   -- declared links
SELECT * FROM public.fn_standards_suggest_coverage(260955); -- suggestions
```

All three are idempotent. `fn_map_declared_coverage` and
`fn_map_similarity_suggestions` clear only their OWN rows — a `manual` row, once a
human has made one, is never touched by either.
