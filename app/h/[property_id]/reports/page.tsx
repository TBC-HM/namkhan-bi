// app/h/[property_id]/reports/page.tsx
//
// Dedicated agent-reports surface. Renders cockpit_tickets where
// source='agent_delivery' scoped to the current property.
// Reached from Finance sub-menu → "Reports" (per PBS 2026-05-15).
//
// PBS rule: this surface is ONLY for agent reports — sales emails stay
// on /h/[property_id]/inbox.

import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import AgentDeliveriesPanel from '@/components/inbox/AgentDeliveriesPanel';
import { listAgentDeliveries } from '@/lib/inbox/agent-deliveries';
import { financeSubPagesForProperty } from '@/app/finance/_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KNOWN_PROPERTIES: Record<number, string> = {
  260955:  'The Namkhan',
  1000001: 'Donna Portals',
};

interface Props {
  params: { property_id: string };
  searchParams: { delivery?: string };
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || !KNOWN_PROPERTIES[propertyId]) {
    notFound();
  }
  const propertyLabel = KNOWN_PROPERTIES[propertyId];
  const deliveries = await listAgentDeliveries(propertyId, 100).catch(() => []);

  return (
    <Page
      eyebrow={`Finance · Reports · ${propertyLabel}`}
      title={
        <>
          Reports ·{' '}
          <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>
            {propertyLabel}
          </em>
        </>
      }
      subPages={financeSubPagesForProperty(propertyId)}
    >
      <AgentDeliveriesPanel
        deliveries={deliveries}
        propertyId={propertyId}
        selectedIdParam={searchParams.delivery}
        basePath={`/h/${propertyId}/reports`}
      />
    </Page>
  );
}
