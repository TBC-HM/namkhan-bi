// app/cockpit-v2/health/page.tsx
// Health — V2 port of /cockpit/health. Combines:
//   cockpit_incidents          (resolved_at IS NULL → open)
//   cockpit_audit_log          (last 24h)
//   cockpit_audit_log          (webhook events: github-webhook, supabase-webhook, vercel-webhook, deploy-prod-workflow)
//   scheduled_task_runs        (cron status — latest per task)
//   v_scheduled_task_cost_burn (daily spend)
// Server-rendered with a 30s client poll so PBS can leave the tab open.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { fetchHealth } from '../_lib/data-port';
import { HealthView } from './HealthView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function CockpitV2HealthPage() {
  const data = await fetchHealth();
  return <HealthView initial={data} />;
}
