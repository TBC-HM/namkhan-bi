# namkhan-standard-v5 — SLH scores on the Standard tab

Audit copy of `standards_payload_v4_slh_scores`, applied via Supabase MCP 2026-09-10.

## What changed

`public.fn_standards_payload` now joins `knowledge.qa_audits`. The Standard tab showed
what a department MUST do but not how it SCORED — both keyed by `dept_code`, both
already in the database, never joined.

New in the payload:

- `audit` — header summary: auditor, date, departments scored, worst department + %
- per department: `slh_pct`, `slh_worst_pct`, `slh_sections`, `slh_top_miss`

## Why weighted, and why a second number

Housekeeping has TWO records for the same visit — main section 93.9%, pool deck 79.3%.
Either number alone misleads, in opposite directions:

- 93.9% hides the only section below the SLH 80% fail line
- 79.3% condemns a department that is actually strong

So `slh_pct` is weighted (`sum(total_score) / sum(max_score)` = **92.6%** for
housekeeping) and `slh_worst_pct` carries the failing section separately. The UI shows
the weighted figure with "worst NN%" beneath it, and only when a department has more
than one section and they differ.

`slh_top_miss` is the *worst* section's recorded cause, picked with
`(array_agg(top_miss ORDER BY pct_score ASC))[1]` — not an arbitrary row.

## Tenancy

`knowledge.qa_audits` carries `property_id` and is filtered on `p_property_id`, so this
needs no extra guard — unlike the SOP registers, which are global.

## The SOP link (no migration — UI only)

`/operations/sops/<code>/preview` ALREADY existed and already renders the full
structured document with Print / Save as PDF, Download .doc, Edit and Send-by-email.
It was never linked from the Standard tab, so every SOP code read as dead text. Now
every code — exact, declared and suggested — is a link.

The canonical `/h/<pid>/...` form is emitted (L6). For Namkhan that route is a
`DeptSubpageStub` which redirects to the live legacy path; for a tenant without SOPs it
renders the wiring-pending page rather than a 404.
