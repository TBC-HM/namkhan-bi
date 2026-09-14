# 010 · Evidence-register link

Audit copy of migration `evidence_register_link`, applied live via Supabase MCP on
`kpenyneooigsyuuomgct`, 2026-09-15.

## The honest scope, measured before building

There are **1,202 evidence-mode obligations**. `ops.sustainability_evidence` covers
exactly one source:

| Authority | Evidence-mode atoms | Register? |
|---|---|---|
| Travelife | 461 | ✗ |
| ASEAN | 304 | ✗ |
| GSTC | 171 | ✗ |
| Legal | 168 | ✗ |
| **Sustainability** | **81** | ✓ |
| SLH | 16 | ✗ |
| Namkhan | 8 | ✗ |

Reporting this as "evidence coverage" across the mode would print roughly
**"32 of 1,202 · 2.7%"** — the same category error this branch spent the day removing,
in a new costume. It reads as *"you hold almost no evidence"* when the truth is
*"we only have a register for 7% of them"*. So the claim is **scoped to where a register
exists**, and absence stays an explicit "no register" rather than becoming a zero.

## What it adds

- `standards.requirements.sus_req_id` — soft key to `ops.sustainability_requirements.id`.
  Not a foreign key: `requirements` is tenant-neutral and the register is global.
  Matched on the title head (text before the em dash): **80 of 83 resolve**. The 3 that
  do not are left NULL and surface as "no register entry" rather than force-fitted.
- `public.fn_evidence_status(p_property_id)` — per-atom register status. Returns **no row**
  for the ~1,122 evidence atoms with no register. REVOKE anon / GRANT
  authenticated+service_role.

## Deliberately NOT changed

`fn_standards_payload` and `fn_dept_qa_payload`. Both have been re-emitted four times
today and each re-emit is a chance to silently drop another task's work — which already
happened once (the 387 orphaned atoms). This is an additive column plus a sibling bridge,
the same shape as `fn_standards_source_documents`; the pages join it.

`coverable` therefore stays `procedure`-only. Evidence still claims nothing at the
headline; this gives the 80 a real status at row level.

## What it found

80 atoms linked · **32 compliant**, 38 partial, 11 not_started · **0 in date**.

Every single evidence item is past its review date — consistent with the Quality
dashboard's "Sustainability evidence · 129 days". The register exists and is stale, which
is a different problem from the register not existing, and now they are distinguishable.

## Follow-up

The page should render this per row on the department QA page's evidence group. Not done
here — that is a UI change with its own review.
