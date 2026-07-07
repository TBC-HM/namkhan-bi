// app/revenue/pickup-day/page.tsx
// PBS 2026-07-07: "Day report" — day-by-day forward outlook + pickup deltas.
// Mirrors PBS's Excel day report (grouped-header layout). This is a first cut:
// wired columns pull real data; the rest are placeholders until each source lands
// (visibility flags, min-stay/stop-sales per channel, rate ladder from Cloudbeds
// availability API, city occ %, house uses).

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { PROPERTY_ID } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PaceRow {
  stay_date: string;      // YYYY-MM-DD
  year: number;
  month: number;
  iso_dow: number;
  rooms_available: number;
  otb_rooms_sold: number;
  otb_revenue: number;
  otb_occupancy_pct: number;
  otb_adr: number;
  otb_revpar: number;
}

interface Snap {
  target_stay_date: string;
  otb_rooms_sold: number;
  otb_revenue: number;
}

interface PickupDelta { rn: number; rev: number; adr: number }

async function fetchData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const todayIso = new Date().toISOString().slice(0, 10);
  const in120 = new Date(Date.now() + 120 * 86400_000).toISOString().slice(0, 10);
  const d1Iso = new Date(Date.now() - 1 * 86400_000).toISOString().slice(0, 10);
  const d7Iso = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const [pace, snap1, snap7] = await Promise.all([
    sb.schema('kpi').from('v_pace_otb_daily')
      .select('stay_date, year, month, iso_dow, rooms_available, otb_rooms_sold, otb_revenue, otb_occupancy_pct, otb_adr, otb_revpar')
      .eq('property_id', propertyId)
      .gte('stay_date', todayIso).lte('stay_date', in120)
      .order('stay_date'),
    sb.schema('kpi').from('historical_pace_snapshots')
      .select('target_stay_date, otb_rooms_sold, otb_revenue')
      .eq('property_id', propertyId)
      .eq('snapshot_date', d1Iso),
    sb.schema('kpi').from('historical_pace_snapshots')
      .select('target_stay_date, otb_rooms_sold, otb_revenue')
      .eq('property_id', propertyId)
      .eq('snapshot_date', d7Iso),
  ]);

  return {
    pace: (pace.data ?? []) as PaceRow[],
    snap1: (snap1.data ?? []) as Snap[],
    snap7: (snap7.data ?? []) as Snap[],
  };
}

function delta(cur: PaceRow, prev: Snap | undefined): PickupDelta {
  if (!prev) return { rn: 0, rev: 0, adr: 0 };
  const rn = Number(cur.otb_rooms_sold ?? 0) - Number(prev.otb_rooms_sold ?? 0);
  const rev = Number(cur.otb_revenue ?? 0) - Number(prev.otb_revenue ?? 0);
  const adr = rn !== 0 ? rev / rn : 0;
  return { rn, rev, adr };
}

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function fmtDate(iso: string) {
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtInt(n: number | null | undefined) {
  return n == null ? '' : Math.round(n).toLocaleString('en-US');
}
function fmtMoney(n: number | null | undefined) {
  return n == null ? '' : `${Math.round(n).toLocaleString('en-US')} €`;
}
function fmtPct(n: number | null | undefined) {
  return n == null ? '' : `${Math.round(n)}%`;
}

export default async function PickupDayReport() {
  const pid = PROPERTY_ID;
  const { pace, snap1, snap7 } = await fetchData(pid);

  const snap1Map = new Map(snap1.map(s => [s.target_stay_date, s]));
  const snap7Map = new Map(snap7.map(s => [s.target_stay_date, s]));

  // Group rows by year+month for monthly totals
  const byMonth = new Map<string, PaceRow[]>();
  for (const r of pace) {
    const key = `${r.year}-${String(r.month).padStart(2,'0')}`;
    const arr = byMonth.get(key) ?? [];
    arr.push(r);
    byMonth.set(key, arr);
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title="Pickup · Day report"
        subtitle="One row per night · OTB + pickup deltas −1d and −7d · monthly totals · money EUR from source"
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <Container
            title={`Day report · ${new Date(todayIso).toLocaleDateString('en-GB')} · Namkhan property ${pid}`}
            subtitle={`${pace.length} forward nights · placeholders (—) for columns still to be wired (visibility flags · min-stay/stop-sales per channel · rate ladder · city occ · house uses)`}
          >
            <div style={{ overflowX: 'auto', border: '1px solid #E6DFCC', borderRadius: 6 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 10, whiteSpace: 'nowrap' }}>
                <thead>
                  {/* Header row 1: group labels */}
                  <tr style={{ background: '#0B3B2E', color: '#FFFFFF' }}>
                    <th style={th} colSpan={2}>Date</th>
                    <th style={th}>Events</th>
                    <th style={th} colSpan={6}>Availability</th>
                    <th style={th} colSpan={2}>Min stay</th>
                    <th style={th} colSpan={4}>Stop sales</th>
                    <th style={th} colSpan={4}>Visibility</th>
                    <th style={th} colSpan={2}>Rate ladder (BAR + NET)</th>
                    <th style={th} colSpan={4}>Fenced rates</th>
                    <th style={th} colSpan={3}>Discounts</th>
                    <th style={th} colSpan={2}>OTB</th>
                    <th style={th} colSpan={3}>Pickup −1d</th>
                    <th style={th} colSpan={3}>Pickup −7d</th>
                  </tr>
                  {/* Header row 2: leaf labels */}
                  <tr style={{ background: '#0F5B4B', color: '#FFFFFF' }}>
                    <th style={th}>DoW</th>
                    <th style={th}>Date</th>
                    <th style={th}></th>
                    <th style={th}>City %</th>
                    <th style={th}>OTB %</th>
                    <th style={th}>OCC</th>
                    <th style={th}>OOO</th>
                    <th style={th}>House uses</th>
                    <th style={th}>Available</th>
                    <th style={th}>WEB</th>
                    <th style={th}>OTAs</th>
                    <th style={th}>WEB</th>
                    <th style={th}>OTAs</th>
                    <th style={th}>B2B</th>
                    <th style={th}>FIT</th>
                    <th style={th}>Mob B&E</th>
                    <th style={th}>EXP Accel</th>
                    <th style={th}>G+Mob</th>
                    <th style={th}>P+ BAR</th>
                    <th style={th}>BAR</th>
                    <th style={th}>Net rate</th>
                    <th style={th}>NRF</th>
                    <th style={th}>EB 30d</th>
                    <th style={th}>LOS3</th>
                    <th style={th}>LOS4</th>
                    <th style={th}>15%</th>
                    <th style={th}>20%</th>
                    <th style={th}>25%</th>
                    <th style={th}>ADR</th>
                    <th style={th}>Room rev</th>
                    <th style={th}>RN</th>
                    <th style={th}>Rev</th>
                    <th style={th}>ADR</th>
                    <th style={th}>RN</th>
                    <th style={th}>Rev</th>
                    <th style={th}>ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(byMonth.entries()).flatMap(([monthKey, rows]) => {
                    const totOcc = rows.reduce((s, r) => s + Number(r.otb_rooms_sold), 0);
                    const totRev = rows.reduce((s, r) => s + Number(r.otb_revenue), 0);
                    const totAvail = rows.reduce((s, r) => s + Math.max(0, Number(r.rooms_available) - Number(r.otb_rooms_sold)), 0);
                    const capSum = rows.reduce((s, r) => s + Number(r.rooms_available), 0);
                    const avgOtbPct = capSum > 0 ? (totOcc / capSum) * 100 : 0;
                    const avgAdr = totOcc > 0 ? totRev / totOcc : 0;
                    const p1sum = rows.reduce((s, r) => s + delta(r, snap1Map.get(r.stay_date)).rn, 0);
                    const p1rev = rows.reduce((s, r) => s + delta(r, snap1Map.get(r.stay_date)).rev, 0);
                    const p7sum = rows.reduce((s, r) => s + delta(r, snap7Map.get(r.stay_date)).rn, 0);
                    const p7rev = rows.reduce((s, r) => s + delta(r, snap7Map.get(r.stay_date)).rev, 0);
                    const [y,m] = monthKey.split('-');
                    const monthLabel = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                    return [
                      ...rows.map((r) => {
                        const p1 = delta(r, snap1Map.get(r.stay_date));
                        const p7 = delta(r, snap7Map.get(r.stay_date));
                        const dow = DOW[(r.iso_dow - 1 + 7) % 7];
                        const isWeekend = r.iso_dow === 6 || r.iso_dow === 7;
                        const zebra = isWeekend ? '#FBF6E8' : '#FFFFFF';
                        return (
                          <tr key={r.stay_date} style={{ background: zebra }}>
                            <td style={{ ...td, fontWeight: 600 }}>{dow}</td>
                            <td style={td}>{fmtDate(r.stay_date)}</td>
                            <td style={td}></td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, fontWeight: 600 }}>{fmtPct(r.otb_occupancy_pct)}</td>
                            <td style={td}>{fmtInt(r.otb_rooms_sold)}</td>
                            <td style={td}>0</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={td}>{fmtInt(Math.max(0, r.rooms_available - r.otb_rooms_sold))}</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={{ ...td, ...tdMuted }}>—</td>
                            <td style={td}>{fmtMoney(r.otb_adr)}</td>
                            <td style={td}>{fmtMoney(r.otb_revenue)}</td>
                            <td style={{ ...td, ...(p1.rn === 0 ? tdMuted : {}) }}>{p1.rn === 0 ? '0' : fmtInt(p1.rn)}</td>
                            <td style={{ ...td, ...(p1.rev === 0 ? tdMuted : {}) }}>{p1.rev === 0 ? '0 €' : fmtMoney(p1.rev)}</td>
                            <td style={{ ...td, ...(p1.rn === 0 ? tdMuted : {}) }}>{p1.rn === 0 ? '0,0 €' : fmtMoney(p1.adr)}</td>
                            <td style={{ ...td, ...(p7.rn === 0 ? tdMuted : {}) }}>{p7.rn === 0 ? '0' : fmtInt(p7.rn)}</td>
                            <td style={{ ...td, ...(p7.rev === 0 ? tdMuted : {}) }}>{p7.rev === 0 ? '0 €' : fmtMoney(p7.rev)}</td>
                            <td style={{ ...td, ...(p7.rn === 0 ? tdMuted : {}) }}>{p7.rn === 0 ? '0,0 €' : fmtMoney(p7.adr)}</td>
                          </tr>
                        );
                      }),
                      <tr key={`total-${monthKey}`} style={{ background: '#EDEBDD', fontWeight: 700 }}>
                        <td style={td} colSpan={2}>{monthLabel} TOTAL</td>
                        <td style={td}></td>
                        <td style={{ ...td, ...tdMuted }}>—</td>
                        <td style={td}>{fmtPct(avgOtbPct)}</td>
                        <td style={td}>{fmtInt(totOcc)}</td>
                        <td style={td}>0</td>
                        <td style={{ ...td, ...tdMuted }}>—</td>
                        <td style={td}>{fmtInt(totAvail)}</td>
                        <td style={td} colSpan={20}></td>
                        <td style={td}>{fmtMoney(avgAdr)}</td>
                        <td style={td}>{fmtMoney(totRev)}</td>
                        <td style={td}>{fmtInt(p1sum)}</td>
                        <td style={td}>{fmtMoney(p1rev)}</td>
                        <td style={{ ...td, ...tdMuted }}></td>
                        <td style={td}>{fmtInt(p7sum)}</td>
                        <td style={td}>{fmtMoney(p7rev)}</td>
                        <td style={{ ...td, ...tdMuted }}></td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="What's wired · what's placeholder" subtitle="Honest data-source map for this report">
            <div style={{ padding: 14, fontSize: 12, lineHeight: 1.5, color: '#3A3A3A' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>🟢 Wired now (real data):</p>
              <ul style={{ margin: '0 0 12px 20px' }}>
                <li>Date · DoW · OTB % · OCC (rooms sold) · Available · ADR · Room Rev — <code>kpi.v_pace_otb_daily</code></li>
                <li>Pickup −1d / −7d (RN + Rev + ADR) — computed from <code>kpi.historical_pace_snapshots</code> (only fires if snapshots exist for those dates)</li>
                <li>Monthly totals (weighted OTB %, sum OCC, avg ADR, sum Rev, sum pickup)</li>
              </ul>
              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>🔴 Placeholder (—) until data lands:</p>
              <ul style={{ margin: '0 0 12px 20px' }}>
                <li><strong>City %</strong> · external comp-set benchmark — need STR / Amadeus / manual entry</li>
                <li><strong>House uses · OOO</strong> — Cloudbeds getReservations with is_house_use / status=OOO filter (not currently in sync)</li>
                <li><strong>Min stay (WEB · OTA)</strong> and <strong>Stop sales (WEB · OTA · B2B · FIT)</strong> — Cloudbeds <code>getRateAvailability</code> endpoint (not synced yet — this is the LOS conversation we just had)</li>
                <li><strong>Visibility flags (Mob B&E · EXP Accel · G+Mob · P+ BAR)</strong> — OTA-side campaign state, needs Booking.com Extranet + Expedia PartnerCentral scrapes</li>
                <li><strong>Rate ladder (BAR · Net rate · NRF · EB 30d · LOS3 · LOS4)</strong> — same Cloudbeds availability sync (per rate plan per date)</li>
                <li><strong>Discount tiers (15% · 20% · 25%)</strong> — derived once rate ladder is wired</li>
                <li><strong>Events</strong> — free-text column, would need an events table (e.g. <code>calendar.events</code>) with property_id + date</li>
              </ul>
              <p style={{ margin: 0, fontSize: 11, color: '#5A5A5A' }}>
                Header names + column groups match PBS's Excel day report. Rename each header directly in <code>app/revenue/pickup-day/page.tsx</code> — one line each.
              </p>
            </div>
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}

const th: React.CSSProperties = { padding: '6px 6px', textAlign: 'center', fontSize: 10, fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' };
const td: React.CSSProperties = { padding: '4px 6px', textAlign: 'right', fontSize: 10, color: '#1B1B1B', borderRight: '1px solid #F5F0E1', borderBottom: '1px solid #F5F0E1' };
const tdMuted: React.CSSProperties = { color: '#B5AF9A', textAlign: 'center' };
