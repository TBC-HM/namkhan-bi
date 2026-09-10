# Guest (OTA) ratings — audit notes

Applied via Supabase MCP 2026-09-10: `review_source_scale_and_history`,
`ota_category_dept_map_and_view`, `standards_payload_v5_guest_scores`.

## No new ratings table was created

`marketing.review_source_summary` ALREADY had every column needed —
`score_overall`, `score_cleanliness`, `score_service`, `score_location`, `score_value`,
`score_sleep`, `score_rooms`, `score_staff`, `score_facilities`, `score_comfort`,
`score_wifi`, plus `ranking_position` / `ranking_total` / `ranking_context`. Every
category Booking and TripAdvisor publish fits. The sub-score columns were simply
never populated. (`marketing.mkt_ta_subcategory_ratings` is TripAdvisor-only, wide,
and empty — left untouched.)

## Two defects fixed on the way in

**1. Scale was ambiguous, and silently wrong.** The live Booking row held
`score_overall` = 4.7 (out of 5) beside `score_cleanliness` = 9.7 (out of 10) and
`score_service` = 4.85 (out of 5) — three scales in one row, with nothing recording
which. Any consumer averaging them produced a meaningless number and could not
detect it. Added `score_scale`; all `score_*` in a row are now on that scale, and
`v_ota_ratings_latest` exposes `score_5` normalised across platforms.

`score_service` for Booking is now NULL, deliberately: Booking publishes **Staff**,
not Service. The 4.85 was a stray value from the other scale.

**2. No history.** One row per property+source meant every refresh destroyed the
previous reading, so "is cleanliness improving?" was unanswerable — the question a
quality system exists to answer. Added `marketing.review_source_snapshots`,
append-only, one reading per platform per day.

## Today's readings (PBS manual, 2026-09-10)

| | Booking | TripAdvisor |
|---|---|---|
| Overall | 9.1/10 (202 reviews) | 4.8/5 (224 reviews) |
| Rank | — | #13 of 151, Travellers' Choice 2026 |
| Cleanliness | 9.5 | 4.9 |
| Staff / Service | 9.6 | 4.9 |
| Comfort / Rooms | 9.3 | 4.8 |
| Sleep | — | 4.8 |
| Facilities | 9.3 | — |
| Value | 8.4 | 4.7 |
| Location | 8.4 | 4.6 |
| Free WiFi | 8.8 | — |

Booking's `ranking_context` also corrected: it still read "Superb 9.4/10", now
contradicted by the 9.1.

## Category → department is a TABLE, not a CASE

`marketing.ota_category_dept_map` (category, dept_code, weight, note, active), so PBS
can change it. Booking's "Staff" and TripAdvisor's "Service" are **not** the same
thing — Staff spans every guest-facing team, Service is read mostly at the table — and
that judgement is the owner's, not the agent's. Weights let one category split across
departments (`comfort` = housekeeping 0.7 / maintenance 0.3).

`public.v_ota_dept_scores` weights and normalises. Result:

| Dept | Guests /5 | Weakest |
|---|---|---|
| gm | 4.43 | value 4.20 (booking) |
| maintenance | 4.60 | wifi 4.40 (booking) |
| grounds | 4.65 | facilities 4.65 (booking) |
| housekeeping | 4.79 | comfort 4.65 (booking) |
| front_office | 4.84 | staff 4.80 (booking) |
| roots_service | 4.85 | staff 4.80 (booking) |

## Why both numbers are shown

Housekeeping: **guests 4.79/5 (95.8%), SLH pool deck 79.3%**. A guest rates the room
they slept in; an inspector walks the whole property against a checklist. Showing
either alone tells half the truth, so the Standard tab now carries both columns.
