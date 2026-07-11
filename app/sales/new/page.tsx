// app/sales/new/page.tsx
// PBS 2026-07-11 pm (dir 1) — Sales · Create New. Landing = "Add a new lead"
// on the LEFT + Inbound Wholesale/B2B queue on the RIGHT. Split out of the
// old /sales/leads landing (which conflated pipeline management with lead
// creation).

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import CreateLead, { type InboundRow } from './_components/CreateLead';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

async function loadData() {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_sales_inbound_b2b')
    .select('id,property_id,company,contact,email,phone,country,source,created_at')
    .eq('property_id', NAMKHAN)
    .order('created_at', { ascending: false })
    .limit(20);
  return { inbound: (data ?? []) as InboundRow[] };
}

export default async function SalesNewPage() {
  const { inbound } = await loadData();
  const tabs = SALES_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));
  return (
    <DashboardPage
      title="Add a new lead"
      subtitle="Manual entry, or promote an inbound Wholesale/B2B inquiry into the pipeline."
      tabs={tabs}
      currentTab="/sales/new"
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <CreateLead inbound={inbound} propertyId={NAMKHAN} />
      </div>
    </DashboardPage>
  );
}
