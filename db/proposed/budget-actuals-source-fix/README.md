# budget-actuals-source-fix — actuals from the P&L upload, not the journal feed

**Status: APPLIED 2026-09-07.** Two migrations. Approved by PBS ("OK GO").

## The bug

The budget grid took actuals from `finance.gl_entries` (the journal feed) via
`finance.v_gl_pl_monthly_combined` → `finance.gl_mv_usali_pl_monthly`. That feed carries
almost no P&L postings after May:

| Month | Entries | Non-P&L | Survive `is_pl` |
|---|---|---|---|
| May | 1,148 | 1,063 | 85 |
| Jun | 676 | 650 | **26** |
| Jul | 121 | **121** | **0** |
| Aug | 303 | **303** | **0** |

July and August contain **only balance-sheet postings** — which is what PBS meant by
"P/L by month and by class we only have for end June". But June was also crippled: the
grid showed **$1,206 across 13 lines with zero revenue lines** against a $102,879 budget,
roughly −99%, for a month whose P&L was Revenue $78,810 and total $133,023.

Refreshing the matview was tried first and changed nothing — the gap is structural, not
staleness.

## The fix

Actuals now come from `finance.gl_pl_monthly` — the uploaded QuickBooks P&L by month,
account level, carrying `is_final`.

**Validated on 2026-05, where both sources are complete:** identical Revenue ($56,542
from each), identical Payroll, Utilities, Sales & Marketing, Interest, Depreciation and
FX. Only four cost lines differ, by $72–$209, from late entries.

### Three deliberate differences from the old `act` CTE

1. **No revenue sign flip.** `gl_entries` stores revenue as a credit, hence the old
   `CASE WHEN usali_subcategory = 'Revenue' THEN -sum(...)`. `gl_pl_monthly` already
   stores it positive — which is exactly why the May figures reconcile without negation.
   Keeping the flip would have inverted every revenue line.
2. **Property scoping.** The old CTE had none — `v_gl_pl_monthly_combined` has no
   `property_id` column at all, so actuals from *every* property joined to the budget on
   `(period, account_code)` alone. `gl_pl_monthly` holds 2 properties for 2026, so this
   was a live cross-tenant leak (invariant 4). Fixed, which also let the final SELECT
   drop its hardcoded `260955` fallback.
3. **VAT join preserved, still a no-op.** `gl_vat_rates` has no row with
   `applies_to IN ('actual','both')` — only `'budget'` (10%) and `'none'`. So budget is
   stripped of VAT and actuals are taken as posted. The join is kept so adding an
   `'actual'` rate later needs no migration.

## Result

| Month | Budget | Actual (was) | Actual (now) | of which Revenue | Closed |
|---|---|---|---|---|---|
| Jun | 102,879 | **1,206** | **133,023** | 78,810 | yes |
| Jul | 111,245 | — | **105,937** | 50,597 | yes |
| Aug | 102,667 | — | **73,348** | 54,603 | **no** |

## `is_final` exposed, and used

Surfacing July and August created a new way to be misled: August is `is_final = false`
(61 accounts against July's 83) so it renders as a 29% miss when it is simply still open.
The flag was already computed in the CTE and never selected — now tail-appended, and the
budget grid marks such months with a quiet superscript ring and a tooltip. Marked rather
than hidden: a partial actual is useful, an unlabelled one is not.

NULL `is_final` means no actual at all for that month, which is not the same as "open"
and is not marked.

## Note for whoever closes the books

`gl_pl_monthly` has **July 2026 flagged `is_final = true`** (83 accounts, $105,937).
That contradicts "we only have to end June". Either July was closed and the by-class
export simply has not been produced, or that flag is wrong. Worth one question — it
decides whether July should be on screen at all.

`finance.gl_pl_summary_monthly` (the separate BY CLASS upload, which the Planning page
reads) genuinely still ends at June, so the Planning variance table correctly stops there.
The two pages disagreeing by a month is expected, not a bug.
