// app/holding/it2/system/cost/page.tsx
// RETIRED (owner finding #70, 2026-08-05 · brief cost-governance-v2 · ADR-196/230).
// This page read the LEGACY capture path (cockpit.cap_skill_calls.cost_usd_milli +
// cockpit_audit_log.cost_usd_milli) — superseded by costs.* (immutable ledger).
// Two cost surfaces disagreed by construction; one had to go. The canonical cost
// surface is /holding/finance/costs (Cost Governance Engine v2). Live burn +
// kill switch: /holding/it2/system/automation. No data lost — the legacy tables
// remain in the DB; this route just no longer renders a dead path.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyIt2CostRedirect() {
  redirect('/holding/finance/costs');
}
