// app/holding/it/cockpit/activity/page.tsx
// Unified live activity timeline. Merges four sources:
//   1. cockpit.aud_change_log     — DDL / schema changes
//   2. cockpit.intake_items        — intake + triage events
//   3. cockpit.cap_skill_calls     — every agent skill invocation
//   4. public.cockpit_audit_log    — governance writes
//
// Initial 200 rows hydrated server-side. The client wrapper polls the API
// every 30s for fresh rows so the page stays "live" without a full reload.
//
// Author: IT-team agent · 2026-05-13 · #77.

import { fetchActivityEvents } from '../_lib/data';
import { ActivityView } from './ActivityView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function CockpitV2ActivityPage() {
  const events = await fetchActivityEvents(200);
  return <ActivityView initialEvents={events} />;
}
