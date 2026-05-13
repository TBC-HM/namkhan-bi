// app/operations/inventory/orders/page.tsx
// Purchase orders queue — proc.purchase_orders.

import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { fmtMoney, fmtDate, EMPTY } from '@/lib/format';
import { getOpenPOs } from '../_data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:               { bg: 'var(--paper-deep)', fg: '#6c5d2a' },
  sent:                { bg: 'var(--st-warn-bg)', fg: '#7d5a18' },
  partially_received:  { bg: 'var(--st-info-bg)', fg: '#1f4f6e' },
  received:            { bg: 'var(--st-good-bg)', fg: '#2f6f3a' },
  invoiced:            { bg: 'var(--st-good-bg)', fg: '#2f6f3a' },
  closed:              { bg: 'var(--line-soft)', fg: 'var(--ink-soft)' },
  cancelled:           { bg: 'var(--st-bad-bg)', fg: '#8a3026' },
};

export default async function OrdersPage() {
  const rows = await getOpenPOs();

  const open = rows.filter(r => !['received','closed','cancelled'].includes(r.status));
  const totalOpenUsd = open.reduce((s, r) => s + (r.total_usd ?? 0), 0);
  const partialReceived = rows.filter(r => r.status === 'partially_received').length;
  const overdueCount = rows.filter(r => r.expected_delivery_date && r.status !== 'received' && r.status !== 'closed' && new Date(r.expected_delivery_date) < new Date()).length;

  return (
    <Page
      eyebrow="Operations · Inventory · Orders"
      title={<>Purchase <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>orders</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginTop: 18,
        marginBottom: 24,
      }}>
        <Stat label="Open POs"            value={`${open.length}`} />
        <Stat label="Total open value"    value={fmtMoney(totalOpenUsd, 'USD')} />
        <Stat label="Partially received"  value={`${partialReceived}`} />
        <Stat label="Overdue delivery"    value={`${overdueCount}`} />
      </div>

      <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--paper-deep, #f6f3ec)' }}>
              <Th>PO #</Th>
              <Th>Vendor</Th>
              <Th>Delivery to</Th>
              <Th align="right">Issued</Th>
              <Th align="right">ETA</Th>
              <Th align="right">Total</Th>
              <Th align="center">Status</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const col = STATUS_COLORS[r.status] ?? { bg: 'var(--paper-deep)', fg: 'var(--ink-soft)' };
              const isOverdue = r.expected_delivery_date && !['received','closed','cancelled'].includes(r.status) && new Date(r.expected_delivery_date) < new Date();
              return (
                <tr key={r.po_number ?? Math.random()} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.po_number ?? EMPTY}</span></Td>
                  <Td>{r.vendor_name ?? EMPTY}</Td>
                  <Td muted>{r.delivery_location ?? EMPTY}</Td>
                  <Td align="right" mono>{fmtDate(r.issued_at)}</Td>
                  <Td align="right" mono>
                    <span style={{ color: isOverdue ? '#8a3026' : undefined }}>
                      {fmtDate(r.expected_delivery_date)}
                    </span>
                  </Td>
                  <Td align="right" mono>{fmtMoney(r.total_usd, 'USD')}</Td>
                  <Td align="center">
                    <span style={{
                      background: col.bg,
                      color: col.fg,
                      padding: '2px 6px',
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      letterSpacing: 'var(--ls-extra)',
                      textTransform: 'uppercase',
                      borderRadius: 2,
                    }}>{r.status.replace(/_/g, ' ')}</span>
                  </Td>
                  <Td muted>—</Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--ink-soft)' }}>No purchase orders.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: '1px solid var(--rule, #e3dfd3)',
      background: 'var(--paper, #fbf9f3)',
      padding: '12px 14px',
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
        marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-2xl)', fontStyle: 'italic' }}>{value}</div>
    </div>
  );
}
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{
      padding: '8px 10px',
      textAlign: align,
      fontFamily: 'var(--mono)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-extra)',
      color: 'var(--brass)',
      fontSize: 'var(--t-xs)',
      borderBottom: '1px solid var(--rule, #e3dfd3)',
      whiteSpace: 'nowrap',
    }}>{children}</th>
  );
}
function Td({ children, align = 'left', mono, muted }: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; mono?: boolean; muted?: boolean }) {
  return (
    <td style={{
      padding: '6px 10px',
      textAlign: align,
      fontFamily: mono ? 'var(--mono)' : undefined,
      fontSize: mono ? 'var(--t-xs)' : 'var(--t-sm)',
      color: muted ? 'var(--ink-soft)' : undefined,
    }}>{children}</td>
  );
}
