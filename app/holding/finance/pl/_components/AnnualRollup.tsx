// app/holding/finance/pl/_components/AnnualRollup.tsx
// Annual roll-up, mirroring the tenant P&L's "12-month rollup · FY{year}".
//
// PBS 2026-09-10: was a single total per year, which is not a roll-up — you
// cannot see seasonality, a step-up in fees, or which month a cost landed in.
// Now every year renders MONTH BY MONTH with a FY total footer, and the
// year-versus-year comparison is kept above it as a summary.
//
// Each year is a SEPARATE fn_holding_pl_payload call for that calendar year, so
// the gold layer does the arithmetic per column. The month rows come from that
// payload's own by_month — this file never re-aggregates and never invents a
// month that carries no posting.
//
// Draft revenue stays on its own line and is never folded into revenue or EBITDA.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload, PlLineRow } from '../_lib/types';
import { money, num, monthLabel } from '../_lib/format';
import { TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST, EmptyLine, LayerNote } from './ui';
import PlMatrix from './PlMatrix';

export interface YearColumn {
  year: string;
  payload: HoldingPlPayload | null;
  error: string | null;
}

/** EBITDA for one month row, from the payload's own figures. */
function monthEbitda(m: { revenue_eur: number; direct_cost_eur: number; overhead_eur: number }): number {
  return (num(m.revenue_eur) ?? 0) - (num(m.direct_cost_eur) ?? 0) - (num(m.overhead_eur) ?? 0);
}

export default function AnnualRollup({ columns, currency, lines }: {
  columns: YearColumn[]; currency: string;
  /** All P&L lines for the full period; each year filters its own slice. */
  lines: PlLineRow[];
}) {
  const live = columns.filter((c) => c.payload);

  if (live.length === 0) {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Annual roll-up" density="compact">
          <EmptyLine what="No year returned a payload. Nothing to roll up." />
        </Container>
      </div>
    );
  }

  const t = (c: YearColumn, k: 'revenue_eur' | 'direct_cost_eur' | 'overhead_eur' | 'ebitda_eur' | 'revenue_draft_eur' | 'estimated_cost_eur') =>
    c.payload ? num(c.payload.totals[k]) : null;

  const summaryRows: Array<{
    label: string;
    get: (c: YearColumn) => number | null;
    strong?: boolean; muted?: boolean; negate?: boolean;
  }> = [
    { label: 'Revenue (invoiced)', get: (c) => t(c, 'revenue_eur') },
    { label: 'Direct cost',        get: (c) => t(c, 'direct_cost_eur'), negate: true },
    { label: 'Overhead',           get: (c) => t(c, 'overhead_eur'), negate: true },
    { label: 'EBITDA',             get: (c) => t(c, 'ebitda_eur'), strong: true },
    { label: 'Not yet invoiced (excluded)', get: (c) => t(c, 'revenue_draft_eur'), muted: true },
    { label: 'of which estimated cost',     get: (c) => t(c, 'estimated_cost_eur'), muted: true },
  ];

  const grand = (get: (c: YearColumn) => number | null): number =>
    live.reduce((s, c) => s + (get(c) ?? 0), 0);

  return (
    <>
      {/* Year-versus-year summary */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title={`Annual roll-up · ${live.map((c) => c.year).join(' vs ')}`}
          subtitle="One fn_holding_pl_payload call per calendar year. Total is the sum of the year columns."
          density="compact"
        >
          <div style={SCROLL_X}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>&nbsp;</th>
                  {columns.map((c) => (
                    <th key={c.year} style={{ ...TH, textAlign: 'right' }}>
                      FY {c.year}{c.error ? ' · error' : ''}
                    </th>
                  ))}
                  <th style={{ ...TH, textAlign: 'right', color: FOREST }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={r.label}>
                    <td style={{
                      ...TD, whiteSpace: 'nowrap',
                      fontWeight: r.strong ? 700 : 400,
                      color: r.strong ? FOREST : (r.muted ? INK_M : 'inherit'),
                      borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                    }}>{r.label}</td>
                    {columns.map((c) => {
                      const v = r.get(c);
                      return (
                        <td key={c.year} style={{
                          ...TD_NUM,
                          fontWeight: r.strong ? 700 : 400,
                          color: r.strong ? FOREST : (r.muted ? INK_M : 'inherit'),
                          borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                        }}>
                          {c.payload
                            ? (r.negate && (v ?? 0) !== 0 ? `(${money(v, currency)})` : money(v, currency))
                            : '—'}
                        </td>
                      );
                    })}
                    <td style={{
                      ...TD_NUM, fontWeight: 700, color: FOREST,
                      borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                    }}>
                      {r.negate ? `(${money(grand(r.get), currency)})` : money(grand(r.get), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {columns.some((c) => c.error) && (
            <div style={{ fontSize: 11, color: '#8C3B2E', marginTop: 8 }}>
              {columns.filter((c) => c.error).map((c) => `FY ${c.year}: ${c.error}`).join(' · ')}
            </div>
          )}
          <LayerNote currency={currency} />
        </Container>
      </div>

      {/* Month-by-month, per year — months ACROSS, accounts down, subtotals in
          between and EBITDA at the foot. PBS 2026-09-10: was months-down with
          department aggregates only, which cannot be read as a P&L. */}
      {live.map((c) => {
        const yearLines = lines.filter((l) => l.period_yyyymm.startsWith(c.year));
        return (
          <div key={c.year} style={{ gridColumn: '1 / -1' }}>
            <Container
              title={`FY ${c.year} · month by month`}
              subtitle={`Every revenue and cost account, months across the top · ${currency} reporting layer`}
              density="compact"
            >
              {yearLines.length === 0 ? (
                <EmptyLine what={`FY ${c.year} has no posting to lay out.`} />
              ) : (
                <PlMatrix lines={yearLines} currency={currency} dense />
              )}
              <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
                A blank cell means nothing was booked to that account that month —
                it is not a zero. Draft revenue is excluded and shown on Overview.
              </div>
            </Container>
          </div>
        );
      })}
    </>
  );
}
