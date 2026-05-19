// app/dev/components/Showcase.tsx
// Renders every cockpit design primitive with the required v3 demos.
// Read-only — interactive only via local component state.

'use client';

import { useState } from 'react';
import {
  KpiTile, Chart, Container, ListContainer, Drawer,
  DashboardPage, MetricRow, SplitContainer,
  type ChartDimension, type KpiComparison, type ListContainerColumn,
} from '@/app/(cockpit)/_design';

// ─── Mock data ──────────────────────────────────────────────────────────

const MONTHLY = [
  { month: 'Jan', adr: 142, occ: 0.62, revpar: 88,  rooms_sold: 1860, ancillary: 28000 },
  { month: 'Feb', adr: 151, occ: 0.71, revpar: 107, rooms_sold: 2130, ancillary: 34000 },
  { month: 'Mar', adr: 159, occ: 0.78, revpar: 124, rooms_sold: 2418, ancillary: 41000 },
  { month: 'Apr', adr: 168, occ: 0.82, revpar: 138, rooms_sold: 2540, ancillary: 47000 },
  { month: 'May', adr: 174, occ: 0.85, revpar: 148, rooms_sold: 2635, ancillary: 51000 },
  { month: 'Jun', adr: 181, occ: 0.89, revpar: 161, rooms_sold: 2760, ancillary: 56000 },
];

const CHANNEL = [
  { channel: 'Booking.com', rooms: 1240, revenue: 184000 },
  { channel: 'Expedia',     rooms:  680, revenue:  95000 },
  { channel: 'Direct',      rooms:  920, revenue: 142000 },
  { channel: 'Airbnb',      rooms:  410, revenue:  61000 },
];

const STACKED_BY_CHANNEL = MONTHLY.map((m, i) => ({
  month: m.month,
  booking:  Math.round(m.ancillary * 0.45 + i * 800),
  expedia:  Math.round(m.ancillary * 0.20 + i * 400),
  direct:   Math.round(m.ancillary * 0.25 + i * 700),
  airbnb:   Math.round(m.ancillary * 0.10 + i * 200),
}));
const STACKED_BY_ROOMTYPE = MONTHLY.map((m, i) => ({
  month: m.month,
  villa:   Math.round(m.ancillary * 0.55 + i * 600),
  bungalow:Math.round(m.ancillary * 0.30 + i * 500),
  suite:   Math.round(m.ancillary * 0.15 + i * 300),
}));

const HEATMAP_DOW_HOUR: { day: string; hour: string; bookings: number }[] = [];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const HOURS = ['06','09','12','15','18','21'];
DAYS.forEach((d, di) => HOURS.forEach((h, hi) => HEATMAP_DOW_HOUR.push({
  day: d, hour: h,
  bookings: Math.max(0, Math.round(20 + 12 * Math.sin((di * 6 + hi) * 0.6))),
})));

const ROOM_ROWS = [
  { room: 'Villa #1', nights: 28, revenue: 5460 },
  { room: 'Villa #2', nights: 26, revenue: 5070 },
  { room: 'Bungalow A', nights: 24, revenue: 3120 },
  { room: 'Suite #1', nights: 18, revenue: 4860 },
  { room: 'Bungalow B', nights: 22, revenue: 2860 },
];

interface MockCustomer { id: string; name: string; nights: number; spend: number; country: string }
const CUSTOMERS: MockCustomer[] = Array.from({ length: 14 }, (_, i) => ({
  id: `c-${i}`,
  name: ['Hugo Larsson','Mara Vidal','Jin Park','Anika Roy','Karim Ould','Sofia Mendes','Lila Tan','Owen Brown','Yuki Saito','Ines Boucher','Adam Klee','Nour Asfour','Pia Vega','Tom Frey'][i],
  nights: 3 + (i % 7),
  spend: 600 + i * 145,
  country: ['SE','MX','KR','IN','MA','BR','MY','GB','JP','FR','DE','LB','ES','CH'][i],
}));

const STLY_2: KpiComparison[] = [
  { label: 'vs STLY',   value: 5.2,  format: 'percent', direction: 'up' },
  { label: 'vs Budget', value: -3.1, format: 'percent', direction: 'down', isGoodWhenUp: true },
];

const FIVE_COMPARES: KpiComparison[] = [
  { label: 'vs STLY',       value: 5.2,  format: 'percent', direction: 'up' },
  { label: 'vs Budget',     value: -3.1, format: 'percent', direction: 'down', isGoodWhenUp: true },
  { label: 'vs Last Year',  value: 8.7,  format: 'percent', direction: 'up' },
  { label: 'vs Target',     value: 1.4,  format: 'percent', direction: 'up' },
  { label: 'vs Forecast',   value: 0.0,  format: 'percent', direction: 'flat', status: 'pending' },
];

const DIMENSIONS_ANCILLARY: ChartDimension[] = [
  { key: 'channel',     label: 'By Channel',   isDefault: true,  status: 'live' },
  { key: 'room_type',   label: 'By Room Type',                   status: 'live' },
  { key: 'department',  label: 'By Department',                  status: 'pending' },
];

const CUSTOMER_COLS: ListContainerColumn<MockCustomer>[] = [
  { key: 'name',    label: 'Name',     align: 'left',  sortable: true },
  { key: 'country', label: 'Country',  align: 'left',  sortable: true },
  { key: 'nights',  label: 'Nights',   align: 'right', sortable: true, searchable: false },
  { key: 'spend',   label: 'Spend (€)',align: 'right', sortable: true, searchable: false,
    render: (r) => r.spend.toLocaleString('en-US') },
];

// ─── Showcase ────────────────────────────────────────────────────────────

const TABS = ['tiles','charts','containers','overlays','templates'] as const;
type TabKey = typeof TABS[number];

export default function Showcase() {
  const [tab, setTab] = useState<TabKey>('tiles');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDim, setActiveDim] = useState<ChartDimension>(DIMENSIONS_ANCILLARY[0]);
  const stackedData = activeDim.key === 'room_type' ? STACKED_BY_ROOMTYPE : STACKED_BY_CHANNEL;
  const stackedSeries = activeDim.key === 'room_type'
    ? [
      { key: 'villa',    label: 'Villas' },
      { key: 'bungalow', label: 'Bungalows' },
      { key: 'suite',    label: 'Suites' },
    ]
    : [
      { key: 'booking', label: 'Booking.com' },
      { key: 'expedia', label: 'Expedia' },
      { key: 'direct',  label: 'Direct' },
      { key: 'airbnb',  label: 'Airbnb' },
    ];

  return (
    <DashboardPage
      title="Design primitives v5"
      subtitle="Cockpit design system — atoms + templates. Each section demonstrates the components a page can compose."
      tabs={TABS.map((k) => ({ key: k, label: k.toUpperCase(), active: tab === k, onSelect: () => setTab(k) }))}
    >
      {tab === 'tiles'      && <TilesSection />}
      {tab === 'charts'     && <ChartsSection activeDim={activeDim} setActiveDim={setActiveDim} stackedData={stackedData} stackedSeries={stackedSeries} />}
      {tab === 'containers' && <ContainersSection />}
      {tab === 'overlays'   && <OverlaysSection drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />}
      {tab === 'templates'  && <TemplatesSection />}
    </DashboardPage>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────

function TilesSection() {
  return (
    <>
      <Container title="KpiTile · sizes" subtitle="sm = 88 / md = 120 / lg = 160. Numbers use tabular-nums.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <KpiTile label="MTD ADR" value={168} currency="EUR" size="sm" />
          <KpiTile label="MTD ADR" value={168} currency="EUR" size="md" />
          <KpiTile label="MTD ADR" value={168} currency="EUR" size="lg" />
        </div>
      </Container>

      <Container title="KpiTile · comparisons" subtitle="0 → 2 → 5 compare items + pending case.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <KpiTile label="Occupancy" value="86%" />
          <KpiTile label="RevPAR (MTD)" value={148} currency="EUR" delta={{ value: 12.3, period: 'prev month', direction: 'up' }} compare={STLY_2} />
          <KpiTile label="RevPAR (MTD)" value={148} currency="EUR" delta={{ value: 12.3, period: 'prev month', direction: 'up' }} compare={FIVE_COMPARES} />
          <KpiTile label="Cancel rate" value="4.2%" delta={{ value: -1.1, period: 'prev month', direction: 'down', isGoodWhenUp: false }} compare={[{ label: 'vs STLY', value: -0.6, format: 'percent', direction: 'down', isGoodWhenUp: false }]} />
        </div>
      </Container>

      <Container title="KpiTile · status, loading, click" subtitle="Status dot + onClick + loading skeleton.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <KpiTile label="Health · API latency" value="142 ms" status="green" footnote="p95, last 24h" />
          <KpiTile label="Cash flow · today" value="−4,820" currency="EUR" status="amber" footnote="Trailing 24h" />
          <KpiTile label="Overdue invoices" value="3" status="red" onClick={() => alert('open drilldown')} footnote="Click to drill in" />
          <KpiTile label="ADR" value={0} loading />
        </div>
      </Container>
    </>
  );
}

function ChartsSection({ activeDim, setActiveDim, stackedData, stackedSeries }: {
  activeDim: ChartDimension;
  setActiveDim: (d: ChartDimension) => void;
  stackedData: Record<string, unknown>[];
  stackedSeries: { key: string; label: string }[];
}) {
  return (
    <>
      <Container title="Chart · line" subtitle="ADR / RevPAR. Crosshair tooltip shows both series at hover.">
        <Chart variant="line" data={MONTHLY} xKey="month" series={[{ key: 'adr', label: 'ADR' }, { key: 'revpar', label: 'RevPAR' }]} formatY={(v) => `€${v}`} height={240} />
      </Container>

      <Container title="Chart · area" subtitle="Ancillary revenue per month.">
        <Chart variant="area" data={MONTHLY} xKey="month" yKey="ancillary" series={[{ key: 'ancillary', label: 'Ancillary' }]} formatY={(v) => `€${(v / 1000).toFixed(0)}k`} height={220} />
      </Container>

      <Container title="Chart · bar" subtitle="Revenue by channel.">
        <Chart variant="bar" data={CHANNEL} xKey="channel" yKey="revenue" series={[{ key: 'revenue', label: 'Revenue' }]} formatY={(v) => `€${(v / 1000).toFixed(0)}k`} height={220} />
      </Container>

      <Container title="Chart · stacked_bar (with dimensions)" subtitle="Dropdown lives in this container's action slot. Switching it re-renders without leaving the page.">
        <Chart
          variant="stacked_bar"
          data={stackedData}
          xKey="month"
          series={stackedSeries}
          dimensions={DIMENSIONS_ANCILLARY}
          activeDimensionKey={activeDim.key}
          onDimensionChange={setActiveDim}
          formatY={(v) => `€${(v / 1000).toFixed(0)}k`}
          height={260}
        />
      </Container>

      <Container title="Chart · donut" subtitle="Hover scales slice 1.04, tooltip shows label + % of total.">
        <Chart variant="donut" data={CHANNEL} xKey="channel" series={[{ key: 'revenue', label: 'Revenue' }]} formatY={(v) => `€${(v / 1000).toFixed(0)}k`} height={260} />
      </Container>

      <Container title="Chart · combo" subtitle="Bars (rooms sold) + line (RevPAR) on shared x.">
        <Chart
          variant="combo"
          data={MONTHLY}
          xKey="month"
          series={[
            { key: 'rooms_sold', label: 'Rooms sold', type: 'bar' },
            { key: 'revpar',     label: 'RevPAR',     type: 'line', color: '#B8542A' },
          ]}
          height={240}
        />
      </Container>

      <Container title="Chart · heatmap" subtitle="Booking volume by day-of-week × hour. Hover cells.">
        <Chart variant="heatmap" data={HEATMAP_DOW_HOUR} xKey="hour" yKey="day" series={[{ key: 'bookings', label: 'Bookings' }]} height={220} />
      </Container>

      <Container title="Chart · table" subtitle="Top rooms by nights / revenue. Hover row, click for drilldown.">
        <Chart variant="table" data={ROOM_ROWS} xKey="room" series={[{ key: 'nights', label: 'Nights' }, { key: 'revenue', label: 'Revenue (€)' }]} onRowClick={(r) => alert(`drill into ${r.room}`)} />
      </Container>

      <Container title="Chart · tile" subtitle="One number, hover lifts.">
        <Chart variant="tile" data={[{ value: 4820 }]} series={[{ key: 'value', label: 'Bookings · 7 days' }]} formatY={(v) => v.toLocaleString('en-US')} />
      </Container>

      <Container title="Chart · cards" subtitle="One card per row; hover highlights border.">
        <Chart variant="cards" data={CHANNEL} xKey="channel" series={[{ key: 'rooms', label: 'Rooms' }, { key: 'revenue', label: 'Revenue (€)' }]} />
      </Container>
    </>
  );
}

function ContainersSection() {
  return (
    <>
      <Container title="Container · comfortable" subtitle="Default 24px padding, 16px gap." action={<span style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>action slot</span>}>
        <p style={{ margin: 0, fontSize: 13 }}>Body content lives here.</p>
      </Container>

      <Container title="Container · compact" density="compact" status="amber" subtitle="12px padding for dense pages.">
        <p style={{ margin: 0, fontSize: 13 }}>Tighter padding + status dot in the title row.</p>
      </Container>

      <Container title="Container · loading" loading>
        <p style={{ margin: 0 }}>Hidden while loading.</p>
      </Container>

      <ListContainer<MockCustomer>
        title="ListContainer · customers"
        subtitle="14 mock rows · peek=5 · drawer is sortable + searchable."
        data={CUSTOMERS}
        preview={5}
        rowKey={(r) => r.id}
        renderRow={(r) => (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'baseline', fontSize: 13 }}>
            <span style={{ fontWeight: 500 }}>{r.name} <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontWeight: 400 }}>· {r.country}</span></span>
            <span style={{ color: 'var(--ink-soft, #5A5A5A)', fontVariantNumeric: 'tabular-nums' }}>{r.nights}n</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>€{r.spend.toLocaleString('en-US')}</span>
          </div>
        )}
        drawerColumns={CUSTOMER_COLS}
        drawerSearchKeys={['name','country']}
        drawerDefaultSort={{ key: 'spend', direction: 'desc' }}
      />
    </>
  );
}

function OverlaysSection({ drawerOpen, setDrawerOpen }: { drawerOpen: boolean; setDrawerOpen: (v: boolean) => void }) {
  return (
    <Container title="Drawer" subtitle="ESC closes · scrim click closes · body scroll locks while open.">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 14px',
          background: 'var(--primary, #1F3A2E)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Open drawer
      </button>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Drawer · md"
        subtitle="Standalone overlay demo"
        width="md"
        footer={<button type="button" onClick={() => setDrawerOpen(false)} style={{ background: 'var(--primary, #1F3A2E)', color: '#FFFFFF', border: 'none', padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Done</button>}
      >
        <p style={{ margin: 0, fontSize: 13 }}>Drawer body can host any content. Drawers must not be nested.</p>
        <p style={{ marginTop: 12, fontSize: 13 }}>Try pressing ESC or clicking the scrim.</p>
      </Drawer>
    </Container>
  );
}

function TemplatesSection() {
  return (
    <>
      <Container title="MetricRow" subtitle="Auto-balanced row of 4 tiles.">
        <MetricRow
          size="sm"
          tiles={[
            { label: 'MTD revenue',    value: 348000, currency: 'EUR', delta: { value: 12.3, period: 'prev month', direction: 'up' }, status: 'green' },
            { label: 'Occupancy',      value: '85%',                   delta: { value: 4.1,  period: 'prev month', direction: 'up' }, status: 'green' },
            { label: 'Cancel rate',    value: '4.2%',                  delta: { value: -1.1, period: 'prev month', direction: 'down', isGoodWhenUp: false }, status: 'amber' },
            { label: 'AR overdue',     value: 3,                       status: 'red', footnote: 'click to drill' },
          ]}
        />
      </Container>

      <SplitContainer
        title="SplitContainer · 1:2"
        subtitle="KpiTile left, Chart right. Right-side dimension dropdown still mounts into this Container action slot."
        ratio="1:2"
        left={
          <KpiTile
            label="Ancillary revenue · MTD"
            value={47000}
            currency="EUR"
            size="lg"
            delta={{ value: 12.3, period: 'prev month', direction: 'up' }}
            compare={STLY_2}
          />
        }
        right={
          <Chart
            variant="area"
            data={MONTHLY}
            xKey="month"
            yKey="ancillary"
            series={[{ key: 'ancillary', label: 'Ancillary' }]}
            formatY={(v) => `€${(v / 1000).toFixed(0)}k`}
            height={220}
            legend="none"
          />
        }
      />
    </>
  );
}
