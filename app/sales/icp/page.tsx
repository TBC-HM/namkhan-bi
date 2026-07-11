// app/sales/icp/page.tsx
// PBS 2026-07-11 pm — ADR-147 Sales CRM UI. ICP Segments read-only cockpit.
// Sub-tab under Sales (NOT a new top-level nav item). Editing lands in a later brief.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;
const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const INK_S = '#3A3A3A';
const FOREST = '#1F3A2E'; const SAND = '#B8A878'; const TERRA = '#B8542A'; const CREAM = '#F5F0E1'; const BG = '#F4EFE2';

interface WeightRow  { area: string | null; weight: number | null; scoring_logic: string | null; input_owner: string | null }
interface SegRow     { id: string; key: string | null; name: string | null; description: string | null; criteria: unknown; daily_quota: number | null; source: string | null }
interface ScraperRow { id: string; property_id: number | null; target_category: string | null; status: string | null; daily_target: number | null; lead_count: number | null; icp_segment_id: string | null; cost_per_lead_eur: number | null; monthly_budget_eur: number | null; spend_7d_eur: number | null }
interface FwRow      { slug: string; framework: string | null; core_question: string | null; position: number | null }

async function loadData() {
  const sb = getSupabaseAdmin();
  const [weights, segs, scrapers, fws] = await Promise.all([
    sb.from('v_scoring_model').select('area,weight,scoring_logic,input_owner'),
    sb.from('v_icp_segments_active').select('id,key,name,description,criteria,daily_quota,source').order('name'),
    sb.from('v_scrapers').select('id,property_id,target_category,status,daily_target,lead_count,icp_segment_id,cost_per_lead_eur,monthly_budget_eur,spend_7d_eur').eq('property_id', NAMKHAN),
    sb.from('v_targeting_frameworks').select('slug,framework,core_question,position').order('position'),
  ]);
  return {
    weights:  (weights.data  ?? []) as WeightRow[],
    segs:     (segs.data     ?? []) as SegRow[],
    scrapers: (scrapers.data ?? []) as ScraperRow[],
    fws:      (fws.data      ?? []) as FwRow[],
  };
}

const TH: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: INK_S, padding: '10px 8px', borderBottom: '1px solid ' + HAIR, fontWeight: 500 };
const TD: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid ' + HAIR, fontSize: 13, color: INK, verticalAlign: 'top' };
const CARD: React.CSSProperties = { background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 20 };
const SECTION: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

function money(x: number | null | undefined) {
  if (x == null) return '—';
  return '€' + Number(x).toFixed(0);
}
function pct(x: number | null | undefined) {
  if (x == null) return '—';
  return String(x) + '%';
}

export default async function IcpSegmentsPage() {
  const { weights, segs, scrapers, fws } = await loadData();
  const tabs = SALES_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));

  const totalWeight = weights.reduce((n, w) => n + (Number(w.weight) || 0), 0) || 100;
  const cpaTotal = scrapers.reduce((n, s) => n + (Number(s.spend_7d_eur) || 0), 0);
  const leadsTotal = scrapers.reduce((n, s) => n + (Number(s.lead_count) || 0), 0);

  return (
    <DashboardPage title="ICP Segments" subtitle="Ideal Customer Profile · scoring model · scrapers · frameworks" tabs={tabs} currentTab="/sales/icp">
      <div style={{ display: 'grid', gap: 16 }}>

        {/* Scoring weights bar */}
        <div style={CARD}>
          <div style={SECTION}>Scoring model · 5 areas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {weights.map((w) => {
              const pctVal = ((Number(w.weight) || 0) / totalWeight) * 100;
              return (
                <div key={w.area ?? Math.random()} style={{ display: 'grid', gridTemplateColumns: '160px 60px 1fr', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{w.area ?? '—'}</div>
                  <div style={{ fontSize: 13, color: INK, fontVariantNumeric: 'tabular-nums' }}>{w.weight ?? 0}</div>
                  <div style={{ position: 'relative', height: 8, background: HAIR, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: pctVal + '%', background: FOREST, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: INK_M }}>
            {weights.map((w) => (w.area ?? '?') + ' · ' + (w.scoring_logic ?? '')).join(' · ')}
          </div>
        </div>

        {/* Active segments */}
        <div style={CARD}>
          <div style={SECTION}>Active ICP segments · {segs.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {segs.map((s) => (
              <div key={s.id} style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: 14, background: BG }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 4 }}>{s.name ?? s.key ?? '—'}</div>
                <div style={{ fontSize: 12, color: INK_M, marginBottom: 10 }}>{s.description ?? ''}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11 }}>
                  <span style={{ color: INK_S }}>Quota <strong style={{ color: INK }}>{s.daily_quota ?? '—'}</strong>/day</span>
                  {s.source ? <span style={{ color: INK_M }}>Source · {s.source}</span> : null}
                </div>
              </div>
            ))}
            {segs.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>No active segments.</div> : null}
          </div>
        </div>

        {/* Scrapers cost — CPA drives ICP budget planning */}
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, fontWeight: 500 }}>Scrapers · CPA by segment</div>
            <div style={{ fontSize: 11, color: INK_M }}>{scrapers.length} active · {money(cpaTotal)} / 7d · {leadsTotal} leads</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={TH}>Category</th><th style={TH}>Status</th><th style={TH}>Daily target</th>
              <th style={TH}>Leads</th><th style={TH}>Cost / lead</th>
              <th style={TH}>Monthly budget</th><th style={TH}>Spend 7d</th>
            </tr></thead>
            <tbody>
              {scrapers.map((s) => (
                <tr key={s.id}>
                  <td style={TD}>{s.target_category ?? '—'}</td>
                  <td style={TD}><span style={{ display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 6px', borderRadius: 2, background: (s.status === 'active') ? '#E8F0EC' : CREAM, color: (s.status === 'active') ? FOREST : INK_S, fontWeight: 600 }}>{s.status ?? '—'}</span></td>
                  <td style={{ ...TD, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{s.daily_target ?? '—'}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{s.lead_count ?? 0}</td>
                  <td style={{ ...TD, color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{money(s.cost_per_lead_eur)}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{money(s.monthly_budget_eur)}</td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{money(s.spend_7d_eur)}</td>
                </tr>
              ))}
              {scrapers.length === 0 ? <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: INK_M }}>No scrapers configured.</td></tr> : null}
            </tbody>
          </table>
        </div>

        {/* Framework library */}
        <div style={CARD}>
          <div style={SECTION}>Framework library · {fws.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
            {fws.map((f) => (
              <div key={f.slug} style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{f.framework ?? f.slug}</div>
                <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>{f.core_question ?? ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
