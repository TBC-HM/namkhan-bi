// app/holding/finance/pl/_components/DataQualityPanel.tsx
// Renders payload.data_quality verbatim. Brief holding-pl-v1 v2: "Show the
// data_quality block on the page. This data is a manual reconstruction, not a
// system export." Every string here comes from the RPC.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload } from '../_lib/types';
import { count, money, dateLabel } from '../_lib/format';
import { HAIR, INK_M, RUST, Flag } from './ui';

export default function DataQualityPanel({ p }: { p: HoldingPlPayload }) {
  const dq = p.data_quality;
  const rows: Array<{ k: string; v: React.ReactNode }> = [
    { k: 'Source', v: dq.source },
    {
      k: 'Period scope',
      v: 'Revenue, cost, departments and months follow the period filter. Receivables, cash collected and the estimate count below are entity-to-date and do not.',
    },
    { k: 'FX basis', v: dq.fx_basis },
    {
      k: 'Estimated cost lines',
      v: (
        <span>
          {count(dq.estimated_cost_lines)}
          {' '}
          <Flag tone="estimate">estimate</Flag>
          {' — '}
          {money(p.totals.estimated_cost_eur, p.reporting_currency, 2)}
          {' included in cost above'}
        </span>
      ),
    },
    {
      k: 'Cash-basis cost',
      v: dq.no_cash_basis_cost
        ? 'Not available. Collected is cash IN only — it is not a cash-basis P&L.'
        : 'Available.',
    },
    { k: 'Basis', v: p.basis },
    { k: 'Reporting layer', v: p.reporting_currency },
    { k: 'Generated', v: dateLabel(p.generated_at) },
  ];

  return (
    <Container
      title="Data quality"
      subtitle="Read this before quoting a figure from this page."
      density="compact"
      status="amber"
    >
      <div style={{
        border: `1px solid ${RUST}33`, borderLeft: `3px solid ${RUST}`,
        padding: '8px 12px', marginBottom: 10, fontSize: 12, color: RUST,
        background: '#FDF6F4',
      }}>
        Receivables are shown at full carrying value. No impairment, no
        provision and no recovery estimate is applied, by owner instruction.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k}>
              <td style={{
                padding: '6px 10px 6px 0', fontSize: 11, color: INK_M,
                textTransform: 'uppercase', letterSpacing: '.05em',
                fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top',
                borderBottom: `1px solid ${HAIR}55`, width: '1%',
              }}>{r.k}</td>
              <td style={{
                padding: '6px 0', fontSize: 12,
                borderBottom: `1px solid ${HAIR}55`,
              }}>{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Container>
  );
}
