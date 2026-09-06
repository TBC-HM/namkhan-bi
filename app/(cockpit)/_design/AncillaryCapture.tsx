// app/(cockpit)/_design/AncillaryCapture.tsx
// Ancillary Capture — F&B · Spa · Activities.
// PBS 2026-09-06: moved off the Revenue HoD page (app/revenue/page.tsx) onto the
// property home, directly under "Are guests spending beyond the room?" — that
// container gives the capture RATE, this one gives the money behind it.
// Self-fetching so either page can mount it with just a propertyId.
// Source: public.v_ancillary_capture_daily (property-scoped, last 90 nights).

import Container from './layout/Container';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface Props {
  propertyId: number;
  sym: string;
}

type RawRow = {
  night_date: string;
  year: number | null;
  month: number | null;
  occupied_rooms: number | null;
  fb_capture_pct: number | null;
  fb_por: number | null;
  spa_capture_pct: number | null;
  spa_por: number | null;
  activity_capture_pct: number | null;
  activity_revenue: number | null;
  total_ancillary_revenue: number | null;
  total_ancillary_por: number | null;
};

type MonthSummary = {
  key: string; label: string; days: number;
  occRooms: number;
  fbCapturePct: number | null; fbPor: number | null;
  spaCapturePct: number | null; spaPor: number | null;
  totalAncillaryPor: number | null; totalAncillaryRevenue: number;
};

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const fmtPct = (v: number | null) => v == null ? '—' : `${Number(v).toFixed(1)}%`;
const fmtMoney = (v: number | null, sym: string) =>
  v == null ? '—' : `${sym}${Math.round(Number(v)).toLocaleString('en-US')}`;

function rollUp(rows: RawRow[]): MonthSummary[] {
  type Accum = {
    year: number; month: number; days: number; occSum: number;
    fbPctSum: number; fbPctN: number; fbPorSum: number; fbPorN: number;
    spaPctSum: number; spaPctN: number; spaPorSum: number; spaPorN: number;
    totalPorSum: number; totalPorN: number; totalRevSum: number;
  };
  const byMonth = new Map<string, Accum>();

  for (const r of rows) {
    const yr = Number(r.year ?? 0);
    const mo = Number(r.month ?? 0);
    if (!yr || !mo) continue;
    const key = `${yr}-${String(mo).padStart(2, '0')}`;
    let acc = byMonth.get(key);
    if (!acc) {
      acc = {
        year: yr, month: mo, days: 0, occSum: 0,
        fbPctSum: 0, fbPctN: 0, fbPorSum: 0, fbPorN: 0,
        spaPctSum: 0, spaPctN: 0, spaPorSum: 0, spaPorN: 0,
        totalPorSum: 0, totalPorN: 0, totalRevSum: 0,
      };
      byMonth.set(key, acc);
    }
    acc.days++;
    acc.occSum += Number(r.occupied_rooms ?? 0);
    if (r.fb_capture_pct != null) { acc.fbPctSum += Number(r.fb_capture_pct); acc.fbPctN++; }
    if (r.fb_por != null) { acc.fbPorSum += Number(r.fb_por); acc.fbPorN++; }
    if (r.spa_capture_pct != null) { acc.spaPctSum += Number(r.spa_capture_pct); acc.spaPctN++; }
    if (r.spa_por != null) { acc.spaPorSum += Number(r.spa_por); acc.spaPorN++; }
    if (r.total_ancillary_por != null) { acc.totalPorSum += Number(r.total_ancillary_por); acc.totalPorN++; }
    acc.totalRevSum += Number(r.total_ancillary_revenue ?? 0);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([key, v]) => ({
      key,
      label: `${MONTH_NAMES[v.month as keyof typeof MONTH_NAMES] ?? v.month} ${v.year}`,
      days: v.days,
      occRooms: v.days > 0 ? Math.round(v.occSum / v.days) : 0,
      fbCapturePct: v.fbPctN > 0 ? v.fbPctSum / v.fbPctN : null,
      fbPor: v.fbPorN > 0 ? v.fbPorSum / v.fbPorN : null,
      spaCapturePct: v.spaPctN > 0 ? v.spaPctSum / v.spaPctN : null,
      spaPor: v.spaPorN > 0 ? v.spaPorSum / v.spaPorN : null,
      totalAncillaryPor: v.totalPorN > 0 ? v.totalPorSum / v.totalPorN : null,
      totalAncillaryRevenue: v.totalRevSum,
    }));
}

const thBase: React.CSSProperties = {
  padding: '4px 8px', fontWeight: 600,
  color: 'var(--tbl-fg-mute, #5A5A5A)', whiteSpace: 'nowrap',
};
const tdBase: React.CSSProperties = {
  padding: '4px 8px', color: 'var(--tbl-fg, #1B1B1B)', whiteSpace: 'nowrap',
};
const tdR: React.CSSProperties = { ...tdBase, textAlign: 'right' };
// --tbl-border-strong, not --tbl-border: the row separators below use the latter,
// and under the theme both tokens resolve, so sharing one flattens the header rule.
const headRow: React.CSSProperties = { borderBottom: '2px solid var(--tbl-border-strong, #E6DFCC)' };
const bodyRow: React.CSSProperties = { borderBottom: '1px solid var(--tbl-border, #F1EBD9)' };
const tableStyle: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', fontSize: 11 };
const emptyStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--tbl-fg-mute, #5A5A5A)', fontStyle: 'italic', padding: '8px 4px',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--tbl-fg-mute, #5A5A5A)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em',
};

function MonthlyTable({ rows, sym }: { rows: MonthSummary[]; sym: string }) {
  if (rows.length === 0) return <div style={emptyStyle}>No monthly data available.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={headRow}>
            <th style={{ ...thBase, textAlign: 'left' }}>Month</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Occ Rooms</th>
            <th style={{ ...thBase, textAlign: 'right' }}>F&amp;B Capture%</th>
            <th style={{ ...thBase, textAlign: 'right' }}>F&amp;B POR</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Spa Capture%</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Spa POR</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Total Ancillary POR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={bodyRow}>
              <td style={{ ...tdBase, fontWeight: 600 }}>{r.label}</td>
              <td style={tdR}>{r.occRooms}</td>
              <td style={tdR}>{fmtPct(r.fbCapturePct)}</td>
              <td style={tdR}>{fmtMoney(r.fbPor, sym)}</td>
              <td style={tdR}>{fmtPct(r.spaCapturePct)}</td>
              <td style={tdR}>{fmtMoney(r.spaPor, sym)}</td>
              <td style={tdR}>{fmtMoney(r.totalAncillaryPor, sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyDetail({ rows, sym }: { rows: RawRow[]; sym: string }) {
  if (rows.length === 0) return <div style={emptyStyle}>No daily data available.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={headRow}>
            <th style={{ ...thBase, textAlign: 'left' }}>Date</th>
            <th style={{ ...thBase, textAlign: 'right' }}>F&amp;B Capture%</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Spa Capture%</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Activity Capture%</th>
            <th style={{ ...thBase, textAlign: 'right' }}>Total Ancillary Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.night_date} style={bodyRow}>
              <td style={{ ...tdBase, fontWeight: 600 }}>{r.night_date}</td>
              <td style={tdR}>{fmtPct(r.fb_capture_pct)}</td>
              <td style={tdR}>{fmtPct(r.spa_capture_pct)}</td>
              <td style={tdR}>{fmtPct(r.activity_capture_pct)}</td>
              <td style={tdR}>{fmtMoney(r.total_ancillary_revenue, sym)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AncillaryCapture({ propertyId, sym }: Props) {
  const sbAdmin = getSupabaseAdmin();

  // Fail-open: this is a supporting container, it must never take the page down.
  const rows: RawRow[] = await (sbAdmin.from('v_ancillary_capture_daily' as never)
    .select('night_date,year,month,occupied_rooms,fb_capture_pct,fb_por,spa_capture_pct,spa_por,activity_capture_pct,activity_revenue,total_ancillary_revenue,total_ancillary_por')
    .eq('property_id', propertyId)
    .order('night_date', { ascending: false })
    .limit(90) as unknown as Promise<{ data: RawRow[] | null }>
  ).then((r) => r.data ?? []).catch((): RawRow[] => []);

  const monthly = rollUp(rows);
  const daily7 = rows.slice(0, 7);

  return (
    <Container
      title="Ancillary Capture"
      subtitle="F&B · Spa · Activities — monthly averages, then the last 7 nights"
      density="compact"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={sectionLabel}>Monthly summary · avg capture rate &amp; POR by month</div>
          <MonthlyTable rows={monthly} sym={sym} />
        </div>
        <div>
          <div style={sectionLabel}>Last 7 nights · daily detail</div>
          <DailyDetail rows={daily7} sym={sym} />
        </div>
      </div>
    </Container>
  );
}
