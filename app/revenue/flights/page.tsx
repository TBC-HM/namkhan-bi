// app/revenue/flights/page.tsx
// PBS 2026-07-06: Inbound flights to Luang Prabang (LPQ) — revenue-mgmt demand signal.
import { DashboardPage, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEPT_CFG } from '@/lib/dept-cfg';
import FlightsClient from './_components/FlightsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type Row = {
  id: number;
  search_date: string;
  flight_date: string;
  origin: string;
  destination: string;
  airline: string | null;
  flight_number: string | null;
  dep_time_local: string | null;
  arr_time_local: string | null;
  duration_min: number | null;
  stops: number | null;
  price_lowest: number | null;
  currency: string | null;
  booking_url: string | null;
};

export default async function FlightsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_flights_to_lpq')
    .select('id, search_date, flight_date, origin, destination, airline, flight_number, dep_time_local, arr_time_local, duration_min, stops, price_lowest, currency, booking_url')
    .gte('flight_date', new Date().toISOString().slice(0, 10))
    .order('flight_date', { ascending: true })
    .order('dep_time_local', { ascending: true })
    .limit(2000);
  const rows: Row[] = (data as Row[]) ?? [];

  // Aggregate: flights & avg price per date + origin
  const total = rows.length;
  const origins = new Set(rows.map(r => r.origin));
  const dates   = new Set(rows.map(r => r.flight_date));
  const withPrice = rows.filter(r => r.price_lowest != null);
  const avgPrice = withPrice.length ? Math.round(withPrice.reduce((a, r) => a + (r.price_lowest ?? 0), 0) / withPrice.length) : null;

  const tiles: KpiTileProps[] = [
    { label: 'Future flights',    value: total,                              size: 'sm', footnote: 'from today onward' },
    { label: 'Origin markets',    value: origins.size,                       size: 'sm' },
    { label: 'Distinct dates',    value: dates.size,                         size: 'sm' },
    { label: 'Avg lowest fare',   value: avgPrice != null ? `$${avgPrice}` : '—', size: 'sm', footnote: 'USD one-way' },
  ];

  const tabs: DashboardTab[] = DEPT_CFG.revenue.subPages.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/revenue/flights',
  }));

  return (
    <div style={{ background:'#FFFFFF', minHeight:'100vh' }}>
      <DashboardPage
        title="Revenue · Inbound flights to LPQ"
        subtitle="Google Flights scrape → aggregated demand signal · shows scheduled flights + lowest fares by origin market"
        tabs={tabs}
      >
        <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        <div style={{ gridColumn:'1 / -1' }}>
          <FlightsClient initialRows={rows} />
        </div>
      </DashboardPage>
    </div>
  );
}