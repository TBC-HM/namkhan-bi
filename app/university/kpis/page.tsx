// app/university/kpis/page.tsx
// TBC University · KPI dictionary. Reads public.v_kpi_definitions (read
// contract: kpi label, family, meaning_plain, formula_plain, watch_out,
// definition_status) merged with public.v_kpi_conformance_status (nightly
// conformance battery: green=battery-verified · amber=gated-not-yet-tested ·
// red=MISMATCH · grey=ungated) and public.v_kpi_golden_values (hand-certified
// golden records). Column naming is tolerated loosely and the page renders a
// friendly "being written" state until the view exists. Family sections +
// client-side search + owner gating live in KpiExplorer.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Breadcrumbs from '../_components/Breadcrumbs';
import KpiExplorer, { type KpiRow, type GoldenRow } from './KpiExplorer';
import { INK, INK_SOFT, HAIR, WARM, SANS } from '../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type ConformanceInfo = {
  color: string;
  checksCount: number;
  runPoints: number;
  lastRunAt: string | null;
};

export default async function KpiDictionaryPage() {
  let kpis: KpiRow[] = [];
  let goldens: GoldenRow[] = [];
  let available = false;
  try {
    const sb = getSupabaseAdmin();

    // Conformance battery status per kpi_number (view may not exist yet —
    // tolerate failure, cards fall back to no-dot rendering).
    const conformance = new Map<number, ConformanceInfo>();
    try {
      const { data: confData, error: confErr } = await sb.from('v_kpi_conformance_status').select('*');
      if (!confErr && Array.isArray(confData)) {
        for (const r of confData as Record<string, unknown>[]) {
          const n = num(r.kpi_number);
          if (n == null) continue;
          conformance.set(n, {
            color: str(r.conformance_color) ?? 'grey',
            checksCount: num(r.checks_count) ?? 0,
            runPoints: num(r.run_points) ?? 0,
            lastRunAt: str(r.last_run_at),
          });
        }
      }
    } catch { /* battery views not deployed yet */ }

    try {
      const { data: gData, error: gErr } = await sb.from('v_kpi_golden_values').select('*');
      if (!gErr && Array.isArray(gData)) {
        goldens = (gData as Record<string, unknown>[]).map((r) => ({
          goldenId: num(r.golden_id) ?? 0,
          kpiNumber: num(r.kpi_number) ?? 0,
          propertyId: num(r.property_id) ?? 0,
          windowStart: str(r.window_start) ?? '',
          windowEnd: str(r.window_end) ?? '',
          expectedValue: num(r.expected_value),
          currencyLayer: str(r.currency_layer) ?? '',
          sourceNote: str(r.source_note) ?? '',
          certified: r.certified === true,
          certifiedBy: str(r.certified_by),
        })).filter((g) => g.goldenId > 0);
      }
    } catch { /* golden view not deployed yet */ }

    const { data, error } = await sb.from('v_kpi_definitions').select('*');
    if (!error && Array.isArray(data)) {
      available = true;
      kpis = (data as Record<string, unknown>[]).map((r) => {
        const kpiNumber = num(r.kpi_id) ?? num(r.kpi_number) ?? null;
        const conf = kpiNumber != null ? conformance.get(kpiNumber) : undefined;
        return {
          kpiNumber,
          label: str(r.label) ?? str(r.kpi_label) ?? str(r.kpi) ?? str(r.kpi_name) ?? str(r.name) ?? 'Unnamed KPI',
          family: str(r.family) ?? 'Other',
          meaning: str(r.meaning_plain) ?? str(r.meaning) ?? '',
          formula: str(r.formula_plain) ?? str(r.formula) ?? '',
          watchOut: str(r.watch_out) ?? str(r.watchout) ?? '',
          status: str(r.definition_status) ?? str(r.status) ?? 'ai-draft',
          conformance: conf?.color ?? 'grey',
          checksCount: conf?.checksCount ?? 0,
          lastRunAt: conf?.lastRunAt ?? null,
        };
      });
    }
  } catch { /* view not there yet — friendly state below */ }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <header style={{ marginBottom: 16 }}>
        <Breadcrumbs items={[{ label: 'TBC University', href: '/university' }, { label: 'KPI dictionary' }]} />
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 700, color: INK }}>KPI dictionary</h1>
        <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT }}>
          Every number the dashboards show — what it means in plain words, how it is calculated,
          and what to watch out for when reading it. The nightly conformance battery recomputes
          each approved KPI independently from its definition and flags any mismatch.
        </p>
      </header>

      {(!available || kpis.length === 0) ? (
        <div style={{
          marginTop: 18, border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM,
          padding: '30px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>📊</div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 600, color: INK }}>
            The KPI dictionary is being written.
          </div>
          <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
            Definitions for occupancy, ADR, RevPAR and the rest are on the way. Check back soon —
            or ask on the <a href="/university" style={{ color: '#084838' }}>University landing page</a>.
          </div>
        </div>
      ) : (
        <KpiExplorer kpis={kpis} goldens={goldens} />
      )}
    </div>
  );
}
