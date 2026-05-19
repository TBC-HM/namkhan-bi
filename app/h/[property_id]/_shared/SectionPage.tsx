// app/h/[property_id]/_shared/SectionPage.tsx
// Registry-driven dashboard for a "section" page (cancellation, operations,
// guests, finance, revenue.headline). Reads:
//   • public.v_container_registry for the section's containers
//   • public.v_cockpit_inventory for KPIs that belong to the section
// Renders DashboardPage → one Container per registry row, each with a
// KpiTile grid built from the container's bound_views. Tiles whose source
// view isn't bridged to public render 0 + grey + "wire later" footnote.

import { notFound } from 'next/navigation';
import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { supabase } from '@/lib/supabase';

interface ContainerRow {
  container_code: string;
  container_name: string;
  description: string | null;
  bound_views: string[];
  display_order: number | null;
}

interface KpiRow {
  code: string;
  name: string;
  section: string | null;
  primary_view: string | null;
  served_by_namkhan: boolean | null;
  served_by_donna: boolean | null;
  notes: string | null;
  is_wired: boolean;
}

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;

function propertyName(id: number): string {
  if (id === NAMKHAN_PROPERTY_ID) return 'Namkhan';
  if (id === DONNA_PROPERTY_ID)   return 'Donna';
  return 'Property';
}

function viewBaseName(fullView: string): string {
  // 'kpi.v_revpar_daily' → 'v_revpar_daily'
  return fullView.replace(/^kpi\./, '').replace(/^public\./, '');
}

function viewToKpiLabel(fullView: string): string {
  // 'kpi.v_pace_otb_daily' → 'Pace · OTB · Daily'
  const base = viewBaseName(fullView).replace(/^v_/, '').replace(/_/g, ' ');
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SectionPageProps {
  propertyId: number;
  section: string;           // 'cancellation' | 'operations' | 'guests' | 'finance' | 'revenue'
  title: string;             // 'Revenue · Cancellation'
  subtitle: string;          // 'cancel rate, no-show, lead time'
  pageSlug: string;          // 'cancellation' — for tab activation match
  tabs?: DashboardTab[];     // optional custom tabs (e.g. revenue subpages)
}

export default async function SectionPage({
  propertyId, section, title, subtitle, pageSlug, tabs,
}: SectionPageProps) {
  if (!Number.isFinite(propertyId)) notFound();

  // 1. Pull containers in registry order for this section
  const { data: containers } = await supabase
    .from('v_container_registry')
    .select('container_code, container_name, description, bound_views, display_order')
    .eq('page_slug', pageSlug)
    .order('display_order', { ascending: true });

  const containerRows = (containers ?? []) as ContainerRow[];

  // 2. Pull KPIs in this section so we know which views exist + their metadata
  const { data: kpis } = await supabase
    .from('v_cockpit_inventory')
    .select('kind, code, name, section, primary_view, served_by_namkhan, served_by_donna, notes, is_wired')
    .eq('kind', 'kpi')
    .eq('section', section);

  const kpiByView = new Map<string, KpiRow>();
  for (const k of (kpis ?? []) as Array<KpiRow & { kind?: string }>) {
    if (k.primary_view) kpiByView.set(k.primary_view, k as KpiRow);
  }

  // 3. Check which source views are bridged to public (PostgREST exposure)
  const allViews = Array.from(new Set(
    containerRows.flatMap((c) => c.bound_views ?? []),
  ));
  const bridgedSet = new Set<string>();
  if (allViews.length > 0) {
    const baseNames = allViews.map(viewBaseName);
    const { data: tables } = await supabase
      .schema('information_schema' as never)
      .from('tables' as never)
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', baseNames);
    for (const row of (tables ?? []) as Array<{ table_name: string }>) {
      bridgedSet.add(row.table_name);
    }
  }

  const sectionTabs: DashboardTab[] = tabs ?? [];

  return (
    <DashboardPage
      title={title}
      subtitle={`${propertyName(propertyId)} · ${subtitle}`}
      tabs={sectionTabs}
    >
      {containerRows.length === 0 && (
        <Container title={title} subtitle="no containers registered for this section">
          <div style={{ padding: 16, color: 'var(--ink-soft, #5A5A5A)', fontSize: 13 }}>
            No containers found in <code>public.v_container_registry</code> for section{' '}
            <strong>{section}</strong> · page_slug <strong>{pageSlug}</strong>.
          </div>
        </Container>
      )}

      {containerRows.map((c) => {
        const tiles: KpiTileProps[] = (c.bound_views ?? []).map((fullView) => {
          const base = viewBaseName(fullView);
          const bridged = bridgedSet.has(base);
          const kpi = kpiByView.get(fullView);
          const label = kpi?.name
            ? kpi.name.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
            : viewToKpiLabel(fullView);
          return {
            label,
            value: 0,
            size: 'sm',
            status: bridged ? 'amber' : 'grey',
            footnote: bridged
              ? `bridged · wire data: ${base}`
              : `wire later · needs public.${base}`,
          };
        });

        return (
          <Container
            key={c.container_code}
            title={c.container_name}
            subtitle={c.description ?? c.container_code}
          >
            {tiles.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
              </div>
            ) : (
              <div style={{ padding: 12, color: 'var(--ink-soft, #5A5A5A)', fontSize: 12 }}>
                no bound views — see <code>{c.container_code}</code> in v_container_registry
              </div>
            )}
          </Container>
        );
      })}
    </DashboardPage>
  );
}
