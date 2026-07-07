// app/revenue/lighthouse/_shared/LighthouseShell.tsx
// PBS 2026-07-07: 5-view Lighthouse compset dashboard shell.
// Canonical data source: revenue.lighthouse_rateshop (via public bridge views).
// Currently: Donna Portals sample seed (snapshot_date=2026-07-06); Namkhan empty
// until email→xlsx ingestion is wired.

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { LighthouseNav, type LighthouseView, LIGHTHOUSE_VIEWS } from './LighthouseNav';

export type { LighthouseView };
export { LIGHTHOUSE_VIEWS };

export function LighthouseEmpty({ view }: { view: string }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', border: '1px solid #E6DFCC', borderRadius: 6, background: '#FAFAF7' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: '#1B1B1B' }}>Awaiting Lighthouse email ingestion</div>
      <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 16, maxWidth: 640, margin: '0 auto 16px' }}>
        The <strong>{view}</strong> view needs at least one snapshot in <code>revenue.lighthouse_rateshop</code> for this property.
        Donna sample data lives at <code>/h/1000001/revenue/lighthouse/*</code>.
      </div>
    </div>
  );
}

export function SampleBanner({ snapshotDate }: { snapshotDate: string | null }) {
  return (
    <div style={{
      padding: '6px 12px', background: '#FDF6D8', border: '1px solid #E9D66C',
      borderRadius: 4, fontSize: 11, color: '#5A4A00', marginBottom: 10,
      display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700 }}>Sample data — Donna Portals demo</span>
      <span>Snapshot loaded: <code>{snapshotDate ?? '—'}</code></span>
      <span>· Daily Lighthouse xlsx ingestion is not yet wired</span>
    </div>
  );
}

export const OVERVIEW_COLUMNS = [
  'Day', 'Date',
  'Flex own hotel', 'Median flex compset', 'Compset price rank',
  'My OTB %', 'Market demand %',
  'Booking.com ranking', 'Holidays', 'Events',
];
export const RATES_COLUMNS = [
  'Day', 'Date', 'My OTB %', 'Market demand %',
  'Own rate', '+ one column per competitor hotel (rate value or LOS/No flex/Sold out)',
];
export const DELTA_COLUMNS = [
  'Day', 'Date', 'My OTB %', '(Δ OTB)', 'Market demand %', '(Δ demand)',
  'Own rate', '(Δ own)', '+ per competitor: rate + Δ vs comparison window',
];

export function LighthouseShell({
  view, title, subtitle, children,
}: {
  view: LighthouseView;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <DashboardPage title={title} subtitle={subtitle}>
      <div style={{ gridColumn: '1 / -1' }}>
        <LighthouseNav active={view} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={title} subtitle="Lighthouse feed · updates every 24h from a scheduled email → xlsx parser (currently sample data)">
          {children ?? <LighthouseEmpty view={title} />}
        </Container>
      </div>
    </DashboardPage>
  );
}
