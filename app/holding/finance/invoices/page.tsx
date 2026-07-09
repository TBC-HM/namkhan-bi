// app/holding/finance/invoices/page.tsx
// PBS 2026-07-08: Beyond Circle invoice generator + sent-invoices ledger.
// Recipient (to whom) + line items (what) → Preview → Send.
// Running invoice number: BC-YYYY-NNNNN (holding.invoice_number_seq).

import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEPT_CFG } from '@/lib/dept-cfg';
import InvoiceGenerator from './_components/InvoiceGenerator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InvoiceRow {
  id: number;
  invoice_number: string;
  recipient_name: string;
  recipient_email: string | null;
  subject: string | null;
  subtotal: string;
  tax_amount: string;
  total: string;
  currency: string;
  issued_at: string;
  due_at: string | null;
  status: string;
  sent_at: string | null;
}

async function loadNextNumber(sb: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const { data } = await sb.rpc('fn_holding_invoice_peek_next');
  if (typeof data === 'string' && data.length) return data;
  return 'BC-2026-01001';
}

async function loadInvoices(sb: ReturnType<typeof getSupabaseAdmin>): Promise<InvoiceRow[]> {
  const { data } = await sb.from('v_holding_invoices')
    .select('id, invoice_number, recipient_name, recipient_email, subject, subtotal, tax_amount, total, currency, issued_at, due_at, status, sent_at')
    .limit(200);
  return (data ?? []) as InvoiceRow[];
}

function money(n: string | number | null, ccy: string): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `${ccy === 'EUR' ? '€' : (ccy === 'USD' ? '$' : ccy + ' ')}${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function HoldingFinanceInvoicesPage() {
  const sb = getSupabaseAdmin();
  const cfg = DEPT_CFG.holding_finance;
  const [nextNumber, invoices] = await Promise.all([
    loadNextNumber(sb),
    loadInvoices(sb),
  ]);

  const tabs: DashboardTab[] = cfg.subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/holding/finance/invoices',
  }));

  const totalIssuedYtd = invoices
    .filter((i) => new Date(i.issued_at).getUTCFullYear() === new Date().getUTCFullYear())
    .reduce((s, i) => s + Number(i.total), 0);
  const openCount = invoices.filter((i) => i.status !== 'paid' && i.status !== 'cancelled').length;

  return (
    <DashboardPage
      title="Finance · Holding · Invoices"
      subtitle={`Next number ${nextNumber} · ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} on file`}
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <StatTile label="Next invoice #" value={nextNumber} />
        <StatTile label="Invoices YTD" value={String(invoices.filter((i) => new Date(i.issued_at).getUTCFullYear() === new Date().getUTCFullYear()).length)} />
        <StatTile label="Amount YTD"   value={money(totalIssuedYtd, invoices[0]?.currency ?? 'EUR')} />
        <StatTile label="Open"         value={String(openCount)} sub="not paid / cancelled" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Generate invoice"
                   subtitle="Say to whom · say what · click Preview · click Send. Sent invoices pick up the next number and land in the ledger below."
                   density="compact">
          <InvoiceGenerator initialNextNumber={nextNumber} />
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Sent invoices"
                   subtitle="Running Beyond Circle invoice numbers · newest first · click # to view PDF-ready render."
                   density="compact">
          {invoices.length === 0 ? (
            <div style={{ fontSize: 12, color: '#5A5A5A', fontStyle: 'italic', padding: 12 }}>
              No invoices yet. Fill out the generator above and click Send.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAFAF7' }}>
                    {['#', 'Issued', 'To', 'Subject', 'Subtotal', 'Tax', 'Total', 'Due', 'Status', 'Sent', 'Preview'].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 700, borderBottom: '1px solid #E6DFCC' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td style={cell}><a href={`/holding/finance/invoices/${i.id}`} style={{ color: '#084838', fontWeight: 700, textDecoration: 'none' }}>{i.invoice_number}</a></td>
                      <td style={cell}>{i.issued_at}</td>
                      <td style={cell}>{i.recipient_name}{i.recipient_email ? <span style={{ color: '#5A5A5A' }}> · {i.recipient_email}</span> : null}</td>
                      <td style={cell}>{i.subject ?? '—'}</td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(i.subtotal, i.currency)}</td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(i.tax_amount, i.currency)}</td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{money(i.total, i.currency)}</td>
                      <td style={cell}>{i.due_at ?? '—'}</td>
                      <td style={cell}><StatusPill status={i.status} /></td>
                      <td style={cell}>{i.sent_at ? new Date(i.sent_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td style={cell}>
                        <a href={`/holding/finance/invoices/${i.id}/preview`} target="_blank" rel="noopener noreferrer"
                           style={{ padding: '3px 10px', border: '1px solid #084838', color: '#084838', borderRadius: 4, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                          Preview
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    draft:     { bg: '#FAFAF7', fg: '#5A5A5A' },
    sent:      { bg: '#E7F1E9', fg: '#1F5C2C' },
    paid:      { bg: '#DCE9DC', fg: '#0F3D18' },
    cancelled: { bg: '#F5EDEB', fg: '#B04A2F' },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', background: s.bg, color: s.fg, borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{status}</span>
  );
}

const cell: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F1EBD9', color: '#1B1B1B', fontVariantNumeric: 'tabular-nums' };
