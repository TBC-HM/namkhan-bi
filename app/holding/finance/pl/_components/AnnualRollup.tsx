// app/holding/finance/pl/_components/AnnualRollup.tsx
// Annual roll-up, mirroring the tenant P&L's "12-month rollup · FY{year}" panel.
//
// Each column is a SEPARATE call to fn_holding_pl_payload for that calendar
// year — the gold layer does the arithmetic, this component only lays it out.
// Years come from the data; nothing here names a year.
//
// Draft revenue is shown on its own line and is never folded into revenue or
// EBITDA, matching the rest of the module.

import { Container } from '@/app/(cockpit)/_design';
import type { HoldingPlPayload } from '../_lib/types';
import { money, num } from '../_lib/format';
import { TABLE, TH, TD, TD_NUM, SCROLL_X, HAIR, INK_M, FOREST, EmptyLine, LayerNote } from './ui';

export interface YearColumn {
  year: string;
  payload: HoldingPlPayload | null;
  error: string | null;
}

export default function AnnualRollup({ columns, currency }: {
  columns: YearColumn[]; currency: string;
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

  const pick = (c: YearColumn, f: (t: HoldingPlPayload['totals']) => unknown): number | null =>
    c.payload ? num(f(c.payload.totals)) : null;

  const rows: Array<{
    label: string;
    get: (c: YearColumn) => number | null;
    strong?: boolean;
    muted?: boolean;
    negate?: boolean;
  }> = [
    { label: 'Revenue (invoiced)', get: (c) => pick(c, (t) => t.revenue_eur) },
    { label: 'Direct cost',        get: (c) => pick(c, (t) => t.direct_cost_eur), negate: true },
    { label: 'Overhead',           get: (c) => pick(c, (t) => t.overhead_eur), negate: true },
    { label: 'EBITDA',             get: (c) => pick(c, (t) => t.ebitda_eur), strong: true },
    { label: 'Not yet invoiced (excluded)', get: (c) => pick(c, (t) => t.revenue_draft_eur), muted: true },
    { label: 'of which estimated cost',     get: (c) => pick(c, (t) => t.estimated_cost_eur), muted: true },
  ];

  const total = (get: (c: YearColumn) => number | null): number =>
    live.reduce((s, c) => s + (get(c) ?? 0), 0);

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container
        title={`Annual roll-up · ${live.map((c) => c.year).join(' · ')}`}
        subtitle="One call to fn_holding_pl_payload per calendar year. Columns are independent; Total is their sum."
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
              {rows.map((r) => (
                <tr key={r.label}>
                  <td style={{
                    ...TD,
                    fontWeight: r.strong ? 700 : 400,
                    color: r.strong ? FOREST : (r.muted ? INK_M : 'inherit'),
                    borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                    whiteSpace: 'nowrap',
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
                    ...TD_NUM, fontWeight: 700,
                    color: FOREST,
                    borderTop: r.strong ? `1px solid ${HAIR}` : undefined,
                  }}>
                    {r.negate ? `(${money(total(r.get), currency)})` : money(total(r.get), currency)}
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
  );
}
