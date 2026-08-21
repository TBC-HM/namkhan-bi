// app/(cockpit)/_design/RoomsInHouseStripe.tsx
// PBS 2026-08-21 · Rooms in house · 30 day trend · migrated from Revenue Pulse
// to the Revenue HoD landing (below the 4 KPI stripes). Self-contained server
// component so it slots in without touching the HoD Promise.all.

import Container from './layout/Container';
import TrendTile from './tile/TrendTile';
import { getPulseRnSold30d } from '@/lib/data-pulse';

interface Props { propertyId: number }

export default async function RoomsInHouseStripe({ propertyId }: Props) {
  const rows = await getPulseRnSold30d(propertyId);
  if (!rows || rows.length === 0) return null;

  const series = rows.map((r) => ({ date: r.night_date, value: r.rooms_sold }));
  const total = series.reduce((s, r) => s + r.value, 0);
  const avg = series.length > 0 ? total / series.length : 0;

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container
        title="Rooms in house · last 30 days"
        subtitle="rooms occupied each night · dashed line = average"
        density="compact"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
          <TrendTile
            label="Avg rooms in house · 30d"
            value={avg.toFixed(1)}
            series={series}
            footnote={`${series.length} days · ${Math.round(total)} total room-nights in house`}
          />
        </div>
      </Container>
    </div>
  );
}
