// app/marketing/digital/web/page.tsx
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_S = '#5A5A5A';

type MetricRow = { metricValues?: {value:string}[] };
type DimMetricRow = { dimensionValues?: {value:string}[]; metricValues?: {value:string}[] };
type GscRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

function mv(row: MetricRow, idx: number): number {
  return parseFloat(row.metricValues?.[idx]?.value ?? '0') || 0;
}

function fmt(n: number, dec = 0): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(dec);
}

function posColor(p: number) {
  return p <= 3 ? '#16A34A' : p <= 10 ? INK : '#DC2626';
}

export default async function DigitalWebPage() {
  const cfg = DEPT_CFG.marketing;
  const tabs: DashboardTab[] = (cfg.subPages ?? []).map(s => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/digital',
  }));

  const sb = getSupabaseAdmin();

  const [ovRes, pgRes, srcRes, qRes, gscPgRes] = await Promise.all([
    sb.from('v_ga4_reports').select('totals,date_range,fetched_at').eq('report_type','overview').order('fetched_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('v_ga4_reports').select('rows,date_range').eq('report_type','pages').order('fetched_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('v_ga4_reports').select('rows').eq('report_type','sources').order('fetched_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('v_gsc_reports').select('rows,date_range,fetched_at').eq('report_type','queries').order('fetched_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('v_gsc_reports').select('rows').eq('report_type','pages').order('fetched_at',{ascending:false}).limit(1).maybeSingle(),
  ]);

  const ov = ovRes.data?.totals as MetricRow | null;
  const pageRows = (pgRes.data?.rows ?? []) as DimMetricRow[];
  const srcRows  = (srcRes.data?.rows ?? []) as DimMetricRow[];
  const qRows    = (qRes.data?.rows ?? []) as GscRow[];
  const gscPgRows = (gscPgRes.data?.rows ?? []) as GscRow[];

  const kpis = ov ? [
    { label: 'Sessions',    value: fmt(mv(ov, 0)) },
    { label: 'Users',       value: fmt(mv(ov, 1)) },
    { label: 'New Users',   value: fmt(mv(ov, 2)) },
    { label: 'Pageviews',   value: fmt(mv(ov, 3)) },
    { label: 'Engagement',  value: (mv(ov, 4) * 100).toFixed(1) + '%' },
    { label: 'Bounce Rate', value: (mv(ov, 6) * 100).toFixed(1) + '%' },
  ] : [];

  const th = (label: string, right = false) => (
    <th key={label} style={{ padding: '4px 8px', textAlign: right ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: INK_S, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
      {label}
    </th>
  );

  return (
    <DashboardPage title="Marketing · Analytics" subtitle="GA4 + Search Console · thenamkhan.com" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── GA4 ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 8, borderBottom: `1px solid ${HAIR}`, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK }}>GA4 Analytics</span>
            {ovRes.data?.date_range && <span style={{ fontSize: 11, color: INK_S }}>Last {ovRes.data.date_range}</span>}
            {ovRes.data?.fetched_at && <span style={{ fontSize: 10, color: INK_S, marginLeft: 'auto' }}>Updated {new Date(ovRes.data.fetched_at as string).toLocaleDateString()}</span>}
          </div>

          {kpis.length > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 24 }}>
                {kpis.map(k => (
                  <div key={k.label} style={{ border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px', background: '#FFFFFF' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: INK }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: INK_S, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
                  </div>
                ))}
              </div>

              {pageRows.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: INK_S, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Pages</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${HAIR}` }}>{[th('Page'), th('Sessions',true), th('Views',true), th('Engagement',true), th('Avg Duration',true)]}</tr></thead>
                    <tbody>
                      {pageRows.slice(0, 15).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                          <td style={{ padding: '5px 8px', color: INK, fontFamily: 'monospace', fontSize: 11 }}>{row.dimensionValues?.[0]?.value ?? '-'}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(mv(row,0))}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(mv(row,1))}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{(mv(row,2)*100).toFixed(1)}%</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(mv(row,3)/60,1)}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {srcRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: INK_S, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Traffic Sources</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${HAIR}` }}>{[th('Source / Medium'), th('Sessions',true), th('New Users',true), th('Conversions',true)]}</tr></thead>
                    <tbody>
                      {srcRows.slice(0, 10).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                          <td style={{ padding: '5px 8px', color: INK }}>{row.dimensionValues?.[0]?.value} / {row.dimensionValues?.[1]?.value}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(mv(row,0))}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(mv(row,1))}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(mv(row,2))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: INK_S, fontSize: 12, border: `1px dashed ${HAIR}`, borderRadius: 6 }}>
              No GA4 data yet — trigger a pull via{' '}
              <code style={{ fontSize: 11 }}>POST /api/marketing/analytics/ga4 &#123;&ldquo;mode&rdquo;:&ldquo;report&rdquo;&#125;</code>
            </div>
          )}
        </section>

        {/* ── Search Console ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 8, borderBottom: `1px solid ${HAIR}`, marginBottom: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK }}>Search Console</span>
            {qRes.data?.date_range && <span style={{ fontSize: 11, color: INK_S }}>Last {qRes.data.date_range}</span>}
            {qRes.data?.fetched_at && <span style={{ fontSize: 10, color: INK_S, marginLeft: 'auto' }}>Updated {new Date(qRes.data.fetched_at as string).toLocaleDateString()}</span>}
          </div>

          {qRows.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: INK_S, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Queries</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead><tr style={{ borderBottom: `1px solid ${HAIR}` }}>{[th('Query'), th('Clicks',true), th('Impr.',true), th('CTR',true), th('Pos.',true)]}</tr></thead>
                  <tbody>
                    {qRows.slice(0, 20).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                        <td style={{ padding: '5px 8px', color: INK }}>{row.keys?.[0] ?? '-'}</td>
                        <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{row.clicks ?? 0}</td>
                        <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(row.impressions ?? 0)}</td>
                        <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{((row.ctr ?? 0)*100).toFixed(1)}%</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: posColor(row.position ?? 99), fontWeight: (row.position ?? 99) <= 10 ? 600 : 400 }}>
                          #{Math.round(row.position ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {gscPgRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: INK_S, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Top Pages (Search)</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${HAIR}` }}>{[th('Page'), th('Clicks',true), th('Impr.',true), th('CTR',true), th('Pos.',true)]}</tr></thead>
                    <tbody>
                      {gscPgRows.slice(0, 15).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                          <td style={{ padding: '5px 8px', color: INK, fontFamily: 'monospace', fontSize: 10 }}>
                            {(row.keys?.[0] ?? '/').replace('https://www.thenamkhan.com','')}
                          </td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{row.clicks ?? 0}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{fmt(row.impressions ?? 0)}</td>
                          <td style={{ padding: '5px 8px', color: INK, textAlign: 'right' }}>{((row.ctr ?? 0)*100).toFixed(1)}%</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: posColor(row.position ?? 99), fontWeight: (row.position ?? 99) <= 10 ? 600 : 400 }}>
                            #{Math.round(row.position ?? 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: INK_S, fontSize: 12, border: `1px dashed ${HAIR}`, borderRadius: 6 }}>
              No Search Console data yet — add service account to GSC, then trigger{' '}
              <code style={{ fontSize: 11 }}>POST /api/marketing/analytics/gsc</code>
            </div>
          )}
        </section>

      </div>
    </DashboardPage>
  );
}
