// app/(cockpit)/_design/RevenueYtdStripe.tsx
// PBS 2026-08-21 · Year-to-date KPI stripe · sits below the MTD stripe on
// the Revenue HoD. Self-contained server component (same pattern as
// RevenueMtdStripe): fetches its own data so the parent Promise.all stays
// untouched. Reads v_kpi_daily_property for Jan 1 → yesterday in property TZ.

import Container from './layout/Container';
import KpiTile, { type KpiTileProps } from './tile/KpiTile';
import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

const TAX_SERVICE    = 1.21;
const TAX_SERVICE_LY = 1.21;

function tzForProperty(pid: number): string {
  if (pid === 260955) return 'Asia/Vientiane';
  if (pid === 1000001) return 'Europe/Madrid';
  return 'UTC';
}

function localTodayIso(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value ?? '1970';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function yearStart(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`;
}

function shiftYear(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y + delta}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type DailyRow = {
  night_date: string | null;
  rooms_available: number | null;
  rooms_sold: number | null;
  rooms_revenue: number | string | null;
  total_revenue: number | string | null;
};

interface Agg { avail: number; sold: number; roomsRev: number; totalRev: number; nights: number }

function aggregate(rows: DailyRow[]): Agg {
  let avail = 0, sold = 0, roomsRev = 0, totalRev = 0, nights = 0;
  for (const r of rows) {
    avail    += Number(r.rooms_available ?? 0);
    sold     += Number(r.rooms_sold ?? 0);
    roomsRev += Number(r.rooms_revenue ?? 0);
    totalRev += Number(r.total_revenue ?? 0);
    nights++;
  }
  return { avail, sold, roomsRev, totalRev, nights };
}

function propertySymbol(pid: number): string {
  if (pid === 260955) return '$';
  if (pid === 1000001) return '€';
  return '$';
}

function fmtSlyMoney(v: number | string | null | undefined, sym: string, tax: number): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `LY ${sym}${Math.round(n / tax).toLocaleString('en-US')}`;
}
function fmtSlyPct(v: number | string | null | undefined): string | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return `LY ${n.toFixed(1)}%`;
}

export default async function RevenueYtdStripe({ propertyId: pid }: Props) {
  const tz = tzForProperty(pid);
  const today = localTodayIso(tz);
  const yesterday = addDays(today, -1);
  const ytdStart = yearStart(today);
  const lyYtdStart = shiftYear(ytdStart, -1);
  const lyYesterday = shiftYear(yesterday, -1);

  if (ytdStart > yesterday) return null;

  const [ytdRes, lyRes] = await Promise.all([
    supabase
      .from('v_kpi_daily_property')
      .select('night_date, rooms_available, rooms_sold, rooms_revenue, total_revenue')
      .eq('property_id', pid)
      .gte('night_date', ytdStart)
      .lte('night_date', yesterday),
    supabase
      .from('v_kpi_daily_property')
      .select('night_date, rooms_available, rooms_sold, rooms_revenue, total_revenue')
      .eq('property_id', pid)
      .gte('night_date', lyYtdStart)
      .lte('night_date', lyYesterday),
  ]);

  const ytd = aggregate((ytdRes.data ?? []) as DailyRow[]);
  const ly  = aggregate((lyRes.data  ?? []) as DailyRow[]);

  if (ytd.nights === 0) return null;

  const sym = propertySymbol(pid);
  const occ    = ytd.avail > 0 ? (ytd.sold / ytd.avail) * 100 : 0;
  const adr    = ytd.sold  > 0 ? (ytd.roomsRev / ytd.sold) / TAX_SERVICE : 0;
  const revpar = ytd.avail > 0 ? (ytd.roomsRev / ytd.avail) / TAX_SERVICE : 0;
  const netRoomsRev = ytd.roomsRev / TAX_SERVICE;
  const netTotalRev = ytd.totalRev / TAX_SERVICE;

  const lyOcc    = ly.avail > 0 ? (ly.sold / ly.avail) * 100 : 0;
  const lyAdr    = ly.sold  > 0 ? (ly.roomsRev / ly.sold) / TAX_SERVICE_LY : 0;
  const lyRevpar = ly.avail > 0 ? (ly.roomsRev / ly.avail) / TAX_SERVICE_LY : 0;

  const tiles: KpiTileProps[] = [
    { label: 'OCC · YTD',           value: `${occ.toFixed(1)}%`,                                       size: 'sm',
      footnote: `${ytd.sold.toLocaleString('en-US')} / ${ytd.avail.toLocaleString('en-US')} rooms · ${ytd.nights}d elapsed`,
      status: occ >= 60 ? 'green' : occ >= 40 ? 'amber' : 'grey',
      stly: fmtSlyPct(lyOcc) },
    { label: 'ADR · YTD',           value: `${sym}${Math.round(adr).toLocaleString('en-US')}`,           size: 'sm',
      footnote: 'net rooms revenue ÷ rooms sold',
      status: adr > 0 ? 'green' : 'grey',
      stly: fmtSlyMoney(lyAdr, sym, 1) },
    { label: 'RevPAR · YTD',        value: `${sym}${Math.round(revpar).toLocaleString('en-US')}`,        size: 'sm',
      footnote: 'net rooms revenue ÷ rooms available',
      status: revpar > 0 ? 'green' : 'grey',
      stly: fmtSlyMoney(lyRevpar, sym, 1) },
    { label: 'Rooms revenue · YTD', value: `${sym}${Math.round(netRoomsRev).toLocaleString('en-US')}`,   size: 'sm',
      footnote: `net · ${ytd.nights} nights actualized`,
      status: netRoomsRev > 0 ? 'green' : 'grey',
      stly: fmtSlyMoney(ly.roomsRev, sym, TAX_SERVICE_LY) },
    { label: 'Total revenue · YTD', value: `${sym}${Math.round(netTotalRev).toLocaleString('en-US')}`,   size: 'sm',
      footnote: 'rooms + F&B + ancillary · net',
      status: netTotalRev > 0 ? 'green' : 'grey',
      stly: fmtSlyMoney(ly.totalRev, sym, TAX_SERVICE_LY) },
    { label: 'Nights actualized',   value: ytd.nights,                                                   size: 'sm',
      footnote: `${ytdStart} → ${yesterday} · ${tz}`,
      status: 'grey' },
  ];

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container
        title="Headline · Year to date"
        subtitle={`${ytdStart} → ${yesterday} (${tz}) · money tiles NET (excl. 10% VAT + 10% service charge) · LY pill = same-period last year`}
        density="compact"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>
    </div>
  );
}
