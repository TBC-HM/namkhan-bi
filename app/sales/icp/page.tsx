// app/sales/icp/page.tsx
// PBS 2026-07-11 pm — Design System rebuild. Every section wrapped in a
// primitive:
//   TOP     : MetricRow (4 KpiTile)
//   §1      : Container "Scoring model" — 5 weighted areas as bar rows
//   §2      : Container "Active ICP segments" — cards grid
//   §3      : Container "Scrapers · cost & yield" — Chart variant="table"
//   §4      : Container "Framework library" — Chart variant="table"
// Bridge reads unchanged; only presentation.

import {
  DashboardPage,
  Container,
  MetricRow,
  Chart,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

const HAIR = '#E6DFCC'; const INK = '#1B1B1B'; const INK_M = '#5A5A5A';
const FOREST = '#1F3A2E';

interface WeightRow  { area: string | null; weight: number | null; scoring_logic: string | null; input_owner: string | null }
interface SegRow     { id: string; key: string | null; name: string | null; description: string | null; criteria: unknown; daily_quota: number | null; source: string | null }
interface ScraperRow { id: string; property_id: number | null; target_category: string | null; status: string | null; daily_target: number | null; lead_count: number | null; icp_segment_id: string | null; cost_per_lead_eur: number | null; monthly_budget_eur: number | null; spend_7d_eur: number | null }
interface FwRow      { slug: string; framework: string | null; core_question: string | null; position: number | null }

interface PageProps {
  propertyId?: number;
}

async function loadData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [weights, segs, scrapers, fws] = await Promise.all([
    sb.from('v_scoring_model').select('area,weight,scoring_logic,input_owner'),
    sb.from('v_icp_segments_active').select('id,key,name,description,criteria,daily_quota,source').order('name'),
    sb.from('v_scrapers').select('id,property_id,target_category,status,daily_target,lead_count,icp_segment_id,cost_per_lead_eur,monthly_budget_eur,spend_7d_eur').eq('property_id', propertyId),
    sb.from('v_targeting_frameworks').select('slug,framework,core_question,position').order('position'),
  ]);
  return {
    weights:  (weights.data  ?? []) as WeightRow[],
    segs:     (segs.data     ?? []) as SegRow[],
    scrapers: (scrapers.data ?? []) as ScraperRow[],
    fws:      (fws.data      ?? []) as FwRow[],
  };
}

function money(x: number | null | undefined) {
  if (x == null) return '—';
  return '€' + Number(x).toFixed(0);
}

export default async function IcpSegmentsPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN;
  const { weights, segs, scrapers, fws } = await loadData(pid);
  const tabs = SALES_SUBPAGES.map((s) => ({ key: s.href, label: s.label, href: s.href }));

  const totalWeight = weights.reduce((n, w) => n + (Number(w.weight) || 0), 0) || 100;
  const activeScrapers = scrapers.filter((s) => s.status === 'active').length;
  const cpaTotal = scrapers.reduce((n, s) => n + (Number(s.spend_7d_eur) || 0), 0);
  const leadsTotal = scrapers.reduce((n, s) => n + (Number(s.lead_count) || 0), 0);
  const monthlyBudget = scrapers.reduce((n, s) => n + (Number(s.monthly_budget_eur) || 0), 0);

  const kpiTiles: KpiTileProps[] = [
    { label: 'Segments active', value: segs.length,       size: 'sm' },
    { label: 'Scrapers running',value: activeScrapers,    size: 'sm', status: activeScrapers > 0 ? 'green' : 'grey', footnote: scrapers.length + ' total' },
    { label: 'Monthly budget',  value: Math.round(monthlyBudget), currency: 'EUR', size: 'sm', footnote: 'sum of scraper budgets' },
    { label: 'Leads scraped 7d',value: leadsTotal,        size: 'sm', footnote: money(cpaTotal) + ' spent' },
  ];

  return (
    <DashboardPage
      title="ICP Segments"
      subtitle="Ideal Customer Profile · scoring model · scrapers · frameworks"
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={kpiTiles} size="sm" />
      </div>

      {/* §1 Scoring model */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Scoring model" subtitle="5 weighted areas · total weight normalises to 100">
          <div style={{ display: 'grid', gap: 10 }}>
            {weights.map((w, i) => {
              const pctVal = ((Number(w.weight) || 0) / totalWeight) * 100;
              return (
                <div key={(w.area ?? '') + '-' + i} style={{ display: 'grid', gridTemplateColumns: '180px 60px 1fr 1fr', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: INK, fontWeight: 500 }}>{w.area ?? '—'}</div>
                  <div style={{ fontSize: 13, color: INK, fontVariantNumeric: 'tabular-nums' }}>{w.weight ?? 0}</div>
                  <div style={{ position: 'relative', height: 8, background: HAIR, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: pctVal + '%', background: FOREST, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 11, color: INK_M }}>{w.scoring_logic ?? ''}</div>
                </div>
              );
            })}
            {weights.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>No scoring weights configured.</div> : null}
          </div>
        </Container>
      </div>

      {/* §2 Active segments */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Active ICP segments" subtitle={segs.length + ' segments'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {segs.map((s) => (
              <Container key={s.id} title={s.name ?? s.key ?? '—'} subtitle={s.source ? 'Source · ' + s.source : undefined} density="compact" expandable={false}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, color: INK_M, lineHeight: 1.4 }}>{s.description ?? ''}</div>
                  <div style={{ fontSize: 11, color: INK_M }}>
                    Quota <strong style={{ color: INK }}>{s.daily_quota ?? '—'}</strong>/day
                  </div>
                </div>
              </Container>
            ))}
            {segs.length === 0 ? <div style={{ fontSize: 12, color: INK_M }}>No active segments.</div> : null}
          </div>
        </Container>
      </div>

      {/* §3 Scrapers */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Scrapers · cost & yield"
          subtitle={activeScrapers + ' active · ' + money(cpaTotal) + ' spent 7d · ' + leadsTotal + ' leads'}
        >
          {scrapers.length === 0 ? (
            <div style={{ fontSize: 12, color: INK_M, textAlign: 'center', padding: 12 }}>No scrapers configured.</div>
          ) : (
            <Chart
              variant="table"
              xKey="category"
              data={scrapers.map((s) => ({
                category: s.target_category ?? '—',
                status: (s.status ?? '—').toUpperCase(),
                daily_target: s.daily_target ?? 0,
                leads: s.lead_count ?? 0,
                cost_per_lead: money(s.cost_per_lead_eur),
                monthly_budget: money(s.monthly_budget_eur),
                spend_7d: money(s.spend_7d_eur),
              }))}
              series={[
                { key: 'status',         label: 'Status' },
                { key: 'daily_target',   label: 'Daily target' },
                { key: 'leads',          label: 'Leads' },
                { key: 'cost_per_lead',  label: 'Cost / lead' },
                { key: 'monthly_budget', label: 'Monthly budget' },
                { key: 'spend_7d',       label: 'Spend 7d' },
              ]}
            />
          )}
        </Container>
      </div>

      {/* §4 Framework library */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Framework library" subtitle={fws.length + ' frameworks'}>
          {fws.length === 0 ? (
            <div style={{ fontSize: 12, color: INK_M, textAlign: 'center', padding: 12 }}>No frameworks.</div>
          ) : (
            <Chart
              variant="table"
              xKey="framework"
              data={fws.map((f) => ({
                framework: f.framework ?? f.slug,
                core_question: f.core_question ?? '',
              }))}
              series={[
                { key: 'core_question', label: 'Core question' },
              ]}
            />
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
