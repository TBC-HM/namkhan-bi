// app/holding/finance/clients/page.tsx
// PBS 2026-07-09: Simple CRM under Holding · Finance.
// Reads holding.clients via v_holding_clients (includes invoice counts + total billed).

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEPT_CFG } from '@/lib/dept-cfg';
import ClientsTable, { type ClientRow } from './_components/ClientsTable';
import ClientNew from './_components/ClientNew';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HoldingClientsPage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_holding_clients').select('*').eq('active', true).limit(500);
  const rows = (data ?? []) as ClientRow[];

  const cfg = DEPT_CFG.holding_finance;
  const tabs: DashboardTab[] = [
    ...cfg.subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: s.href === '/holding/finance/clients' })),
  ];

  const totalBilled = rows.reduce((s, r) => s + Number(r.total_billed || 0), 0);
  const withInvoices = rows.filter((r) => (r.invoices_count ?? 0) > 0).length;

  return (
    <DashboardPage
      title="Finance · Holding · Clients"
      subtitle={`${rows.length} client${rows.length === 1 ? '' : 's'} · ${withInvoices} with invoices · total billed ${totalBilled.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Add client" subtitle="Save once · reuse on every future invoice via the Recipients profile picker." density="compact">
          <ClientNew />
        </Container>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={`Clients · ${rows.length}`} subtitle="Sort by column · click a name to edit · deactivate to hide from Add-invoice pickers." density="compact">
          <ClientsTable rows={rows} />
        </Container>
      </div>
    </DashboardPage>
  );
}
