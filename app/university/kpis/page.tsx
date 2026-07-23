// app/university/kpis/page.tsx
// TBC University · KPI dictionary. Reads public.v_kpi_definitions (read
// contract: kpi label, family, meaning_plain, formula_plain, watch_out,
// definition_status). Column naming is tolerated loosely (label / kpi_label /
// kpi / name) and the page renders a friendly "being written" state until the
// view exists. Family sections + client-side search live in KpiExplorer.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Breadcrumbs from '../_components/Breadcrumbs';
import KpiExplorer, { type KpiRow } from './KpiExplorer';
import { INK, INK_SOFT, HAIR, WARM, SANS } from '../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

export default async function KpiDictionaryPage() {
  let kpis: KpiRow[] = [];
  let available = false;
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.from('v_kpi_definitions').select('*');
    if (!error && Array.isArray(data)) {
      available = true;
      kpis = (data as Record<string, unknown>[]).map((r) => ({
        label: str(r.label) ?? str(r.kpi_label) ?? str(r.kpi) ?? str(r.name) ?? 'Unnamed KPI',
        family: str(r.family) ?? 'Other',
        meaning: str(r.meaning_plain) ?? str(r.meaning) ?? '',
        formula: str(r.formula_plain) ?? str(r.formula) ?? '',
        watchOut: str(r.watch_out) ?? str(r.watchout) ?? '',
        status: str(r.definition_status) ?? str(r.status) ?? 'ai-draft',
      }));
    }
  } catch { /* view not there yet — friendly state below */ }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <header style={{ marginBottom: 16 }}>
        <Breadcrumbs items={[{ label: 'TBC University', href: '/university' }, { label: 'KPI dictionary' }]} />
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 700, color: INK }}>KPI dictionary</h1>
        <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT }}>
          Every number the dashboards show — what it means in plain words, how it is calculated,
          and what to watch out for when reading it.
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
        <KpiExplorer kpis={kpis} />
      )}
    </div>
  );
}
