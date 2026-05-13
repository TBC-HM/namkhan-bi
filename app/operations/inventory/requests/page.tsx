// app/operations/inventory/requests/page.tsx
// Purchase request queue — proc.requests.

import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { fmtMoney, fmtDate, EMPTY } from '@/lib/format';
import { getOpenRequests } from '../_data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft:            { bg: 'var(--paper-deep)', fg: '#6c5d2a' },
  submitted:        { bg: 'var(--st-warn-bg)', fg: '#7d5a18' },
  pending_gm:       { bg: 'var(--st-warn-bg)', fg: '#7d5a18' },
  pending_owner:    { bg: 'var(--st-warn-bg)', fg: '#7d5a18' },
  auto_approved:    { bg: 'var(--st-good-bg)', fg: '#2f6f3a' },
  approved:         { bg: 'var(--st-good-bg)', fg: '#2f6f3a' },
  sent_back:        { bg: 'var(--st-bad-bg)', fg: '#8a3026' },
  rejected:         { bg: 'var(--st-bad-bg)', fg: '#8a3026' },
  converted_to_po:  { bg: 'var(--st-info-bg)', fg: '#1f4f6e' },
  closed:           { bg: 'var(--line-soft)', fg: 'var(--ink-soft)' },
  cancelled:        { bg: 'var(--st-bad-bg)', fg: '#8a3026' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#8a3026',
  high:   '#7d5a18',
  normal: 'var(--ink-soft)',
  low:    'var(--ink-faint)',
};

const DEPT_COLORS: Record<string, { bg: string; fg: string }> = {
  fb:           { bg: 'var(--st-good-bg)', fg: '#2f6f3a' },
  hk:           { bg: 'var(--st-info-bg)', fg: '#1f4f6e' },
  spa:          { bg: '#f0e0e6', fg: '#7a3850' },
  engineering:  { bg: '#eee0c6', fg: '#7d5418' },
  frontoffice:  { bg: '#e9eed8', fg: '#5e6c2a' },
};

export default async function RequestsPage() {
  const rows = await getOpenRequests();

  const open = rows.filter(r => !['approved','closed','rejected','converted_to_po','cancelled'].includes(r.status));
  const totalOpenUsd = open.reduce((s, r) => s + (r.total_estimated_usd ?? 0), 0);
  const urgent = rows.filter(r => r.priority === 'urgent' && !['approved','closed','rejected','converted_to_po','cancelled'].includes(r.status)).length;
  const overdue = rows.filter(r => r.needed_by_date && new Date(r.needed_by_date) < new Date() && !['approved','closed','rejected','converted_to_po','cancelled'].includes(r.status)).length;

  return (
    <Page
      eyebrow="Operations · Inventory · Requests"
      title={<>Purchase <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>requests</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginTop: 18,
        marginBottom: 24,
      }}>
        <Stat label="Open requests"      value={`${open.length}`} />
        <Stat label="Total est. value"   value={fmtMoney(totalOpenUsd, 'USD')} />
        <Stat label="Urgent priority"    value={`${urgent}`} />
        <Stat label="Past needed-by"     value={`${overdue}`} />
      </div>

      <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--paper-deep, #f6f3ec)' }}>
              <Th>PR #</Th>
              <Th>Title</Th>
              <Th align="center">Dept</Th>
              <Th>Delivery to</Th>
              <Th align="center">Priority</Th>
              <Th align="right">Submitted</Th>
              <Th align="right">Needed by</Th>
              <Th align="right">Est.</Th>
              <Th align="center">Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const col = STATUS_COLORS[r.status] ?? { bg: 'var(--paper-deep)', fg: 'var(--ink-soft)' };
              const dept = r.requesting_dept ? DEPT_COLORS[r.requesting_dept] : null;
              const isOverdue = r.needed_by_date && !['approved','closed','rejected','converted_to_po'].includes(r.status) && new Date(r.needed_by_date) < new Date();
              return (
                <tr key={r.pr_number ?? Math.random()} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.pr_number ?? EMPTY}</span></Td>
                  <Td>{r.pr_title}</Td>
                  <Td align="center">
                    {r.requesting_dept ? (
                      <span style={{
                        background: dept?.bg ?? 'var(--paper-deep)',
                        color: dept?.fg ?? 'var(--ink-soft)',
                        padding: '2px 6px',
                        fontFamily: 'var(--mono)',
                        fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)',
                        textTransform: 'uppercase',
                        borderRadius: 2,
                      }}>{r.requesting_dept}</span>
                    ) : EMPTY}
                  </Td>
                  <Td muted>{r.delivery_location ?? EMPTY}</Td>
                  <Td align="center">
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      letterSpacing: 'var(--ls-extra)',
                      textTransform: 'uppercase',
                      color: PRIORITY_COLORS[r.priority] ?? 'var(--ink-soft)',
                      fontWeight: r.priority === 'urgent' || r.priority === 'high' ? 600 : 400,
                    }}>{r.priority}</span>
                  </Td>
                  <Td align="right" mono>{fmtDate(r.submitted_at)}</Td>
                  <Td align="right" mono>
                    <span style={{ color: isOverdue ? '#8a3026' : undefined }}>{fmtDate(r.needed_by_date)}</span>
                  </Td>
                  <Td align="right" mono>{fmtMoney(r.total_estimated_usd, 'USD')}</Td>
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
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--ink-soft)' }}>No purchase requests in queue.</td></tr>
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
