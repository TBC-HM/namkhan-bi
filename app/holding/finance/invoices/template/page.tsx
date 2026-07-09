// app/holding/finance/invoices/template/page.tsx
// PBS 2026-07-09 v3: sender block (Beyond Circle Dubai) added to template.

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
  sender_name: string | null;
  sender_address: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  sender_tax_id: string | null;
  sender_iban: string | null;
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
      subtitle={`Editable brand + Sender + defaults · applies to every new invoice · last updated ${row?.updated_at ? new Date(row.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'} by ${row?.updated_by ?? '—'}`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Invoice template" subtitle="Edit brand + Sender (Beyond Circle Dubai) + defaults · live preview on the right · Save applies to every new invoice generator." density="compact">
          <TemplateEditor
            initial={row ? {
              brand_name: row.brand_name,
              brand_color: row.brand_color,
              header_line: row.header_line ?? '',
              footer_line: row.footer_line,
              default_notes: row.default_notes ?? '',
              default_currency: row.default_currency,
              default_tax_pct: Number(row.default_tax_pct),
              sender_name:    row.sender_name    ?? '',
              sender_address: row.sender_address ?? '',
              sender_email:   row.sender_email   ?? '',
              sender_phone:   row.sender_phone   ?? '',
              sender_tax_id:  row.sender_tax_id  ?? '',
              sender_iban:    row.sender_iban    ?? '',
            } : null}
          />
        </Container>
      </div>
    </DashboardPage>
  );
}
