// app/marketing/youtube/_server/AnalyticsKPIs.tsx
// PBS 2026-07-13 — Channel Performance dashboard section per PBS target screenshot.
// Renders KPI tiles + Watch Time trend + Subs Gained/Lost + Traffic Sources donut,
// all live from the YouTube Analytics API. Requires yt-analytics.readonly scope
// (already in oauth-start SCOPES). If the scope isn't granted, we render an amber
// "Reconnect for analytics" banner and hide the section.

import Link from 'next/link';
import {
  fetchChannelDaySeries, fetchTrafficSources, fetchDeviceTypes, fetchGeography,
} from '@/lib/youtube/analytics';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const AMBER  = '#B48A3A';
const CREAM  = '#F5F0E1';
const RED    = '#B03826';
const OK     = '#0E7A4B';

const CARD: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 20 };
const SECTION_H: React.CSSProperties = { fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, marginBottom: 12, fontWeight: 500 };

function fmt(n: number): string { return new Intl.NumberFormat('en-US').format(Math.round(n)); }
function fmt1(n: number): string { return n.toFixed(1); }
function hrsFromMinutes(m: number): number { return Math.round(m / 60); }

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 14 }}>
      <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: INK, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Simple inline SVG area chart.
function AreaChart({ series, height = 100, color = FOREST }: { series: number[]; height?: number; color?: string }) {
  if (!series.length) return <div style={{ height, color: INK_M, fontSize: 11, display: 'flex', alignItems: 'center' }}>no data</div>;
  const max = Math.max(1, ...series);
  const w = 100;
  const step = w / Math.max(1, series.length - 1);
  const pts = series.map((v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * (height - 10) - 4).toFixed(2)}`).join(' ');
  const areaD = `M0,${height} L${pts.replace(/ /g, ' L')} L${w},${height} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <path d={areaD} fill={color} opacity="0.15" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

function DualLineChart({ a, b, labelA, labelB, height = 120 }: { a: number[]; b: number[]; labelA: string; labelB: string; height?: number }) {
  const n = Math.max(a.length, b.length);
  if (!n) return <div style={{ height, color: INK_M, fontSize: 11 }}>no data</div>;
  const max = Math.max(1, ...a, ...b);
  const w = 100;
  const step = w / Math.max(1, n - 1);
  const line = (arr: number[]) => arr.map((v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * (height - 10) - 4).toFixed(2)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <polyline points={line(a)} fill="none" stroke={OK} strokeWidth="1.4" />
        <polyline points={line(b)} fill="none" stroke={RED} strokeWidth="1.4" />
      </svg>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: INK_M, marginTop: 4 }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: OK, borderRadius: 4, marginRight: 4 }} />{labelA}</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: RED, borderRadius: 4, marginRight: 4 }} />{labelB}</span>
      </div>
    </div>
  );
}

function Donut({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <div style={{ fontSize: 11, color: INK_M }}>no data</div>;
  let acc = 0;
  const parts = segments.map((s) => {
    const from = (acc / total) * 100;
    acc += s.value;
    const to = (acc / total) * 100;
    return { color: s.color, from, to };
  });
  const gradient = parts.map((p) => `${p.color} ${p.from.toFixed(2)}% ${p.to.toFixed(2)}%`).join(', ');
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{
        width: 100, height: 100, borderRadius: '50%',
        background: `conic-gradient(${gradient})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{ width: 55, height: 55, background: WHITE, borderRadius: '50%' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: INK }}>
            <span style={{ width: 10, height: 10, background: s.color, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
            <span style={{ color: INK_M, fontVariantNumeric: 'tabular-nums' }}>{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TRAFFIC_COLORS: Record<string, string> = {
  YT_SEARCH: '#0E7A4B', SUGGESTED_VIDEO: '#B23A2E', BROWSE: '#084838', EXTERNAL: '#5A5A5A',
  NOTIFICATION: '#B48A3A', PLAYLIST: '#7A5A2E', CHANNEL: '#3A3A3A', RELATED_VIDEO: '#0E7A4B',
  DIRECT: '#084838', UNKNOWN: '#8A8A8A', SHORTS: '#B23A2E', END_SCREEN: '#B48A3A',
};
const DEVICE_COLORS: Record<string, string> = {
  MOBILE: '#0E7A4B', DESKTOP: '#084838', TABLET: '#B48A3A', TV: '#B23A2E', GAME_CONSOLE: '#5A5A5A', UNKNOWN: '#8A8A8A',
};

interface Props {
  accessToken: string;
  totalSubscribers: number;
  totalViews: number;
  totalVideos: number;
}

export default async function AnalyticsKPIs({ accessToken, totalSubscribers, totalViews, totalVideos }: Props) {
  const [series30, traffic28, devices28, geo28] = await Promise.all([
    fetchChannelDaySeries(accessToken, 30),
    fetchTrafficSources(accessToken, 28),
    fetchDeviceTypes(accessToken, 28),
    fetchGeography(accessToken, 28),
  ]);

  if (series30.ok === false) {
    const err = series30.error;
    const detail = series30.detail;
    const scopeMissing = err === 'youtube_analytics_401' || err === 'youtube_analytics_403';
    if (scopeMissing) {
      return (
        <div style={{ ...CARD, gridColumn: '1 / -1', background: '#FDF7E6', borderColor: AMBER }}>
          <div style={{ fontSize: 13, color: AMBER, fontWeight: 600, marginBottom: 6 }}>Analytics not authorised</div>
          <div style={{ fontSize: 12, color: INK_S, marginBottom: 10 }}>
            The YouTube Analytics API needs the <code>yt-analytics.readonly</code> scope. Reconnect to authorise it — no data is lost.
          </div>
          <Link href={`/api/marketing/youtube/oauth-start?property_id=260955`}
            style={{ display: 'inline-block', padding: '8px 14px', border: `1px solid ${FOREST}`, borderRadius: 3, background: FOREST, color: WHITE, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
            Reconnect YouTube
          </Link>
        </div>
      );
    }
    return (
      <div style={{ ...CARD, gridColumn: '1 / -1', background: '#FBE7E4', borderColor: RED }}>
        <div style={{ fontSize: 13, color: RED, fontWeight: 500 }}>
          Analytics fetch failed: {err}{detail ? ` · ${detail.slice(0, 160)}` : ''}
        </div>
      </div>
    );
  }

  const rows = series30.rows;
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const views30 = sum('views');
  const watchMin30 = sum('watchMinutes');
  const likes30 = sum('likes');
  const comments30 = sum('comments');
  const shares30 = sum('shares');
  const gained30 = sum('subsGained');
  const lost30 = sum('subsLost');
  const daysWithData = rows.length || 1;
  const avgViewsPerDay = views30 / daysWithData;

  // Watch Time last 7 days (in minutes)
  const last7 = rows.slice(-7);
  const wt7 = last7.map((r) => Math.round(r.watchMinutes));
  const views7 = last7.map((r) => r.views);

  // Weekly subs gained/lost — last 5 weeks
  const weekly: Array<{ gained: number; lost: number }> = [];
  const weeks = 5;
  const perWeek = Math.ceil(rows.length / weeks);
  for (let i = 0; i < weeks; i++) {
    const slice = rows.slice(i * perWeek, (i + 1) * perWeek);
    weekly.push({
      gained: slice.reduce((s, r) => s + r.subsGained, 0),
      lost: slice.reduce((s, r) => s + r.subsLost, 0),
    });
  }

  const trafficSegs = traffic28.ok === true
    ? traffic28.sources.slice(0, 6).map((t) => ({ label: t.source, value: t.views, color: TRAFFIC_COLORS[t.source] ?? '#5A5A5A' }))
    : [];
  const deviceSegs = devices28.ok === true
    ? devices28.devices.map((d) => ({ label: d.type, value: d.views, color: DEVICE_COLORS[d.type] ?? '#5A5A5A' }))
    : [];
  const topGeo = geo28.ok === true
    ? [...geo28.countries].sort((a, b) => b.views - a.views).slice(0, 5)
    : [];

  // Pre-compute error strings for display (TS narrows here so we can access .error).
  const trafficErr = traffic28.ok === false ? traffic28.error : null;
  const devicesErr = devices28.ok === false ? devices28.error : null;
  const geoErr     = geo28.ok === false ? geo28.error : null;

  return (
    <>
      {/* KPI STRIP */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ ...SECTION_H, marginBottom: 0 }}>Channel performance · last 30 days</div>
          <div style={{ fontSize: 11, color: INK_M }}>YouTube Analytics API</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <KpiTile label="Avg views / day" value={fmt(avgViewsPerDay)} sub={`${fmt(views30)} views · ${daysWithData}d`} />
          <KpiTile label="Total subscribers" value={fmt(totalSubscribers)} />
          <KpiTile label="Total views (all time)" value={fmt(totalViews)} sub={`${fmt(totalVideos)} videos`} />
          <KpiTile label="Watch time" value={`${fmt(hrsFromMinutes(watchMin30))} hrs`} sub={`${fmt(watchMin30)} min in 30d`} />
          <KpiTile label="Subs Δ (30d)" value={`${gained30 - lost30 >= 0 ? '+' : ''}${fmt(gained30 - lost30)}`} sub={`+${fmt(gained30)} · -${fmt(lost30)}`} />
          <KpiTile label="Likes / Comments" value={`${fmt(likes30)} · ${fmt(comments30)}`} sub={`${fmt(shares30)} shares`} />
        </div>
      </div>

      {/* CHARTS ROW */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div>
            <div style={SECTION_H}>Watch time · last 7 days (min)</div>
            <AreaChart series={wt7} height={120} color={FOREST} />
            <div style={{ fontSize: 10, color: INK_M, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              {last7.map((r, i) => <span key={i}>{r.day.slice(5)}</span>)}
            </div>
          </div>
          <div>
            <div style={SECTION_H}>Views · last 7 days</div>
            <AreaChart series={views7} height={120} color="#B48A3A" />
            <div style={{ fontSize: 10, color: INK_M, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              {last7.map((r, i) => <span key={i}>{r.day.slice(5)}</span>)}
            </div>
          </div>
          <div>
            <div style={SECTION_H}>Subs gained vs lost · 5 weeks</div>
            <DualLineChart
              a={weekly.map((w) => w.gained)}
              b={weekly.map((w) => w.lost)}
              labelA="Gained"
              labelB="Lost"
              height={120}
            />
          </div>
        </div>
      </div>

      {/* BREAKDOWNS ROW */}
      <div style={{ ...CARD, gridColumn: '1 / -1' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          <div>
            <div style={SECTION_H}>Traffic sources · last 28 days</div>
            {trafficSegs.length > 0
              ? <Donut segments={trafficSegs} />
              : <div style={{ fontSize: 11, color: INK_M }}>{trafficErr ? `error: ${trafficErr}` : 'no data'}</div>}
          </div>
          <div>
            <div style={SECTION_H}>Views by device · 28 days</div>
            {deviceSegs.length > 0
              ? <Donut segments={deviceSegs} />
              : <div style={{ fontSize: 11, color: INK_M }}>{devicesErr ? `error: ${devicesErr}` : 'no data'}</div>}
          </div>
          <div>
            <div style={SECTION_H}>Top 5 countries · views (28d)</div>
            {topGeo.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topGeo.map((g) => {
                  const max = topGeo[0]?.views || 1;
                  const pct = (g.views / max) * 100;
                  return (
                    <div key={g.code} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: INK }}>
                      <span style={{ width: 30, color: INK_M }}>{g.code}</span>
                      <div style={{ flex: 1, height: 12, background: CREAM, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct.toFixed(1)}%`, height: '100%', background: FOREST }} />
                      </div>
                      <span style={{ width: 50, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK_M }}>{fmt(g.views)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: INK_M }}>{geoErr ? `error: ${geoErr}` : 'no data'}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
