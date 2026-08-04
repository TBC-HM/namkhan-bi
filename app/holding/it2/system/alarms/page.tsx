// app/holding/it2/system/alarms/page.tsx
// alarm-system-v1 slice 2 — Watchdog Cockpit: is anything failing RIGHT NOW
// that nobody noticed? Reads public.v_alarms_* bridges (alarms schema is not
// PostgREST-reachable, L5); actions via fn_alarm_* RPCs (grant-hygiene:
// authenticated+service_role only). Nav: NO new System tab (law 659) —
// reached via Health link card + check-it2-orphans.mjs allowlist, same
// pattern as data-quality and laws.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { AlarmsClient } from './AlarmsClient';
import type { OpenAlarmRow, WatchdogRow, Event7dRow, NoiseRow } from './AlarmsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AlarmsPage() {
  const sb = getSupabaseAdmin();
  const [openRes, wdRes, evRes, noiseRes] = await Promise.all([
    (sb as any).from('v_alarms_open').select('*').order('fired_at', { ascending: false }),
    (sb as any).from('v_alarms_watchdog_health').select('*').order('alarm_code'),
    (sb as any).from('v_alarms_events_7d').select('*').order('fired_at', { ascending: false }),
    (sb as any).from('v_alarms_noise').select('*').order('fires_7d', { ascending: false }),
  ]);

  const open = (openRes.data ?? []) as OpenAlarmRow[];
  const watchdogs = (wdRes.data ?? []) as WatchdogRow[];
  const events = (evRes.data ?? []) as Event7dRow[];
  const noise = (noiseRes.data ?? []) as NoiseRow[];

  const loadError =
    openRes.error?.message ?? wdRes.error?.message ??
    evRes.error?.message ?? noiseRes.error?.message ?? null;

  return (
    <AlarmsClient
      open={open}
      watchdogs={watchdogs}
      events={events}
      noise={noise}
      loadError={loadError}
    />
  );
}
