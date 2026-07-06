// app/settings/guardrails/page.tsx
// PBS 2026-07-06 v2: full cockpit — 10 domain sections (always visible), top summary strip,
// add-rule + delete-rule per section, dynamic-threshold lock. No subtitle (hidden globally).

import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import GuardrailsClient from './_components/GuardrailsClient';

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

export default async function GuardrailsSettingsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('guardrails')
    .select('id, property_id, domain, rule_key, threshold_kind, threshold_val, active, is_dynamic, notes, updated_at, updated_by')
    .eq('property_id', PROPERTY_ID)
    .order('domain', { ascending: true })
    .order('rule_key', { ascending: true });

  const rows: GuardrailRow[] = (data as GuardrailRow[]) ?? [];

  // Compute summary strip stats server-side (no function props across RSC boundary)
  const total = rows.length;
  const activeCount = rows.filter(r => r.active).length;
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
            stats={{
              total,
              activeCount,
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
