// app/operations/staff/_components/SeniorityDrilldownTable.tsx
//
// PBS 2026-05-16: Per-employee drilldown table — extracted as a client
// component so each row can expand to show extra detail (contract pattern,
// monthly_eur source, indemnización formula breakdown).
//
// Theme fix: uses canonical --tbl-* tokens (--tbl-bg, --tbl-fg,
// --tbl-fg-mute, --tbl-border, --tbl-bg-elev) per the property-scoped page
// rule. Donna's ThemeInjector overrides --tbl-* but NOT --ink-*, so the
// previous render came out black-on-black on Donna.

'use client';

import React, { useState } from 'react';
import type { EmployeeWithSeniority } from '@/lib/hr/seniority';
import { fmtMoneyEur } from '@/lib/hr/seniority';

interface Props {
  rows: EmployeeWithSeniority[];
  isDonna: boolean;
}

export default function SeniorityDrilldownTable({ rows, isDonna }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div style={{
        padding: 14,
        color: 'var(--tbl-fg-mute, #9b907a)',
        fontStyle: 'italic',
        textAlign: 'center',
        fontSize: 'var(--t-sm)',
      }}>
        No active staff loaded.
      </div>
    );
  }

  const headerCells: string[] = ['', 'Employee', 'Dept', 'Position', 'Hire', 'Seniority'];
  if (isDonna) {
    headerCells.push('Monthly €', 'Unfair · 33d/y', 'Objective · 20d/y', 'Fixed-end · 12d/y');
  }
  const colCount = headerCells.length;

  return (
    <div style={{
      overflowX: 'auto',
      padding: '0 14px 14px',
      // canonical table tokens — survive Donna's ThemeInjector
      background: 'var(--tbl-bg, var(--paper, #faf6ec))',
      color: 'var(--tbl-fg, var(--ink, #2a261d))',
    }}>
      <table style={{
        width: '100%',
        fontSize: 'var(--t-sm)',
        borderCollapse: 'collapse',
        color: 'var(--tbl-fg, #2a261d)',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep, #2a261d))' }}>
            {headerCells.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 0 ? 'center' : i >= (isDonna ? 5 : 5) && i !== 1 && i !== 2 && i !== 3 && i !== 4 ? 'right' : 'left',
                  padding: '8px 6px',
                  color: 'var(--tbl-fg-mute, #7d7565)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = expandedId === r.id;
            return (
              <React.Fragment key={r.id}>
                <tr
                  onClick={() => setExpandedId(open ? null : r.id)}
                  style={{
                    borderBottom: '1px solid var(--tbl-border, var(--paper-deep, #2a261d))',
                    cursor: 'pointer',
                    background: open ? 'var(--tbl-bg-elev, var(--paper-warm, #fff8e8))' : 'transparent',
                  }}
                >
                  <td style={{
                    padding: '8px 6px',
                    textAlign: 'center',
                    color: 'var(--tbl-fg-mute, #7d7565)',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    width: 24,
                  }}>
                    {open ? '▾' : '▸'}
                  </td>
                  <td style={{ padding: '8px 6px', fontWeight: 600, color: 'var(--tbl-fg, #2a261d)' }}>
                    {r.full_name_en ?? '—'}
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--tbl-fg-mute, #7d7565)' }}>
                    {r.current_dept_code ?? '—'}
                  </td>
                  <td style={{ padding: '8px 6px', color: 'var(--tbl-fg-mute, #7d7565)' }}>
                    {r.current_position_code ?? '—'}
                  </td>
                  <td style={{ padding: '8px 6px', fontFamily: 'var(--mono)', color: 'var(--tbl-fg-mute, #7d7565)' }}>
                    {r.hire_date ?? '—'}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--tbl-fg, #2a261d)' }}>
                    {r.seniorityLabel}
                  </td>
                  {isDonna && (
                    <>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--tbl-fg, #2a261d)' }}>
                        {r.monthly_eur > 0
                          ? fmtMoneyEur(r.monthly_eur)
                          : <span style={{ color: 'var(--tbl-fg-mute, #7d7565)' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--st-bad, #B23B3B)' }}>
                        {r.indemUnfair ? fmtMoneyEur(r.indemUnfair) : '—'}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--st-warn, #C28F2C)' }}>
                        {r.indemObjective ? fmtMoneyEur(r.indemObjective) : '—'}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--tbl-fg, #2a261d)' }}>
                        {r.indemFixedTermEnd ? fmtMoneyEur(r.indemFixedTermEnd) : '—'}
                      </td>
                    </>
                  )}
                </tr>
                {open && (
                  <tr style={{
                    background: 'var(--tbl-bg-elev, var(--paper-warm, #fff8e8))',
                    borderBottom: '1px solid var(--tbl-border-strong, var(--paper-deep, #2a261d))',
                  }}>
                    <td colSpan={colCount} style={{ padding: '12px 18px' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 12,
                        fontSize: 'var(--t-sm)',
                        color: 'var(--tbl-fg, #2a261d)',
                      }}>
                        <DetailField label="Contract type" value={r.contract_type ?? '—'} />
                        <DetailField label="Seniority (days)" value={`${r.seniorityDays.toLocaleString('en-US')} d`} />
                        <DetailField label="Seniority (years)" value={`${r.seniorityYears.toFixed(2)} y`} />
                        {isDonna && (
                          <>
                            <DetailField
                              label="Daily wage (€/d)"
                              value={r.monthly_eur > 0 ? `€${((r.monthly_eur * 12) / 365).toFixed(2)}` : '—'}
                            />
                            <DetailField
                              label="Indemnización · 33d formula"
                              value={
                                r.monthly_eur > 0
                                  ? `${((r.monthly_eur * 12) / 365).toFixed(2)} × 33 × ${r.seniorityYears.toFixed(2)} (cap 24mo)`
                                  : 'Monthly € not loaded — calc unavailable'
                              }
                            />
                            <DetailField
                              label="Cap at 24 monthly wages"
                              value={r.monthly_eur > 0 ? `€${Math.round(r.monthly_eur * 24).toLocaleString('en-US')}` : '—'}
                            />
                          </>
                        )}
                        {!isDonna && (
                          <DetailField
                            label="Lao law context"
                            value="No statutory seniority indemnización — contract clauses apply."
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '6px 10px',
      background: 'var(--tbl-bg, var(--paper, #faf6ec))',
      border: '1px solid var(--tbl-border, var(--paper-deep, #2a261d))',
      borderRadius: 4,
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--tbl-fg-mute, #7d7565)',
      }}>{label}</div>
      <div style={{
        marginTop: 3,
        fontWeight: 600,
        color: 'var(--tbl-fg, #2a261d)',
      }}>{value}</div>
    </div>
  );
}
