// app/operations/inventory/capex/page.tsx
// CapEx pipeline — fa.capex_pipeline.

import Page from '@/components/page/Page';
import { OPERATIONS_SUBPAGES } from '../../_subpages';
import { fmtMoney, fmtDate, fmtPct, EMPTY } from '@/lib/format';
import { getCapexPipeline } from '../_data';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  proposed:     { bg: '#eee9d8', fg: '#6c5d2a' },
  under_review: { bg: '#fbecc4', fg: '#7d5a18' },
  approved:     { bg: '#dcebe0', fg: '#2f6f3a' },
  ordered:      { bg: '#d6e6f1', fg: '#1f4f6e' },
  received:     { bg: '#dcebe0', fg: '#2f6f3a' },
  rejected:     { bg: '#f5d4d0', fg: '#8a3026' },
  cancelled:    { bg: '#f5d4d0', fg: '#8a3026' },
};

export default async function CapexPipelinePage() {
  const rows = await getCapexPipeline();

  const proposed = rows.filter(r => ['proposed','under_review'].includes(r.status));
  const approved = rows.filter(r => r.status === 'approved');
  const closed   = rows.filter(r => ['ordered','received','rejected','cancelled'].includes(r.status));

  const sum = (arr: typeof rows) => arr.reduce((s, r) => s + (r.estimated_cost_usd ?? 0), 0);

  return (
    <Page
      eyebrow="Operations · Inventory · CapEx"
      title={<>CapEx <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>pipeline</em></>}
      subPages={OPERATIONS_SUBPAGES}
    >

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginTop: 18,
        marginBottom: 24,
      }}>
        <Stat label="Total proposed"    value={fmtMoney(sum(proposed), 'USD')} sub={`${proposed.length} items`} />
        <Stat label="Total approved"    value={fmtMoney(sum(approved), 'USD')} sub={`${approved.length} items`} />
        <Stat label="Total in pipeline" value={fmtMoney(sum(rows.filter(r => !['rejected','cancelled'].includes(r.status))), 'USD')} sub={`${rows.filter(r => !['rejected','cancelled'].includes(r.status)).length} active`} />
        <Stat label="Closed/rejected"   value={fmtMoney(sum(closed), 'USD')} sub={`${closed.length} archived`} />
      </div>

      <div style={{ border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--paper-deep, #f6f3ec)' }}>
              <Th>Code</Th>
              <Th>Title</Th>
              <Th>Category</Th>
              <Th align="center">Period</Th>
              <Th align="right">Cost</Th>
              <Th align="right">IRR</Th>
              <Th align="right">Payback</Th>
              <Th align="right">Proposed</Th>
              <Th align="center">Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const col = STATUS_COLORS[r.status] ?? { bg: 'var(--paper-deep)', fg: 'var(--ink-soft)' };
              return (
                <tr key={r.capex_code ?? r.title} style={{ borderBottom: '1px solid var(--rule, #e3dfd3)' }}>
                  <Td><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.capex_code ?? EMPTY}</span></Td>
                  <Td>{r.title}</Td>
                  <Td muted><span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.category_code ?? EMPTY}</span></Td>
                  <Td align="center" mono>FY{r.fiscal_year}{r.fiscal_quarter ? ` Q${r.fiscal_quarter}` : ''}</Td>
                  <Td align="right" mono>{fmtMoney(r.estimated_cost_usd, 'USD')}</Td>
                  <Td align="right" mono>{r.expected_irr_pct != null ? fmtPct(r.expected_irr_pct, 0) : EMPTY}</Td>
                  <Td align="right" mono>{r.payback_months != null ? `${r.payback_months}mo` : EMPTY}</Td>
                  <Td align="right" mono>{fmtDate(r.proposed_at)}</Td>
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
              <tr><td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: 'var(--ink-soft)' }}>No capex proposals yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
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
      {sub && <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{sub}</div>}
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
