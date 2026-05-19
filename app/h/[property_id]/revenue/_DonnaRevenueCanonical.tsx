// app/h/[property_id]/revenue/_DonnaRevenueCanonical.tsx
// Canonical Donna revenue surface — refactored onto _design primitives.
// Renders identical scaffold for all 7 Donna revenue sub-routes.
//
// 2026-05-19 fix: dropped ListContainer (its rowKey/renderRow are functions
// that can't cross server→client boundary). Detail table now uses
// Chart variant='table' with an empty-state placeholder.

import {
  DashboardPage, Container, KpiTile, Chart,
  type DashboardTab, type KpiTileProps, type ChartSeries,
} from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export interface DonnaRevenueSurfaceConfig {
  slug: string;
  title: string;
  kpis: string[];
  panels: string[];
  tableColumns?: string[];
}

interface Props {
  propertyId: number;
  win?: string;
  cmp?: string;
  cfg: DonnaRevenueSurfaceConfig;
}

const NEEDS_NOTE = 'Donna PMS feed pending';

export default function DonnaRevenueCanonical({ propertyId, cfg }: Props) {
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith(`/revenue/${cfg.slug}`),
  }));

  const tiles: KpiTileProps[] = cfg.kpis.map((label) => ({
    label,
    value: 0,
    size: 'sm',
    status: 'grey',
    footnote: NEEDS_NOTE,
  }));

  // Detail table: render as Chart variant='table' with explicit empty data.
  // ListContainer is intentionally NOT used here — its rowKey/renderRow are
  // functions and can't cross server→client.
  const tableSeries: ChartSeries[] = (cfg.tableColumns ?? []).slice(1).map((label) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    label,
  }));
  const tableXKey = (cfg.tableColumns ?? [])[0] ?? '';

  return (
    <DashboardPage
      title={cfg.title}
      subtitle={`Donna · property_id=${propertyId} · ${NEEDS_NOTE}`}
      tabs={tabs}
    >
      <Container title={`${cfg.title} · KPIs`} subtitle={NEEDS_NOTE} density="compact">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>
      </Container>

      {cfg.panels.map((title) => (
        <Container key={title} title={title} subtitle={NEEDS_NOTE}>
          <Chart
            variant="line"
            data={[]}
            xKey="x"
            series={[{ key: 'y', label: title, color: '#1F3A2E' }]}
            height={180}
            empty={{ title: 'data needed', hint: NEEDS_NOTE }}
          />
        </Container>
      ))}

      {tableXKey && tableSeries.length > 0 && (
        <Container title={`${cfg.title} · detail`} subtitle={NEEDS_NOTE}>
          <Chart
            variant="table"
            data={[]}
            xKey={tableXKey.toLowerCase().replace(/[^a-z0-9]+/g, '_')}
            series={tableSeries}
            empty={{ title: 'data needed', hint: NEEDS_NOTE }}
          />
        </Container>
      )}
    </DashboardPage>
  );
}
