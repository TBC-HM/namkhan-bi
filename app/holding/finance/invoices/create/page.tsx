// app/holding/finance/invoices/create/page.tsx
// PBS 2026-07-09: Create-a-new-invoice page — generator + KPI stripe.
// Sent invoices ledger moved to /send-log · Template stays at /template.

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEPT_CFG } from '@/lib/dept-cfg';
import InvoiceGenerator from '../_components/InvoiceGenerator';
import InvoiceSubNav from '../_components/InvoiceSubNav';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadNextNumber(sb: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const { data } = await sb.rpc('fn_holding_invoice_peek_next');
  return typeof data === 'string' && data.length ? data : 'BC-2026-01001';
}

async function loadStats(sb: ReturnType<typeof getSupabaseAdmin>): Promise<{ ytd: number; open: number; total: number }> {
  const { data } = await sb.from('v_holding_invoices').select('total, status, issued_at, currency').limit(500);
  const rows = (data ?? []) as Array<{ total: string; status: string; issued_at: string }>;
  const year = new Date().getUTCFullYear();
  const ytd  = rows.filter((i) => new Date(i.issued_at).getUTCFullYear() === year).length;
  const open = rows.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length;
  return { ytd, open, total: rows.length };
}

export default async function HoldingInvoicesCreatePage() {
  const sb = getSupabaseAdmin();
  const cfg = DEPT_CFG.holding_finance;
  const [nextNumber, stats] = await Promise.all([loadNextNumber(sb), loadStats(sb)]);

  const tabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/holding/finance/invoices',
  }));

  return (
    <DashboardPage
      title="Finance · Holding · Invoices · Create"
      subtitle={`Next invoice number: ${nextNumber} · ${stats.total} on file · ${stats.open} open`}
      tabs={tabs}
    >
      <InvoiceSubNav active="create" />

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <StatTile label="Next invoice #" value={nextNumber} />
        <StatTile label="Invoices YTD" value={String(stats.ytd)} />
        <StatTile label="Open" value={String(stats.open)} sub="not paid / cancelled" />
        <StatTile label="Total on file" value={String(stats.total)} />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Generate invoice"
                   subtitle="Pick a client (or type below) · say what · click Preview · click Send."
                   density="compact">
          <InvoiceGenerator initialNextNumber={nextNumber} />
        </Container>
      </div>
    </DashboardPage>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: '12px 14px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#084838', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
