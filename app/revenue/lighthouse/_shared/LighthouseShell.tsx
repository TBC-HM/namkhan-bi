// app/revenue/lighthouse/_shared/LighthouseShell.tsx
// PBS 2026-07-07: 5-view Lighthouse compset dashboard shell.
// Data lives in public.compset_lighthouse_{context,daily,hotels} — see ./data.ts.
// Currently seeded with a Donna Portals sample snapshot (snapshot_date=2026-07-06).

import Link from 'next/link';
import { DashboardPage, Container } from '@/app/(cockpit)/_design';

export type LighthouseView = 'overview' | 'rates' | 'yesterday' | 'three_days' | 'seven_days';

export const LIGHTHOUSE_VIEWS: Array<{ key: LighthouseView; href: string; label: string }> = [
  { key: 'overview',    href: '/revenue/lighthouse/overview',      label: 'Overview'      },
  { key: 'rates',       href: '/revenue/lighthouse/rates',         label: 'Rates'         },
  { key: 'yesterday',   href: '/revenue/lighthouse/vs-yesterday',  label: 'vs Yesterday'  },
  { key: 'three_days',  href: '/revenue/lighthouse/vs-3d',         label: 'vs 3 days ago' },
  { key: 'seven_days',  href: '/revenue/lighthouse/vs-7d',         label: 'vs 7 days ago' },
];

export function LighthouseNav({ active }: { active: LighthouseView }) {
  return (
    <nav style={strip} role="tablist" aria-label="Lighthouse views">
      {LIGHTHOUSE_VIEWS.map((v) => {
        const isActive = v.key === active;
        return (
          <Link key={v.key} href={v.href} role="tab" aria-selected={isActive}
            style={{ ...tab, ...(isActive ? tabActive : null) }}>
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LighthouseEmpty({ view }: { view: string }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', border: '1px solid #E6DFCC', borderRadius: 6, background: '#FAFAF7' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: '#1B1B1B' }}>Awaiting Lighthouse email ingestion</div>
      <div style={{ fontSize: 12, color: '#5A5A5A', marginBottom: 16 }}>
        The <strong>{view}</strong> view needs at least one snapshot in <code>public.compset_lighthouse_daily</code>.
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
    <div style={{ background: '#FFFFFF', minHeight: '100vh' }}>
      <DashboardPage
        title={title}
        subtitle={subtitle}
        action={<Link href="/revenue/compset" style={{ fontSize: 11, color: '#5A5A5A', textDecoration: 'none' }}>← Comp set</Link>}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <LighthouseNav active={view} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={title} subtitle="Lighthouse feed · updates every 24h from a scheduled email → xlsx parser (currently sample data)">
            {children ?? <LighthouseEmpty view={title} />}
          </Container>
        </div>
      </DashboardPage>
    </div>
  );
}

const strip: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  padding: '6px 0', borderBottom: '1px solid #E6DFCC',
};
const tab: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12, fontWeight: 500,
  color: '#5A5A5A', textDecoration: 'none', borderBottom: '2px solid transparent',
};
const tabActive: React.CSSProperties = {
  color: '#1B1B1B', fontWeight: 700, borderBottomColor: '#084838',
};
