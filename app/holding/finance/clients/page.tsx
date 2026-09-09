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

  const withInvoices = rows.filter((r) => (r.invoices_count ?? 0) > 0).length;

  // PBS 2026-09-09 fix: this used to sum total_billed across ALL clients and
  // stamp "EUR" on the result. Clients bill in their own currency (EUR/USD/AED/
  // LAK — see the picker in ClientNew), so that produced a number with no
  // meaning, and it contradicted the table below, which correctly formats each
  // row in its own currency. Subtotal per currency instead; never add across.
  const billedByCurrency = rows.reduce<Record<string, number>>((acc, r) => {
    const amount = Number(r.total_billed || 0);
    if (!amount) return acc;
    const ccy = r.currency || 'unknown';
    acc[ccy] = (acc[ccy] ?? 0) + amount;
    return acc;
  }, {});
  const billedLabel = Object.entries(billedByCurrency)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ccy, amount]) => {
      try {
        return amount.toLocaleString('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 });
      } catch {
        return `${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${ccy}`;
      }
    })
    .join(' · ');

  return (
    <DashboardPage
      title="Finance · Holding · Clients"
      subtitle={`${rows.length} client${rows.length === 1 ? '' : 's'} · ${withInvoices} with invoices${billedLabel ? ` · billed ${billedLabel}` : ''}`}
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
