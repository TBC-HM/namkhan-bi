// app/revenue/markets/page.tsx
// PBS 2026-06-01 #97 — Country / market dimension page for tactical rev-mgmt.
// 5 sections: (1) Top 8 country KPI tiles · (2) Country × stay-month heatmap-table ·
// (3) Country × room-type heatmap-table · (4) Country × LOS distribution · (5) Country × lead-time distribution.
// All views read from pms.v_reservations (silver, both PMSs, guest_country_iso2 normalized).

import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { supabase, PROPERTY_ID } from '@/lib/supabase';
import { REVENUE_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PROPERTY_ID_DONNA = 1000001;

interface Props { propertyId?: number }

// Minimal ISO2 → display label
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

// Heatmap intensity → cell background. Maps 0..max → cream → forest.
function heatColor(v: number, max: number): string {
  if (!max || v <= 0) return 'transparent';
  const t = Math.min(1, v / max);
  // Gradient from var(--bg) F4EFE2 to var(--primary) 1F3A2E
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  const r = lerp(244, 31);
  const g = lerp(239, 58);
  const b = lerp(226, 46);
  return `rgb(${r}, ${g}, ${b})`;
}
function heatTextColor(v: number, max: number): string {
  return max && v / max > 0.55 ? '#FFFFFF' : 'var(--ink, #1B1B1B)';
}

const thStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', background: 'var(--bg, #F4EFE2)', fontWeight: 700, whiteSpace: 'nowrap' };
const tdNum: React.CSSProperties = { padding: '6px 8px', fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderRight: '1px solid var(--hairline, #E6DFCC)' };
const tdLabel: React.CSSProperties = { padding: '6px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--paper, #FFFFFF)', zIndex: 1, borderRight: '1px solid var(--hairline, #E6DFCC)' };

export default async function MarketsPage({ propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const sym  = pid === PROPERTY_ID_DONNA ? '€' : '$';
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/markets'),
  }));

  type Rows = Array<Record<string, unknown>>;

  const [summary, stayMonth, roomType, losDist, leadDist] = await Promise.all([
    supabase.from('v_country_market_summary')
      .select('guest_country_iso2, bookings, room_nights, revenue, adr, avg_los, avg_lead_days, top_channel, top_source')
      .eq('property_id', pid)
      .order('revenue', { ascending: false })
      .limit(40)
      .then((r) => r.data ?? []),
    supabase.from('v_country_stay_month_heatmap')
      .select('guest_country_iso2, stay_month, bookings, room_nights, revenue, adr, avg_los')
      .eq('property_id', pid)
      .then((r) => r.data ?? []),
    supabase.from('v_country_room_type_heatmap')
      .select('guest_country_iso2, room_type_name, bookings, room_nights, revenue, adr')
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

  // Top 8 countries by YTD revenue → KPI strip
  const top8 = (summary as Rows).slice(0, 8);
  const moneyFmt = (n: number) => `${sym}${Math.round(n).toLocaleString('en-US')}`;
  const strip: KpiTileProps[] = top8.map((r) => {
    const iso = String(r.guest_country_iso2 ?? '');
    return {
      label: countryLabel(iso),
      value: moneyFmt(Number(r.revenue ?? 0)),
      size: 'sm',
      footnote: `${Number(r.room_nights ?? 0)} RN · ADR ${moneyFmt(Number(r.adr ?? 0))} · LOS ${Number(r.avg_los ?? 0).toFixed(1)} · lead ${Number(r.avg_lead_days ?? 0)}d · ${String(r.top_channel ?? '—')}`,
    };
  });

  // Country × stay-month heatmap — rows = top 12 countries by lifetime revenue, cols = next 12 months
  const top12 = (summary as Rows).slice(0, 12).map((r) => String(r.guest_country_iso2));
  const monthsSet = new Set<string>();
  (stayMonth as Rows).forEach((r) => monthsSet.add(String(r.stay_month)));
  const monthsArr = Array.from(monthsSet).sort();
  type StayCell = { rn: number; rev: number; adr: number };
  const stayMap = new Map<string, StayCell>();
  (stayMonth as Rows).forEach((r) => {
    const k = `${r.guest_country_iso2}|${r.stay_month}`;
    stayMap.set(k, {
      rn:  Number(r.room_nights ?? 0),
      rev: Number(r.revenue ?? 0),
      adr: Number(r.adr ?? 0),
    });
  });
  const maxStayRn = Math.max(0, ...Array.from(stayMap.values()).map((c) => c.rn));

  // Country × room-type heatmap
  const roomTypesSet = new Set<string>();
  (roomType as Rows).forEach((r) => roomTypesSet.add(String(r.room_type_name)));
  const roomTypesArr = Array.from(roomTypesSet).sort();
  type RtCell = { rn: number; rev: number; adr: number };
  const rtMap = new Map<string, RtCell>();
  (roomType as Rows).forEach((r) => {
    const k = `${r.guest_country_iso2}|${r.room_type_name}`;
    rtMap.set(k, {
      rn:  Number(r.room_nights ?? 0),
      rev: Number(r.revenue ?? 0),
      adr: Number(r.adr ?? 0),
    });
  });
  const maxRtRn = Math.max(0, ...Array.from(rtMap.values()).map((c) => c.rn));

  // LOS distribution — top 8 countries × 5 buckets
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
      {/* KPI strip — top 8 countries */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, strip.length)}, minmax(0, 1fr))`, gap: 8, marginBottom: 12 }}>
        {strip.map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Section 1 — Country × Stay-month heatmap */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Country × stay-month · room-night intensity (next 12 months)"
                   subtitle="Heat = RN volume · darker green = more · cell shows ADR · use to spot demand pockets per origin segment">
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
                  <tr key={iso} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                    <td style={tdLabel}>{countryLabel(iso)}</td>
                    {monthsArr.map((m) => {
                      const c = stayMap.get(`${iso}|${m}`);
                      const rn = c?.rn ?? 0;
                      return (
                        <td key={m} style={{ ...tdNum, background: heatColor(rn, maxStayRn), color: heatTextColor(rn, maxStayRn) }}
                            title={c ? `${rn} RN · ${moneyFmt(c.rev)} · ADR ${moneyFmt(c.adr)}` : 'no bookings'}>
                          {rn > 0 ? rn : ''}
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

      {/* Section 2 — Country × Room-type heatmap */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Country × room-type · room-night intensity (YTD)"
                   subtitle="Which countries gravitate to which inventory · darker = more · hover for revenue + ADR">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Country</th>
                  {roomTypesArr.map((rt) => <th key={rt} style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>{rt}</th>)}
                </tr>
              </thead>
              <tbody>
                {top12.map((iso) => (
                  <tr key={iso} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
                    <td style={tdLabel}>{countryLabel(iso)}</td>
                    {roomTypesArr.map((rt) => {
                      const c = rtMap.get(`${iso}|${rt}`);
                      const rn = c?.rn ?? 0;
                      return (
                        <td key={rt} style={{ ...tdNum, background: heatColor(rn, maxRtRn), color: heatTextColor(rn, maxRtRn) }}
                            title={c ? `${rn} RN · ${moneyFmt(c.rev)} · ADR ${moneyFmt(c.adr)}` : 'no bookings'}>
                          {rn > 0 ? rn : ''}
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

      {/* Section 3 + 4 side-by-side */}
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
                  <tr key={iso} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
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
                  <tr key={iso} style={{ borderTop: '1px solid var(--hairline, #E6DFCC)' }}>
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
