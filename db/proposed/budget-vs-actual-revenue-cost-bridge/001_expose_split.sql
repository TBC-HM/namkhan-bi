-- APPLIED 2026-09-06 as public_budget_vs_actual_monthly_expose_revenue_cost_split.
-- Audit copy. Triggered by PBS: "so we show wrong department revenue in transport or
-- mekong?" — yes, and this was why.
--
-- Migration budget_vs_actual_monthly_split_revenue_and_cost (earlier the same day) added
-- budget_revenue_usd / budget_cost_usd / actual_revenue_usd / actual_cost_usd to
-- finance.v_budget_vs_actual_monthly. The PUBLIC bridge was never updated, so PostgREST
-- never returned them. app/h/[property_id]/finance/planning already read all four and
-- rendered revenue and cost apart — it had been receiving undefined for every one.
--
-- What was on screen instead were budget_usd / actual_usd, which are revenue PLUS cost
-- per class. Jan-Jun 2026:
--
--   class        shown    real (revenue only)
--   transport     202%      111%   <- cost overrun read as revenue outperformance
--   activities     66%      104%   <- on plan, displayed as a miss
--   fb            130%      108%
--   spa           123%      145%
--   retail        101%      170%
--   imekong       110%      116%
--
-- Transport is worst because its cost accounts (614121) run to more than twice its
-- revenue account (708090), so class totals are dominated by cost.
--
-- Tail append only: CREATE OR REPLACE VIEW cannot drop or reorder columns, so the four
-- go last and every existing consumer keeps its positions.

CREATE OR REPLACE VIEW public.v_budget_vs_actual_monthly AS
  SELECT property_id, year_month, gl_class, class_name,
         budget_usd, budget_version, forecast_usd, actual_usd, is_final,
         var_abs, var_pct, currency_layer,
         budget_revenue_usd, budget_cost_usd, actual_revenue_usd, actual_cost_usd
    FROM finance.v_budget_vs_actual_monthly;

COMMENT ON VIEW public.v_budget_vs_actual_monthly IS
  'Budget vs actual by GL class. budget_usd/actual_usd are revenue PLUS cost for the '
  'class and are kept only for backward compatibility — for anything describing '
  'departmental performance use the *_revenue_usd / *_cost_usd pairs.';

REVOKE ALL ON public.v_budget_vs_actual_monthly FROM anon;
GRANT SELECT ON public.v_budget_vs_actual_monthly TO authenticated, service_role;

-- SEPARATE, NOT FIXED HERE: actuals stop at 2026-06 on the budget page.
-- finance.gl_pl_monthly (account level) has through 2026-08, but
-- finance.gl_pl_summary_monthly (BY CLASS — what this view reads) has only through
-- 2026-06. They are two different uploads: the by-class one is produced by
-- finance.fn_ingest_pl_by_class from an uploaded QuickBooks "P&L by Class" export.
-- July 2026 is is_final=true at account level (83 accounts, 105,937) but its by-class
-- file was never uploaded. That is an ops action, not a code fix, and deriving class
-- from account instead would silently change what "actual" means.
