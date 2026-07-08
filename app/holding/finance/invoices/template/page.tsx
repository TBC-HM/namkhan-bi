// app/holding/finance/invoices/template/page.tsx
// PBS 2026-07-08: Editable invoice template — brand, colour, header, footer, defaults.
// Live preview panel next to the form so PBS sees changes before saving.

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEPT_CFG } from '@/lib/dept-cfg';
import TemplateEditor from './_components/TemplateEditor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TemplateRow {
  id: number;
  brand_name: string;
  brand_color: string;
  header_line: string | null;
  footer_line: string;
  default_notes: string | null;
  default_currency: string;
  default_tax_pct: string;
  updated_at: string;
  updated_by: string;
}

export default async function HoldingInvoiceTemplatePage() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_holding_invoice_template').select('*').maybeSingle();
  const row = data as TemplateRow | null;

  const cfg = DEPT_CFG.holding_finance;
  const tabs: DashboardTab[] = [
    ...cfg.subPages.map((s) => ({ key: s.href, label: s.label, href: s.href, active: false })),
    { key: '/holding/finance/invoices/template', label: 'Template', href: '/holding/finance/invoices/template', active: true },
  ];

  return (
    <DashboardPage
      title="Finance · Holding · Invoice template"
      subtitle={`Editable brand + defaults · applies to every new invoice · last updated ${row?.updated_at ? new Date(row.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} by ${row?.updated_by ?? '—'}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Invoice template" subtitle="Edit brand + defaults · live preview on the right · Save applies to every new invoice generator." density="compact">
          <TemplateEditor
            initial={row ? {
              brand_name: row.brand_name,
              brand_color: row.brand_color,
              header_line: row.header_line ?? '',
              footer_line: row.footer_line,
              default_notes: row.default_notes ?? '',
              default_currency: row.default_currency,
              default_tax_pct: Number(row.default_tax_pct),
            } : null}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
