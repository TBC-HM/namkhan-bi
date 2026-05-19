// app/h/[property_id]/revenue/_DonnaRevenueCanonical.tsx
// Canonical Donna revenue surface — refactored 2026-05-19 onto _design primitives.
// One file flips all 7 Donna revenue sub-routes (channels, compset, forecast,
// parity, pricing, pulse, rateplans) to the new visual system at once.
// state='data-needed' tiles → KpiTile{value:0, status:'grey', footnote:'…'}.
// Empty panels → Container + Chart variant='line' with empty prop.

import {
  DashboardPage, Container, KpiTile, Chart, ListContainer,
  type DashboardTab, type KpiTileProps, type ListContainerColumn,
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

  // Mock-typed empty rows so ListContainer is happy + columns wire later.
  type EmptyRow = Record<string, string | number>;
  const tableCols: ListContainerColumn<EmptyRow>[] = (cfg.tableColumns ?? []).map((label) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_') as keyof EmptyRow & string,
    label,
    align: 'left',
    sortable: true,
  }));

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

      {tableCols.length > 0 && (
        <ListContainer<EmptyRow>
          title={`${cfg.title} · detail`}
          subtitle={NEEDS_NOTE}
          data={[]}
          preview={5}
          rowKey={() => '_'}
          renderRow={() => <span>—</span>}
          drawerColumns={tableCols}
          empty={{ title: 'data needed', hint: NEEDS_NOTE }}
        />
      )}
    </DashboardPage>
  );
}
