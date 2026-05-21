// app/_components/registry/PageRenderer.tsx
// Server component. Reads v_container_registry + v_graph_registry for the page
// slug, scope-filters to the property, sorts together by display_order, and
// dispatches each item to the right container/chart component.

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '@/app/revenue/_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { supabase } from '@/lib/supabase';
import {
  scopeMatches,
  type ContainerRegistryRow, type GraphRegistryRow, type RenderableItem,
} from './types';
import ContainerTable from './ContainerTable';
import ContainerChart from './ContainerChart';
import ContainerMonthTable from './ContainerMonthTable';
import ContainerTopNDrill from './ContainerTopNDrill';
import ContainerRoomIntel from './ContainerRoomIntel';

interface Props {
  pageSlug: string;
  propertyId: number;
  title?: string;
  subtitle?: string;
  /** Optional kpi-strip slot rendered ABOVE the containers (kpi_strip render_type). */
  kpiStrip?: React.ReactNode;
  /** Forwarded URL search params for handlers that read ?period=, ?expand=, etc. */
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function PageRenderer({ pageSlug, propertyId, title, subtitle, kpiStrip, searchParams }: Props) {
  // Tabs use revenue subpages strip for now (only consumer so far is revenue)
  const subPages = rewriteSubPagesForProperty(REVENUE_SUBPAGES, propertyId);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/' + pageSlug),
  }));

  const [{ data: containerRows }, { data: graphRows }] = await Promise.all([
    supabase.from('v_container_registry').select('*').eq('page_slug', pageSlug).eq('active', true),
    supabase.from('v_graph_registry').select('*').eq('section', pageSlug).eq('active', true),
  ]);

  const containers = ((containerRows ?? []) as ContainerRegistryRow[])
    .filter((c) => scopeMatches(c.property_scope, propertyId))
    .filter((c) => c.render_type !== 'kpi_strip'); // kpi_strip rendered via the `kpiStrip` slot

  const graphs = ((graphRows ?? []) as GraphRegistryRow[])
    .filter((g) => scopeMatches(g.property_scope, propertyId));

  // Merge by display_order
  const items: RenderableItem[] = [
    ...containers.map((c): RenderableItem => ({ kind: 'container', displayOrder: c.display_order ?? 0, container: c })),
    ...graphs.map((g): RenderableItem => ({ kind: 'graph', displayOrder: g.display_order ?? 0, graph: g })),
  ].sort((a, b) => a.displayOrder - b.displayOrder);

  const finalTitle = title ?? `Revenue · ${pageSlug.charAt(0).toUpperCase()}${pageSlug.slice(1)}`;
  const finalSubtitle = subtitle ?? `registry-driven · ${containers.length} container${containers.length === 1 ? '' : 's'} · ${graphs.length} graph${graphs.length === 1 ? '' : 's'}`;

  return (
    <DashboardPage title={finalTitle} subtitle={finalSubtitle} tabs={tabs}>
      {kpiStrip}

      {items.length === 0 && (
        <Container title={finalTitle} subtitle="no containers registered for this page yet">
          <div style={{ padding: 18, fontSize: 13, color: 'var(--ink-soft, #5A5A5A)' }}>
            No registry rows for page_slug <code>{pageSlug}</code> matching scope for property{' '}
            <code>{propertyId}</code>. Add rows to <code>public.v_container_registry</code> or{' '}
            <code>public.v_graph_registry</code> to populate this page — no code change needed.
          </div>
        </Container>
      )}

      {items.map((it, idx) => {
        if (it.kind === 'graph' && it.graph) {
          return <ContainerChart key={`g-${it.graph.graph_code}-${idx}`} graph={it.graph} propertyId={propertyId} />;
        }
        const c = it.container!;
        switch (c.render_type) {
          case 'table':
            return <ContainerTable key={`c-${c.container_code}`} container={c} propertyId={propertyId} />;
          case 'month_table':
            return <ContainerMonthTable key={`c-${c.container_code}`} container={c} propertyId={propertyId} />;
          case 'top_n_drill':
            return <ContainerTopNDrill key={`c-${c.container_code}`} container={c} propertyId={propertyId} />;
          case 'room_intel':
            return <ContainerRoomIntel key={`c-${c.container_code}`} container={c} propertyId={propertyId} searchParams={searchParams} />;
          case 'chart': {
            // Allow container-row chart definitions to also flow through ContainerChart by
            // synthesising a minimal GraphRegistryRow from columns_spec.
            const firstNumeric = (c.columns_spec ?? []).find((col) => col.format !== 'text' && col.format !== 'date' && col.format !== 'month');
            const labelCol = (c.columns_spec ?? [])[0]?.key ?? 'label';
            const valueCol = firstNumeric?.key ?? 'value';
            const synthGraph: GraphRegistryRow = {
              graph_code: c.container_code,
              graph_name: c.container_name,
              chart_type: 'bar',
              view_name: c.bound_views[0] ?? '',
              section: c.page_slug,
              label_col: labelCol,
              value_col: valueCol,
              series_col: null,
              primary_filter: c.primary_filter,
              property_scope: c.property_scope,
              display_order: c.display_order,
              description: c.subtitle,
              active: c.active,
            };
            return <ContainerChart key={`c-${c.container_code}`} graph={synthGraph} propertyId={propertyId} />;
          }
          default:
            return (
              <Container key={`c-${c.container_code}`} title={c.container_name} subtitle={`unknown render_type: ${c.render_type}`}>
                <div style={{ padding: 18, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>
                  This render_type is not supported yet by the renderer.
                </div>
              </Container>
            );
        }
      })}
    </DashboardPage>
  );
}
