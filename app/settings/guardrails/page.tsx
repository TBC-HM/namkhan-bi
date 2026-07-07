// app/settings/guardrails/page.tsx
// PBS 2026-07-06 v2: full cockpit — 10 domain sections (always visible), top summary strip,
// add-rule + delete-rule per section, dynamic-threshold lock.
//
// 2026-07-07 v3 (PBS): live/data-missing/not-wired status dot per rule.
// Server-side probes run for every unique data source declared in
// lib/rules/wiring.ts, and each row gets a status computed via
// computeRuleStatus(). Client renders green/red dot + reason on hover.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import GuardrailsClient from './_components/GuardrailsClient';
import { WIRING, computeRuleStatus, type ProbeResult, type RuleStatus } from '@/lib/rules/wiring';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

interface GuardrailRow {
  id: number;
  property_id: number;
  domain: string;
  rule_key: string;
  threshold_kind: string;
  threshold_val: number | string;
  active: boolean;
  is_dynamic: boolean;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

// Probe registry — maps a source string in wiring.ts to a lightweight
// COUNT probe that reports whether that source has rows for the property.
// Keep additions small — every probe adds one Supabase round-trip.
async function runProbes(propertyId: number): Promise<Record<string, ProbeResult>> {
  const sb = getSupabaseAdmin();
  const results: Record<string, ProbeResult> = {};

  // Probes are optimistic on error: if the count call errors (schema not exposed,
  // RLS drop, etc.) we treat the source as unknown-but-ok rather than false-red.
  // A red dot ONLY fires when we can definitively confirm 0 rows for the property.
  const [kpi, reviews, campaigns, campaignRcpt, mvGuest, vDirectory] = await Promise.all([
    sb.rpc('fn_revenue_hod_today_kpi', { p_property_id: propertyId }),
    sb.from('mkt_reviews').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('campaigns').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('campaign_recipients').select('id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('mv_guest_profile').select('property_id', { head: true, count: 'exact' }).eq('property_id', propertyId),
    sb.from('v_directory_full').select('property_id', { head: true, count: 'exact' }).eq('property_id', propertyId),
  ]);

  function probe(res: { data?: unknown; error?: { message: string } | null; count?: number | null }, label: string): ProbeResult {
    if (res.error) return { ok: true, reason: `probe unavailable (${res.error.message})` };
    if (res.count == null) return { ok: true, reason: 'count unavailable · optimistic' };
    if (res.count === 0)  return { ok: false, reason: `${label} has 0 rows for this property` };
    return { ok: true };
  }

  const kpiRow = ((kpi.data ?? []) as unknown as Array<Record<string, unknown>>)[0];
  const okKpi = !kpi.error && kpiRow != null;
  results['fn_revenue_hod_today_kpi'] = okKpi
    ? { ok: true }
    : { ok: false, reason: kpi.error?.message ?? 'RPC returned no row' };

  // pms.* probes ride on the KPI RPC — if the RPC returned tonight's OCC, the PMS pipe is live.
  results['getPulseTodayPickup'] = okKpi ? { ok: true } : { ok: false, reason: 'PMS pipeline unreachable (KPI RPC failed)' };
  results['pms.v_reservations']  = okKpi ? { ok: true } : { ok: false, reason: 'PMS pipeline unreachable (KPI RPC failed)' };

  results['mkt_reviews']         = probe(reviews,      'mkt_reviews');
  results['campaigns']           = probe(campaigns,    'campaigns');
  results['campaign_recipients'] = probe(campaignRcpt, 'campaign_recipients');
  results['mv_guest_profile']    = probe(mvGuest,      'mv_guest_profile');
  results['v_directory_full']    = probe(vDirectory,   'v_directory_full');

  return results;
}

export default async function GuardrailsSettingsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('guardrails')
    .select('id, property_id, domain, rule_key, threshold_kind, threshold_val, active, is_dynamic, notes, updated_at, updated_by')
    .eq('property_id', PROPERTY_ID)
    .order('domain', { ascending: true })
    .order('rule_key', { ascending: true });

  const rows: GuardrailRow[] = (data as GuardrailRow[]) ?? [];

  // Run probes once for the property.
  const probeResults = await runProbes(PROPERTY_ID).catch(() => ({} as Record<string, ProbeResult>));

  // Compute per-row status keyed by row id — client renders the dot.
  const statusById: Record<number, RuleStatus> = {};
  for (const r of rows) {
    statusById[r.id] = computeRuleStatus(r.domain, r.rule_key, r.active, probeResults);
  }

  // Summary strip — same shape as before + live/missing counters.
  const total = rows.length;
  const activeCount = rows.filter(r => r.active).length;
  const liveCount = rows.filter(r => statusById[r.id]?.status === 'live').length;
  const missingCount = rows.filter(r => {
    const s = statusById[r.id]?.status;
    return r.active && (s === 'data_missing' || s === 'not_wired');
  }).length;
  const lastUpdatedRow = rows.reduce<GuardrailRow | null>((acc, r) => {
    if (!r.updated_at) return acc;
    if (!acc || !acc.updated_at) return r;
    return new Date(r.updated_at) > new Date(acc.updated_at) ? r : acc;
  }, null);
  const byDomain = new Map<string, number>();
  for (const r of rows) byDomain.set(r.domain, (byDomain.get(r.domain) ?? 0) + 1);
  let biggestDomain = '—';
  let biggestCount = 0;
  for (const [d, c] of byDomain.entries()) {
    if (c > biggestCount) { biggestDomain = d; biggestCount = c; }
  }

  const lastUpdatedLabel = lastUpdatedRow?.updated_at
    ? new Date(lastUpdatedRow.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—';
  const lastUpdatedRuleLabel = lastUpdatedRow
    ? `${lastUpdatedRow.domain} · ${lastUpdatedRow.rule_key}`
    : '—';

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage title="Settings · Guardrails">
        <div style={{ gridColumn: '1 / -1' }}>
          <GuardrailsClient
            rows={rows}
            statusById={statusById}
            stats={{
              total,
              activeCount,
              liveCount,
              missingCount,
              lastUpdatedLabel,
              lastUpdatedRuleLabel,
              biggestDomain,
              biggestCount,
            }}
          />
        </div>
      </DashboardPage>
    </div>
  );
}
