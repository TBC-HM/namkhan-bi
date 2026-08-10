// app/marketing/seo/page.tsx
// Live SERP rank tracker — reads from public.v_seo_rankings (DataForSEO pipeline).
// Fetched daily 06:00 UTC via cron → fetch-serp-rankings edge fn.
import { DashboardPage, Container, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const INK_F='#8A8A8A';
const GREEN='#084838'; const AMBER='#C28F2C'; const RED='#B03826';

interface RankRow {
  keyword_id: number; property_id: number;
  keyword: string; location_name: string;
  snapshot_date: string | null; position: number | null;
  url: string | null; title: string | null;
  last_checked: string | null; prev_position: number | null; delta: number | null;
}

const WORKFLOW = [
  { step: '01', title: 'Research',  desc: 'Keyword clusters, intent groups, seasonal trends and topical authority maps.' },
  { step: '02', title: 'Reason',    desc: 'AI decides if topic has commercial value or is SEO noise.' },
  { step: '03', title: 'Structure', desc: 'Outline, entities, FAQs, internal links, CTA and funnel path.' },
  { step: '04', title: 'Write',     desc: 'Generate multilingual article variants with localized nuance.' },
  { step: '05', title: 'Review',    desc: 'Human and reality agent validate claims, tone and visuals.' },
  { step: '06', title: 'Publish',   desc: 'Push to CMS, sitemap, schema, internal links and social distribution.' },
  { step: '07', title: 'Analyze',   desc: 'Track rankings, CTR, traffic, leads, bookings and decay.' },
  { step: '08', title: 'Refine',    desc: 'AI refreshes weak pages, expands clusters and improves conversion.' },
];

export default async function MarketingSeoPage() {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb.from('v_seo_rankings').select('*');
  const rankings = (rows ?? []) as RankRow[];

  const hasData    = rankings.some(r => r.snapshot_date !== null);
  const withPos    = rankings.filter(r => r.position !== null);
  const top3       = withPos.filter(r => (r.position ?? 99) <= 3);
  const top10      = withPos.filter(r => (r.position ?? 99) <= 10);
  const avgPos     = withPos.length > 0
    ? Math.round(withPos.reduce((s, r) => s + (r.position ?? 0), 0) / withPos.length)
    : null;
  const lastSync   = rankings.reduce((max: string | null, r) => {
    if (!r.last_checked) return max;
    return !max || r.last_checked > max ? r.last_checked : max;
  }, null);

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/seo',
  }));

  const kpis: KpiTileProps[] = [
    { label: 'Keywords tracked', value: rankings.length, size: 'sm', footnote: 'Namkhan · Laos/LP geo' },
    { label: 'In top 3',  value: top3.length,  size: 'sm', status: top3.length > 0 ? 'green' : 'grey',  footnote: hasData ? 'Google desktop' : 'pending first fetch' },
    { label: 'In top 10', value: top10.length, size: 'sm', status: top10.length > 0 ? 'green' : 'grey', footnote: hasData ? 'Google desktop' : 'pending first fetch' },
    { label: 'Avg position', value: avgPos ?? '—', size: 'sm', footnote: hasData ? `${withPos.length} of ${rankings.length} ranked` : 'pending first fetch' },
    { label: 'Outside top 30', value: rankings.length - withPos.length, size: 'sm',
      status: (rankings.length - withPos.length) > 10 ? 'red' : 'grey',
      footnote: hasData ? 'not in top 30' : 'pending first fetch' },
    { label: 'Last synced', value: lastSync ? lastSync.slice(0, 10) : '—', size: 'sm', footnote: 'daily 06:00 UTC' },
  ];

  return (
    <DashboardPage
      title="Marketing · SEO"
      subtitle="SERP rank tracker · DataForSEO · Google organic · Luang Prabang geo"
      tabs={tabs}
    >
      {/* KPI tiles */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 8 }}>
        {kpis.map((t, i) => (
          <div key={i} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.13em', textTransform: 'uppercase' as const, color: INK_F, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: INK, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{String(t.value)}</div>
            {t.footnote && <div style={{ fontSize: 10, color: INK_F, marginTop: 4 }}>{t.footnote}</div>}
          </div>
        ))}
      </div>

      {/* Live ranking table */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Keyword rankings"
          subtitle="thenamkhan.com · Google · desktop · position blank = outside top 30"
          action={hasData
            ? <span style={{ fontSize: 11, color: INK_F, fontFamily: 'ui-monospace, monospace' }}>{withPos.length} ranked · {rankings.length - withPos.length} outside top 30</span>
            : <span style={{ fontSize: 11, color: AMBER, fontFamily: 'ui-monospace, monospace' }}>awaiting first fetch</span>
          }
        >
          {!hasData ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📡</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>First fetch pending</div>
              <div style={{ fontSize: 12, color: INK_M, marginBottom: 4 }}>Cron runs daily at 06:00 UTC via <code>fetch-serp-rankings</code> edge function</div>
              <div style={{ fontSize: 11, color: INK_F }}>25 keywords · DataForSEO SERP API · location_code 2418 (Laos)</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid ' + HAIR }}>
                    {['Pos', 'Δ', 'Keyword', 'Location', 'Ranked URL', 'Checked'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: INK_F, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rankings.map(r => {
                    const pos  = r.position;
                    const pc   = pos === null ? INK_F : pos <= 3 ? GREEN : pos <= 10 ? AMBER : INK_M;
                    const d    = r.delta;
                    const ds   = d === null ? '—' : d > 0 ? `↑${d}` : d < 0 ? `↓${Math.abs(d)}` : '→';
                    const dc   = d === null ? INK_F : d > 0 ? GREEN : d < 0 ? RED : INK_M;
                    return (
                      <tr key={r.keyword_id} style={{ borderBottom: '1px solid ' + HAIR }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: pc, fontSize: 15, whiteSpace: 'nowrap' as const }}>{pos ?? '—'}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'ui-monospace, monospace', color: dc, fontSize: 11, whiteSpace: 'nowrap' as const }}>{ds}</td>
                        <td style={{ padding: '7px 10px', color: INK, fontStyle: 'italic' }}>{r.keyword}</td>
                        <td style={{ padding: '7px 10px', color: INK_F, fontSize: 11, whiteSpace: 'nowrap' as const }}>{r.location_name}</td>
                        <td style={{ padding: '7px 10px', maxWidth: 240 }}>
                          {r.url
                            ? <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.title ?? undefined}
                                style={{ color: GREEN, fontSize: 11, textDecoration: 'none', fontFamily: 'ui-monospace, monospace' }}>
                                {r.url.replace('https://', '').slice(0, 48)}{r.url.length > 55 ? '…' : ''}
                              </a>
                            : <span style={{ color: INK_F, fontSize: 11 }}>not in top 30</span>
                          }
                        </td>
                        <td style={{ padding: '7px 10px', color: INK_F, fontSize: 11, whiteSpace: 'nowrap' as const }}>{r.last_checked ? r.last_checked.slice(0, 10) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Container>
      </div>

      {/* AI production workflow strip */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: INK_F, marginBottom: 8, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.13em', textTransform: 'uppercase' as const }}>AI production loop</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 8 }}>
          {WORKFLOW.map(s => (
            <div key={s.step} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '0.16em', color: GREEN }}>{s.step}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{s.title}</div>
              <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardPage>
  );
}
