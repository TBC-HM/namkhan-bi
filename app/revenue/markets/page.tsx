// app/revenue/markets/page.tsx
// PBS 2026-05-29 #98 — Country / market dimension.
// Sections: (1) Top 8 country KPI tiles WITH SDLY YoY · (2) Revenue share donut ·
// (3) TY vs LY paired bars · (4) Lead-time stacked bar · (5) Stay-month heatmap ·
// (6) Room-type heatmap · (7) LOS distribution · (8) Lead-time table.
// All aggregation in gold layer (v_country_* views) — page is thin mapping only.

import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type KpiTileProps, type ChartSeries,
} from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PROPERTY_ID_DONNA = 1000001;

interface Props { propertyId?: number }

const COUNTRY_NAMES: Record<string, string> = {
  US: 'USA', GB: 'UK', DE: 'Germany', FR: 'France', IT: 'Italy', ES: 'Spain',
  CH: 'Switzerland', AT: 'Austria', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', BE: 'Belgium', LU: 'Luxembourg', PL: 'Poland', IE: 'Ireland',
  CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', SG: 'Singapore', JP: 'Japan',
  CN: 'China', KR: 'South Korea', TH: 'Thailand', LA: 'Laos', VN: 'Vietnam',
  IN: 'India', MY: 'Malaysia', PH: 'Philippines', ID: 'Indonesia', HK: 'Hong Kong',
  AE: 'UAE', SA: 'Saudi Arabia', IL: 'Israel', BR: 'Brazil', MX: 'Mexico',
  AR: 'Argentina', CL: 'Chile', ZA: 'South Africa', RU: 'Russia', UA: 'Ukraine',
};
function countryLabel(iso2: string): string { return COUNTRY_NAMES[iso2] ?? iso2; }

function heatColor(v: number, max: number): string {
  if (!max || v <= 0) return 'transparent';
  const t = Math.min(1, v / max);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${lerp(244, 31)}, ${lerp(239, 58)}, ${lerp(226, 46)})`;
}
function heatTextColor(v: number, max: number): string {
  return max && v / max > 0.55 ? '#FFFFFF' : 'var(--ink, #1B1B1B)';
}

const thStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: '#000', background: '#FFFFFF', borderBottom: '2px solid #000', fontWeight: 700, whiteSpace: 'nowrap' };
const tdNum: React.CSSProperties = { padding: '6px 8px', fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderRight: '1px solid #E0E0E0' };
const tdLabel: React.CSSProperties = { padding: '6px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--paper, #FFFFFF)', zIndex: 1, borderRight: '1px solid #E0E0E0' };

const LEAD_BUCKETS_ORDERED = ['0-7d', '8-30d', '31-60d', '61-120d', '120d+'] as const;
const LEAD_COLORS: Record<typeof LEAD_BUCKETS_ORDERED[number], string> = {
  '0-7d':    '#C62828',
  '8-30d':   '#EF6C00',
  '31-60d':  '#F9A825',
  '61-120d': '#558B2F',
  '120d+':   '#1F3A2E',
};

export default async function MarketsPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sym  = pid === PROPERTY_ID_DONNA ? '€' : '$';
  const curYear = new Date().getUTCFullYear();
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/markets'),
  }));

  type Rows = Array<Record<string, unknown>>;

  const [summary, revShare, tyVsLy, leadStack, stayMonth, roomType, losDist, leadDist] = await Promise.all([
    supabase.from('v_country_market_summary')
      .select('guest_country_iso2, bookings, room_nights, revenue, adr, avg_los, avg_lead_days, ly_revenue, ly12_revenue, revenue_yoy_pct, rn_yoy_pct, top_channel, top_source')
      .eq('property_id', pid)
      .order('revenue', { ascending: false })
      .limit(40)
      .then((r) => r.data ?? []),
    supabase.from('v_country_revenue_share')
      .select('label, revenue, pct_of_total')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_ty_vs_ly')
      .select('label, ty_revenue, ly_revenue')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_lead_stack')
      .select('label, lead_bucket, bookings, pct')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_stay_month_heatmap')
      .select('guest_country_iso2, stay_month, bookings, room_nights, revenue, adr, avg_los, ly_room_nights, ly_revenue, ly_adr')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_room_type_heatmap')
      .select('guest_country_iso2, room_type_name, bookings, room_nights, revenue, adr, ly_bookings, ly_room_nights, ly_revenue, ly_adr')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_los_distribution')
      .select('guest_country_iso2, los_bucket, bookings, room_nights, revenue')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_lead_time_distribution')
      .select('guest_country_iso2, lead_bucket, bookings, room_nights, revenue')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
  ]);

  const moneyFmt = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;

  // ── KPI strip — top 8 countries with SDLY delta ─────────────────────────
  const top8 = (summary as Rows).slice(0, 8);
  const strip: KpiTileProps[] = top8.map((r) => {
    const iso = String(r.guest_country_iso2 ?? '');
    const yoy = Number(r.revenue_yoy_pct ?? 0);
    return {
      label: countryLabel(iso),
      value: moneyFmt(Number(r.revenue ?? 0)),
      size: 'sm',
      delta: {
        value: yoy,
        period: 'vs LY same window',
        direction: yoy > 0.5 ? 'up' : yoy < -0.5 ? 'down' : 'flat',
        isGoodWhenUp: true,
      },
      footnote: `${Number(r.room_nights ?? 0)} RN · LY ${curYear - 1} (full) ${moneyFmt(Number(r.ly12_revenue ?? 0))} · ADR ${moneyFmt(Number(r.adr ?? 0))} · LOS ${Number(r.avg_los ?? 0).toFixed(1)} · lead ${Number(r.avg_lead_days ?? 0)}d`,
    };
  });

  // ── Revenue share donut ─────────────────────────────────────────────────
  const revShareData = (revShare as Rows).map((r) => ({
    label: String(r.label),
    revenue: Number(r.revenue ?? 0),
    pct_of_total: Number(r.pct_of_total ?? 0),
  })) as unknown as Record<string, unknown>[];

  // ── TY vs LY paired bars (top 10) ───────────────────────────────────────
  const tyLyData = (tyVsLy as Rows).slice(0, 10).map((r) => ({
    label: countryLabel(String(r.label)),
    ty_revenue: Number(r.ty_revenue ?? 0),
    ly_revenue: Number(r.ly_revenue ?? 0),
  })) as unknown as Record<string, unknown>[];
  const tyLySeries: ChartSeries[] = [
    { key: 'ty_revenue', label: `${curYear} YTD`, color: '#1F3A2E' },
    { key: 'ly_revenue', label: `${curYear - 1} same window`, color: '#B3A78A' },
  ];

  // ── Lead-time stacked (pivot long→wide) ─────────────────────────────────
  type LeadWide = { label: string; total: number } & Record<string, string | number>;
  const leadWide = new Map<string, LeadWide>();
  (leadStack as Rows).forEach((r) => {
    const lbl = String(r.label);
    if (!leadWide.has(lbl)) {
      leadWide.set(lbl, { label: countryLabel(lbl), total: 0,
        '0-7d': 0, '8-30d': 0, '31-60d': 0, '61-120d': 0, '120d+': 0,
      });
    }
    const w = leadWide.get(lbl)!;
    const bkt = String(r.lead_bucket);
    w[bkt] = Number(r.pct ?? 0);
    w.total += Number(r.bookings ?? 0);
  });
  const leadStackData = Array.from(leadWide.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10) as unknown as Record<string, unknown>[];
  const leadStackSeries: ChartSeries[] = LEAD_BUCKETS_ORDERED.map((b) => ({
    key: b, label: b, color: LEAD_COLORS[b],
  }));

  // ── Stay-month heatmap (rows=top 12, cols=months) ───────────────────────
  const top12 = (summary as Rows).slice(0, 12).map((r) => String(r.guest_country_iso2));
  const monthsSet = new Set<string>();
  (stayMonth as Rows).forEach((r) => monthsSet.add(String(r.stay_month)));
  const monthsArr = Array.from(monthsSet).sort();
  type StayCell = { rn: number; rev: number; adr: number; ly_rn: number; ly_rev: number; ly_adr: number };
  const stayMap = new Map<string, StayCell>();
  (stayMonth as Rows).forEach((r) => {
    stayMap.set(`${r.guest_country_iso2}|${r.stay_month}`, {
      rn:     Number(r.room_nights ?? 0),
      rev:    Number(r.revenue ?? 0),
      adr:    Number(r.adr ?? 0),
      ly_rn:  Number(r.ly_room_nights ?? 0),
      ly_rev: Number(r.ly_revenue ?? 0),
      ly_adr: Number(r.ly_adr ?? 0),
    });
  });
  const maxStayRn = Math.max(0, ...Array.from(stayMap.values()).map((c) => c.rn));

  // ── Room-type heatmap ───────────────────────────────────────────────────
  const roomTypesSet = new Set<string>();
  (roomType as Rows).forEach((r) => roomTypesSet.add(String(r.room_type_name)));
  const roomTypesArr = Array.from(roomTypesSet).sort();
  type RtCell = { rn: number; rev: number; adr: number; ly_rn: number };
  const rtMap = new Map<string, RtCell>();
  (roomType as Rows).forEach((r) => {
    rtMap.set(`${r.guest_country_iso2}|${r.room_type_name}`, {
      rn:  Number(r.room_nights ?? 0),
      rev: Number(r.revenue ?? 0),
      adr: Number(r.adr ?? 0),
      ly_rn: Number(r.ly_room_nights ?? 0),
    });
  });
  const maxRtRn = Math.max(0, ...Array.from(rtMap.values()).map((c) => c.rn));

  // ── LOS + lead tables ───────────────────────────────────────────────────
  const LOS_BUCKETS = ['1-2 nights','3-5 nights','6-7 nights','8-14 nights','15+ nights'];
  type LosCell = { bookings: number; rn: number };
  const losMap = new Map<string, LosCell>();
  (losDist as Rows).forEach((r) => {
    losMap.set(`${r.guest_country_iso2}|${r.los_bucket}`, {
      bookings: Number(r.bookings ?? 0),
      rn:       Number(r.room_nights ?? 0),
    });
  });

  const LEAD_BUCKETS = ['0-7d','8-30d','31-60d','61-120d','120d+'];
  type LeadCell = { bookings: number };
  const leadMap = new Map<string, LeadCell>();
  (leadDist as Rows).forEach((r) => {
    leadMap.set(`${r.guest_country_iso2}|${r.lead_bucket}`, { bookings: Number(r.bookings ?? 0) });
  });

  return (
    <DashboardPage
      title="Revenue · Markets"
      subtitle={`Origin-country dimension · top 40 countries · ${(summary as Rows).length} active · YTD ${new Date().getUTCFullYear()}`}
      tabs={tabs}
    >
      {/* KPI strip — top 8 with SDLY delta */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, strip.length)}, minmax(0, 1fr))`, gap: 8, marginBottom: 12 }}>
        {strip.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Three graphs row */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <Container title="Revenue share · top 10 + Other (YTD)"
                   subtitle="Where the money came from this year">
          <Chart variant="donut"
                 data={revShareData}
                 xKey="label"
                 yKey="revenue"
                 height={260}
                 legend="right"
                 empty={{ title: 'No revenue this YTD' }}/>
        </Container>

        <Container title={`${curYear} YTD vs ${curYear - 1} same window · top 10`}
                   subtitle={`Paired bars · LY = same calendar window 1 year ago · ${sym}`}>
          <Chart variant="bar"
                 data={tyLyData}
                 xKey="label"
                 series={tyLySeries}
                 height={260}
                 legend="top"
                 empty={{ title: 'No LY comparison data' }}/>
        </Container>

        <Container title="Booking-window mix · top 10 countries"
                   subtitle="Stacked % per origin · long lead = early-bird friendly">
          <Chart variant="stacked_bar"
                 data={leadStackData}
                 xKey="label"
                 series={leadStackSeries}
                 height={260}
                 legend="top"
                 empty={{ title: 'No lead-time data' }}/>
        </Container>
      </div>

      {/* Section — Country × Stay-month heatmap */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Country × stay-month · room-night intensity (next 12 months)"
                   subtitle="Heat = TY RN intensity · darker green = more · each cell shows TY (bold) + LY same-month · hover for revenue + ADR breakdown">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Country</th>
                  {monthsArr.map((m) => <th key={m} style={{ ...thStyle, textAlign: 'right' }}>{m.slice(5)}/{m.slice(2, 4)}</th>)}
                </tr>
              </thead>
              <tbody>
                {top12.map((iso) => (
                  <tr key={iso} style={{ borderTop: '1px solid #E0E0E0' }}>
                    <td style={tdLabel}>{countryLabel(iso)}</td>
                    {monthsArr.map((m) => {
                      const c = stayMap.get(`${iso}|${m}`);
                      const rn = c?.rn ?? 0;
                      const ly = c?.ly_rn ?? 0;
                      // PBS 2026-07-09 pm: green when TY > LY, red when TY < LY, grey when both 0
                      const tyColor = rn === 0 && ly === 0 ? '#5A5A5A'
                                    : rn > ly ? '#1F5C2C' : rn < ly ? '#B04A2F' : '#1B1B1B';
                      return (
                        <td key={m} style={{ ...tdNum, background: heatColor(rn, maxStayRn), color: heatTextColor(rn, maxStayRn), padding: '4px 6px' }}
                            title={c ? `${rn} RN this year · ${ly} RN LY · ${moneyFmt(c.rev)} · ADR ${moneyFmt(c.adr)}` : 'no bookings'}>
                          {(rn > 0 || ly > 0) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, gap: 1 }}>
                              <span style={{ fontWeight: 700, color: tyColor }}>{rn > 0 ? rn : '—'}</span>
                              <span style={{ fontSize: 9, opacity: 0.7 }}>LY {ly > 0 ? ly : '—'}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      {/* Section — Country × Room-type heatmap · with LY numbers + TY/LY color coding */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Country × room-type · room-night intensity (YTD)"
                   subtitle="TY vs LY per cell · green = ahead of LY · red = behind · hover for revenue + ADR">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Country</th>
                  {roomTypesArr.map((rt) => <th key={rt} style={{ ...thStyle, textAlign: 'right', minWidth: 90 }}>{rt}</th>)}
                </tr>
              </thead>
              <tbody>
                {top12.map((iso) => (
                  <tr key={iso} style={{ borderTop: '1px solid #E0E0E0' }}>
                    <td style={tdLabel}>{countryLabel(iso)}</td>
                    {roomTypesArr.map((rt) => {
                      const c = rtMap.get(`${iso}|${rt}`);
                      const rn = c?.rn ?? 0;
                      const ly = c?.ly_rn ?? 0;
                      const tyColor = rn === 0 && ly === 0 ? '#5A5A5A'
                                    : rn > ly ? '#1F5C2C' : rn < ly ? '#B04A2F' : '#1B1B1B';
                      return (
                        <td key={rt} style={{ ...tdNum, background: heatColor(rn, maxRtRn), color: heatTextColor(rn, maxRtRn), padding: '4px 6px' }}
                            title={c ? `${rn} RN this year · ${ly} RN LY · ${moneyFmt(c.rev)} · ADR ${moneyFmt(c.adr)}` : 'no bookings'}>
                          {(rn > 0 || ly > 0) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1, gap: 1 }}>
                              <span style={{ fontWeight: 700, color: tyColor }}>{rn > 0 ? rn : '—'}</span>
                              <span style={{ fontSize: 9, opacity: 0.7 }}>LY {ly > 0 ? ly : '—'}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>

      {/* Section — LOS + lead-time tables */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12 }}>
        <Container title="Country × LOS distribution" subtitle="Per-country booking count by length-of-stay bucket">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Country</th>
                  {LOS_BUCKETS.map((b) => <th key={b} style={{ ...thStyle, textAlign: 'right' }}>{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {top12.map((iso) => (
                  <tr key={iso} style={{ borderTop: '1px solid #E0E0E0' }}>
                    <td style={tdLabel}>{countryLabel(iso)}</td>
                    {LOS_BUCKETS.map((b) => {
                      const c = losMap.get(`${iso}|${b}`);
                      return <td key={b} style={tdNum}>{c?.bookings ?? ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
        <Container title="Country × lead-time distribution" subtitle="Booking-window buckets per origin · long lead = early-bird friendly">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Country</th>
                  {LEAD_BUCKETS.map((b) => <th key={b} style={{ ...thStyle, textAlign: 'right' }}>{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {top12.map((iso) => (
                  <tr key={iso} style={{ borderTop: '1px solid #E0E0E0' }}>
                    <td style={tdLabel}>{countryLabel(iso)}</td>
                    {LEAD_BUCKETS.map((b) => {
                      const c = leadMap.get(`${iso}|${b}`);
                      return <td key={b} style={tdNum}>{c?.bookings ?? ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
