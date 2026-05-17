// app/cockpit-v2/cost/page.tsx
// Cost tab — V2 port. Aggregates Anthropic spend from BOTH
//   cockpit.cap_skill_calls.cost_usd_milli (skill invocations)
//   public.cockpit_audit_log.cost_usd_milli (governance writes)
// over 24h / 7d / 30d windows. Top tickets (24h) + top agents (7d) by
// cumulative cost. Server-rendered with a 60s client poll.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { fetchCostBreakdown } from '../_lib/data-port';
import { CostView } from './CostView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function CockpitV2CostPage() {
  const breakdown = await fetchCostBreakdown();
  return <CostView initial={breakdown} />;
}
