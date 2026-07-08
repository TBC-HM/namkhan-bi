// app/revenue/lighthouse/_shared/LighthouseShell.tsx
// PBS 2026-07-07: 5-view Lighthouse compset dashboard shell.
// Canonical data source: revenue.lighthouse_rateshop (via public bridge views).
// PBS 2026-07-08: pass Revenue sub-strip tabs to DashboardPage so the top nav
// (Overview | Demand & Pace | Performance | Market & Control | Reports) renders.

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { LighthouseNav, type LighthouseView, LIGHTHOUSE_VIEWS } from './LighthouseNav';
import { REVENUE_SUBPAGES } from '../../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

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
    <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 10 }}>
      Last upload: <code>{snapshotDate ?? '—'}</code>
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
  view, title, subtitle, propertyId, children,
}: {
  view: LighthouseView;
  title: string;
  subtitle: string;
  propertyId?: number;
  children?: React.ReactNode;
}) {
  const pid = propertyId ?? 260955;
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    // Any /revenue/lighthouse/* URL sits inside the Market & Control group.
    active: s.href.endsWith('/compset') || s.href.endsWith('/lighthouse'),
  }));
  return (
    <DashboardPage title={title} subtitle={subtitle} tabs={tabs}>
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
