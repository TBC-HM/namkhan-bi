// app/h/[property_id]/reports/page.tsx
//
// Cross-dept agent-reports surface. Reached from every HoD's subPages
// strip (rightmost "Reports" tab). Reads cockpit_tickets where
// source='agent_delivery' scoped to the current property.
//
// Task #77 · 2026-05-22 — rebuilt onto DashboardPage primitives so the
// landing matches the rest of the new revenue design. The inner
// AgentDeliveriesPanel + listAgentDeliveries data layer stays untouched.
// ?dept= param picks the right subPages strip so the tab where the user
// came from stays highlighted.

import { notFound } from 'next/navigation';
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import AgentDeliveriesPanel from '@/components/inbox/AgentDeliveriesPanel';
import { listAgentDeliveries } from '@/lib/inbox/agent-deliveries';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_PROPERTIES: Record<number, string> = {
  260955:  'The Namkhan',
  1000001: 'Donna Portals',
};

// Map ?dept= to the cfg key in DEPT_CFG. Default revenue (most common entry).
const DEPT_KEYS = new Set([
  'revenue', 'sales', 'marketing', 'operations', 'guest', 'finance',
]);

interface Props {
  params: { property_id: string };
  searchParams: { delivery?: string; dept?: string };
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || !KNOWN_PROPERTIES[propertyId]) {
    notFound();
  }
  const propertyLabel = KNOWN_PROPERTIES[propertyId];

  const deptParam = (searchParams.dept ?? 'revenue').toLowerCase();
  const dept = DEPT_KEYS.has(deptParam) ? (deptParam as keyof typeof DEPT_CFG) : 'revenue';
  const cfg = DEPT_CFG[dept];

  // Property-scope the subPages, mark "Reports" active so the strip lights up
  // the right tab. SubPagesStrip already detects the "Reports" label and
  // floats it flush-right per PBS 2026-05-16.
  const subPages = rewriteSubPagesForProperty(cfg.subPages, propertyId);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.label === 'Reports',
  }));

  const deliveries = await listAgentDeliveries(propertyId, 100).catch(() => []);
  const deptLabel = dept.charAt(0).toUpperCase() + dept.slice(1);

  return (
    <DashboardPage
      title={`Reports · ${propertyLabel}`}
      subtitle={`${deptLabel} · agent deliveries · last 100`}
      tabs={tabs}
    >
      <div style={fullRow}>
        <Container
          title="Agent reports"
          subtitle={`${deliveries.length} item${deliveries.length === 1 ? '' : 's'} · sourced from cockpit_tickets where source='agent_delivery'`}
          density="compact"
        >
          {deliveries.length === 0 ? (
            <div style={{
              padding: 20,
              color: 'var(--ink-soft, #5A5A5A)',
              fontStyle: 'italic',
              fontSize: 13,
            }}>
              No agent reports for this property yet. When an agent (Mira / Vector /
              Mercer / Lumen / Forge / Intel) delivers a memo via{' '}
              <code>deliverMemoToHod()</code> with{' '}
              <code>requested_by_role={`${dept}_hod`}</code>, it will land here.
            </div>
          ) : (
            <AgentDeliveriesPanel
              deliveries={deliveries}
              propertyId={propertyId}
              selectedIdParam={searchParams.delivery}
              basePath={`/h/${propertyId}/reports`}
            />
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}

// DashboardPage body is a 360px auto-fit grid. Spanning 1/-1 lets the
// deliveries panel use the full width instead of sitting in one cell.
const fullRow: React.CSSProperties = { gridColumn: '1 / -1' };
