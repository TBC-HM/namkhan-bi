# 009 · SLH official section scores + year-over-year

Audit copy of migration `slh_official_section_scores`, applied live via Supabase MCP on
project `kpenyneooigsyuuomgct`, 2026-09-15.

## Why

PBS asked for "analytics to the two SLH reports". Two things were in the way, and the
second was a defect in what we already shipped.

**1 · The 2025 report was not in the system.** It existed only as an empty
`standards.sources` row — 0 requirements, 0 audit rows — so year-over-year was
impossible. Its text was in fact available all along: `dms.documents.extracted_md`
holds 77,831 characters for doc `0fed077c…`, extraction_status `extracted`.

**2 · We were displaying our own arithmetic instead of SLH's verdict.**
`knowledge.qa_audits` holds our per-department rollup of the 2026 visit, and the pages
compute a headline as `sum(total_score)/sum(max_score)` = **94.4%**. SLH's own report
states its overall as **94.7%**, and says the figure comes from *"a complex weighting
algorithm including question-level and section-level"* weights. For a certification
score the certifying body's number is the fact; ours is a re-derivation that lands
nearby. Quoting 94.4% as "the SLH score" is wrong in the same family as the other
metric-truth problems this area has had.

**3 · The 8-department rollup collapses SLH's 17 sections**, and that collapse hid the
story. The headline ROSE 3.7 points while three sections fell hard and two crossed the
SLH 80% fail line.

## What it creates

`knowledge.slh_section_scores` — SLH's scores exactly as published, per section per
year. The `is_total` row carries SLH's official overall, which is **not** the mean or
the sum of the sections. Never recompute it; quote it.

`public.v_slh_yoy` — section-level year-over-year, with `crossed_into_fail` flagging a
section that was at or above 80% in 2025 and below it in 2026.

Both REVOKE from `anon`, GRANT to `authenticated, service_role` (ADR-277).

`knowledge.qa_audits` is unchanged and still drives per-department operational routing.
This table is the certifying body's own verdict and outranks it where they disagree.

## What it shows

| Section | 2025 | 2026 | Δ |
|---|---|---|---|
| **TOTAL (SLH official)** | **91.0** | **94.7** | **+3.7** |
| In Room Dining | 92.0 | **72.7** | −19.3 ⚠ crossed into fail |
| Loyalty | 97.4 | 82.6 | −14.8 |
| Pool / Beach | 90.6 | **79.3** | −11.3 ⚠ crossed into fail |
| Booking Experience | 100.0 | 95.8 | −4.2 |
| Full Service Dining | 100.0 | 98.2 | −1.8 |
| Breakfast | 100.0 | 99.1 | −0.9 |
| Housekeeping & Room | 94.9 | 94.3 | −0.6 |
| Departure | 96.2 | 96.0 | −0.2 |
| Arrival · Concierge · Service Recovery · Sustainability | 100.0 | 100.0 | 0.0 |
| SLH Differentiators | 91.3 | 91.3 | 0.0 |
| Bar / Lounge | 90.5 | 92.1 | +1.6 |
| Public Areas | 91.9 | 94.5 | +2.6 |
| Spa | 94.2 | 98.2 | +4.0 |
| SLH Brand | 81.8 | **100.0** | +18.2 |

Every number is transcribed from the two source reports. Nothing is computed.

## Follow-up this creates

The UI still renders 94.4% from `qa_audits`. It should quote `is_total` from this table
instead. Not changed in this migration — that is a page change with its own review.
