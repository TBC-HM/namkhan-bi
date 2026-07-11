// app/sales/new/page.tsx
// PBS 2026-07-11 pm — Sales · Create New page (Design System rebuild).
// Server component: fetches inbound + KPI numbers, mounts CreateLead client.
// Accepts optional propertyId prop for the /h/[property_id]/sales/new delegate.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CreateLead, { type InboundRow } from './_components/CreateLead';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

interface PageProps {
  propertyId?: number;
}

async function loadData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [inbound, todayCreated, weekConverted] = await Promise.all([
    sb.from('v_sales_inbound_b2b')
      .select('id,property_id,company,contact,email,phone,country,source,created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('v_leads')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .gte('created_at', new Date(new Date().toISOString().slice(0, 10)).toISOString()),
    sb.from('v_leads')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('stage', 'won')
      .gte('updated_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
  ]);
  return {
    inbound: (inbound.data ?? []) as InboundRow[],
    createdToday: todayCreated.count ?? null,
    convertedThisWeek: weekConverted.count ?? null,
  };
}

export default async function SalesNewPage({ propertyId }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN;
  const { inbound, createdToday, convertedThisWeek } = await loadData(pid);
  const tabs = SALES_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));
  return (
    <DashboardPage
      title="Add a new lead"
      subtitle="Manual entry, or promote an inbound Wholesale/B2B inquiry into the pipeline."
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <CreateLead
          inbound={inbound}
          propertyId={pid}
          createdToday={createdToday}
          convertedThisWeek={convertedThisWeek}
        />
      </div>
    </DashboardPage>
  );
}
