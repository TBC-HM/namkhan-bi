// app/university/kpi/[code]/page.tsx
// TBC University · generated KPI reference page — ONE page per kpi_catalog
// row (design brief: Reference layer, /university/kpi/<code>). Renders LIVE
// from public.v_kpi_definitions (single source, never hand-duplicated),
// merged with the nightly conformance battery (v_kpi_conformance_status)
// and hand-certified goldens (v_kpi_golden_values). The nightly refresh
// loop mirrors the same content into university.articles for the ask
// window / brain corpus — this page is the canonical human-facing render.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import Breadcrumbs from '../../_components/Breadcrumbs';
import Feedback from '../../_components/Feedback';
import {
  INK, INK_SOFT, HAIR, GREEN, GOLD, RED, WARM, SANS,
  BODY_SIZE, BODY_LEADING, WARN_BG, WARN_BORDER,
} from '../../_lib/theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type KpiDef = {
  kpi_id: number; kpi_name: string; family: string | null; section: string | null;
  status: string | null; meaning_plain: string | null; formula_plain: string | null;
  watch_out: string | null; definition_status: string | null; gold_view: string | null;
};

type Conformance = {
  kpi_number: number; conformance_color: string | null;
  checks_count: number | null; last_run_at: string | null;
};

type Golden = {
  kpi_number: number; property_id: number; window_start: string; window_end: string;
  expected_value: number | null; currency_layer: string | null; certified: boolean | null;
};

const CONF_LABEL: Record<string, { label: string; color: string }> = {
  green: { label: 'battery-verified', color: GREEN },
  amber: { label: 'gated · not yet tested', color: GOLD },
  red: { label: 'MISMATCH — definition and implementation disagree', color: RED },
  grey: { label: 'not yet gated', color: INK_SOFT },
};

function titleOf(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function KpiReferencePage({ params }: { params: { code: string } }) {
  const code = Number(decodeURIComponent(params.code ?? ''));
  let def: KpiDef | null = null;
  let conf: Conformance | null = null;
  let goldens: Golden[] = [];

  if (Number.isFinite(code)) {
    try {
      const sb = getSupabaseAdmin();
      const [dRes, cRes, gRes] = await Promise.all([
        sb.from('v_kpi_definitions').select('*').eq('kpi_id', code).maybeSingle(),
        sb.from('v_kpi_conformance_status').select('*').eq('kpi_number', code).maybeSingle(),
        sb.from('v_kpi_golden_values').select('*').eq('kpi_number', code),
      ]);
      def = (dRes.data as KpiDef | null) ?? null;
      conf = (cRes.data as Conformance | null) ?? null;
      goldens = (gRes.data as Golden[] | null) ?? [];
    } catch { /* friendly not-found below */ }
  }

  if (!def) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
        <Breadcrumbs items={[
          { label: 'TBC University', href: '/university' },
          { label: 'KPI dictionary', href: '/university/kpis' },
          { label: 'Not found' },
        ]} />
        <div style={{
          marginTop: 22, border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM,
          padding: '30px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>
            This KPI is not in the dictionary (yet).
          </div>
          <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
            It may not be live, or its plain-language definition is still being written.
            Browse the <a href="/university/kpis" style={{ color: GREEN }}>KPI dictionary</a> instead.
          </div>
        </div>
      </div>
    );
  }

  const confInfo = CONF_LABEL[(conf?.conformance_color ?? 'grey').toLowerCase()] ?? CONF_LABEL.grey;
  const verified = def.definition_status === 'owner_verified';

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px 60px', fontFamily: SANS }}>
      <Breadcrumbs items={[
        { label: 'TBC University', href: '/university' },
        { label: 'KPI dictionary', href: '/university/kpis' },
        { label: titleOf(def.kpi_name) },
      ]} />

      <header style={{ margin: '14px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: INK }}>{titleOf(def.kpi_name)}</h1>
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, letterSpacing: '0.04em',
            background: verified ? 'rgba(8,72,56,0.10)' : 'rgba(180,138,58,0.15)',
            color: verified ? GREEN : GOLD,
          }}>
            {verified ? '✓ OWNER VERIFIED' : '~ AI DRAFT'}
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: 11.5, color: INK_SOFT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {[def.family, def.section, `KPI #${def.kpi_id}`].filter(Boolean).join(' · ')}
        </div>
      </header>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK }}>What it means</h2>
        <p style={{ margin: 0, fontSize: BODY_SIZE, lineHeight: BODY_LEADING, color: INK }}>
          {def.meaning_plain || 'Definition being written.'}
        </p>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK }}>How it is calculated</h2>
        <pre style={{
          margin: 0, padding: '12px 14px', background: WARM, border: `1px solid ${HAIR}`,
          borderRadius: 6, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: INK,
        }}>
          {def.formula_plain || '—'}
        </pre>
      </section>

      {def.watch_out && (
        <section style={{
          marginTop: 18, padding: '12px 14px', borderRadius: 6,
          background: WARN_BG, border: `1px solid ${WARN_BORDER}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 4 }}>⚠ Watch out</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.65, color: INK }}>{def.watch_out}</div>
        </section>
      )}

      <section style={{ marginTop: 18 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK }}>Where the number comes from</h2>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: INK_SOFT }}>
          <div>
            Source view:{' '}
            <code style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 12, color: INK }}>
              {def.gold_view ?? 'n/a'}
            </code>
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
            <span aria-hidden style={{
              width: 8, height: 8, borderRadius: '50%', background: confInfo.color, display: 'inline-block',
            }} />
            <span>
              Nightly conformance check: <strong style={{ color: confInfo.color }}>{confInfo.label}</strong>
              {conf?.last_run_at ? ` · last run ${new Date(conf.last_run_at).toISOString().slice(0, 10)}` : ''}
            </span>
          </div>
        </div>
      </section>

      {goldens.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: INK }}>Certified reference values</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: INK_SOFT }}>
                <th style={{ padding: '4px 8px 4px 0', fontWeight: 600 }}>Window</th>
                <th style={{ padding: '4px 8px', fontWeight: 600 }}>Expected</th>
                <th style={{ padding: '4px 8px', fontWeight: 600 }}>Currency layer</th>
                <th style={{ padding: '4px 0 4px 8px', fontWeight: 600 }}>Certified</th>
              </tr>
            </thead>
            <tbody>
              {goldens.map((g, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${HAIR}`, color: INK }}>
                  <td style={{ padding: '5px 8px 5px 0' }}>{g.window_start} → {g.window_end}</td>
                  <td style={{ padding: '5px 8px', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>
                    {g.expected_value ?? '—'}
                  </td>
                  <td style={{ padding: '5px 8px' }}>{g.currency_layer ?? '—'}</td>
                  <td style={{ padding: '5px 0 5px 8px' }}>{g.certified ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div style={{ marginTop: 26, borderTop: `1px solid ${HAIR}`, paddingTop: 14 }}>
        <Feedback slug={`kpi-${def.kpi_id}`} module="kpis" />
      </div>
    </div>
  );
}
