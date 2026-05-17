// app/finance/banks/_components/CoverageMatrixExpandable.tsx
//
// PBS 2026-05-16: same heatmap visual as the old CoverageMatrixCompact, but
// each account row is now click-expandable to a detail panel listing every
// month with state (has_data, txn_count, inflow_usd, outflow_usd, net_usd)
// + a flagged callout for the missing months. Per-row totals (YTD in/out/net)
// computed from the cells.
//
// Wired to `public.v_bank_coverage_matrix`. The expand toggle lives on the
// left-most cell (▸/▾). Heatmap colour scale unchanged so the at-a-glance
// "where is data missing" read still holds for non-expanded mode.

'use client';

import React, { useState } from 'react';
import type { CoverageCell } from '@/lib/data-banks-cfo';

interface Props {
  months: string[];
  accountOrder: string[];
  accountMeta: Record<string, { bank_name: string; currency: string }>;
  byAccount: Record<string, CoverageCell[]>;
  missingByAccount: Record<string, string[]>;
}

function fmtUsdK(n: number): string {
  if (!isFinite(n) || n === 0) return '—';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(1)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

function fmtMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  try {
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  } catch {
    return yyyymm;
  }
}

export default function CoverageMatrixExpandable({
  months, accountOrder, accountMeta, byAccount, missingByAccount,
}: Props) {
  const [expandedAcct, setExpandedAcct] = useState<string | null>(null);
  const colCount = months.length + 4; // toggle + label + months + miss + request

  return (
    <div style={{ overflowX: 'auto', padding: 4 }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 10, lineHeight: 1.15 }}>
        <thead>
          <tr>
            <th style={{ ...thCompact('center'), width: 20 }}></th>
            <th style={{ ...thCompact('left'), minWidth: 100 }}>Account</th>
            {months.map((m) => (
              <th key={m} style={{ ...thCompact('center'), minWidth: 22 }}>{m.slice(5)}</th>
            ))}
            <th style={thCompact('right')}>Miss</th>
            <th style={thCompact('center')}>Request</th>
          </tr>
        </thead>
        <tbody>
          {accountOrder.map((acct) => {
            const meta = accountMeta[acct];
            const cells = byAccount[acct];
            const miss = missingByAccount[acct];
            const open = expandedAcct === acct;

            const totalIn  = cells.reduce((s, c) => s + (c.inflow_usd || 0), 0);
            const totalOut = cells.reduce((s, c) => s + (c.outflow_usd || 0), 0);
            const totalNet = cells.reduce((s, c) => s + (c.net_usd || 0), 0);
            const totalTxn = cells.reduce((s, c) => s + (c.txn_count || 0), 0);

            return (
              <React.Fragment key={acct}>
                <tr
                  onClick={() => setExpandedAcct(open ? null : acct)}
                  style={{
                    cursor: 'pointer',
                    background: open ? 'var(--paper-warm, rgba(168,133,74,0.06))' : 'transparent',
                  }}
                >
                  <td style={{
                    padding: '2px 4px', textAlign: 'center',
                    fontFamily: 'var(--mono)', fontSize: 11,
                    color: open ? 'var(--brass)' : 'var(--ink-mute, #7d7565)',
                    fontWeight: 600,
                  }}>
                    {open ? '▾' : '▸'}
                  </td>
                  <td style={{
                    padding: '2px 8px 2px 4px',
                    fontFamily: 'var(--mono)', fontWeight: 600,
                    whiteSpace: 'nowrap', fontSize: 11,
                  }}>
                    <strong>{meta.bank_name}</strong>·{meta.currency}
                  </td>
                  {cells.map((c) => (
                    <td key={c.period_yyyymm}
                      title={c.has_data
                        ? `${meta.bank_name} ${meta.currency} · ${c.period_yyyymm} · ${c.txn_count} txns · in ${fmtUsdK(c.inflow_usd)} · out ${fmtUsdK(c.outflow_usd)}`
                        : `${meta.bank_name} ${meta.currency} · ${c.period_yyyymm} · NO DATA`}
                      style={{
                        width: 18, height: 14, padding: 0, textAlign: 'center',
                        background: c.has_data
                          ? `rgba(45,106,79,${Math.min(0.25 + (c.txn_count / 100), 0.9)})`
                          : 'rgba(178,59,59,0.10)',
                        color: c.has_data ? '#fff' : 'transparent',
                        border: '1px solid var(--paper-deep)',
                        fontFamily: 'var(--mono)', fontSize: 9,
                      }}>
                      {c.has_data ? '·' : ''}
                    </td>
                  ))}
                  <td style={{
                    padding: '2px 6px', textAlign: 'right',
                    fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 11,
                    color: miss.length > 0 ? 'var(--st-bad, #B23B3B)' : 'var(--moss, #2D6A4F)',
                  }}>
                    {miss.length}
                  </td>
                  <td style={{ padding: '0 4px', textAlign: 'center' }}>
                    {miss.length > 0
                      ? <span title="Click row to expand details + ✉ in detail panel"
                              style={{ color: 'var(--st-bad, #B23B3B)', fontSize: 11 }}>✉</span>
                      : <span style={{ color: 'var(--moss, #2D6A4F)' }}>✓</span>}
                  </td>
                </tr>
                {open && (
                  <tr style={{ background: 'var(--paper-warm, rgba(168,133,74,0.06))' }}>
                    <td colSpan={colCount} style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                        <Pill label="Inflow · all months"  value={fmtUsdK(totalIn)}  tone="good" />
                        <Pill label="Outflow · all months" value={fmtUsdK(totalOut)} tone="bad" />
                        <Pill label="Net · all months"     value={fmtUsdK(totalNet)} tone={totalNet >= 0 ? 'good' : 'bad'} />
                        <Pill label="Transactions"         value={totalTxn.toString()} />
                        <Pill label="Months covered"       value={`${cells.length - miss.length}/${cells.length}`} tone={miss.length === 0 ? 'good' : 'warn'} />
                      </div>

                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--paper-deep)' }}>
                              <th style={{ textAlign: 'left',  padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Month</th>
                              <th style={{ textAlign: 'center', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>State</th>
                              <th style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Txns</th>
                              <th style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Inflow</th>
                              <th style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Outflow</th>
                              <th style={{ textAlign: 'right', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-mute, #7d7565)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Net</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cells.map((c) => (
                              <tr key={c.period_yyyymm} style={{ borderBottom: '1px solid var(--paper-deep)' }}>
                                <td style={{ padding: '3px 8px', fontFamily: 'var(--mono)' }}>{fmtMonthLabel(c.period_yyyymm)}</td>
                                <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                                  {c.has_data
                                    ? <span style={{ color: 'var(--moss, #2D6A4F)' }}>● loaded</span>
                                    : <span style={{ color: 'var(--st-bad, #B23B3B)' }}>○ missing</span>}
                                </td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{c.txn_count || '—'}</td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: c.inflow_usd > 0 ? 'var(--moss, #2D6A4F)' : 'var(--ink-mute, #7d7565)' }}>
                                  {fmtUsdK(c.inflow_usd)}
                                </td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: c.outflow_usd < 0 ? 'var(--st-bad, #B23B3B)' : 'var(--ink-mute, #7d7565)' }}>
                                  {fmtUsdK(c.outflow_usd)}
                                </td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmtUsdK(c.net_usd)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {miss.length > 0 && (
                        <div style={{
                          marginTop: 10, padding: '8px 10px',
                          background: 'rgba(178,59,59,0.08)',
                          border: '1px solid rgba(178,59,59,0.3)',
                          borderRadius: 4, fontSize: 11,
                          color: 'var(--st-bad, #B23B3B)',
                        }}>
                          <strong>{miss.length} months missing for {meta.bank_name} {meta.currency}:</strong>{' '}
                          {miss.map(fmtMonthLabel).join(' · ')}
                          <a
                            href={`mailto:fc@thenamkhan.com?subject=${encodeURIComponent(`Bank statement request · ${meta.bank_name} ${meta.currency} · ${miss.length} months missing`)}&body=${encodeURIComponent(`Hi FC,\n\nPlease share the missing bank statements for ${meta.bank_name} ${meta.currency}:\n\n${miss.map(fmtMonthLabel).map(m => `- ${m}`).join('\n')}\n\nThanks,\nPBS`)}`}
                            style={{ marginLeft: 12, color: 'var(--st-bad, #B23B3B)', fontWeight: 700 }}
                          >
                            ✉ Email FC →
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-mute, #7d7565)' }}>
        🟩 loaded · 🟥 missing · click any row to expand per-month detail + email FC the missing months.
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  const accent = tone === 'good' ? 'var(--moss, #2D6A4F)'
    : tone === 'bad' ? 'var(--st-bad, #B23B3B)'
    : tone === 'warn' ? 'var(--st-warn, #C28F2C)'
    : 'var(--brass)';
  return (
    <div style={{
      padding: '6px 10px',
      background: 'var(--paper, #faf6ec)',
      border: '1px solid var(--paper-deep)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 4,
    }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-mute, #7d7565)',
      }}>{label}</div>
      <div style={{ marginTop: 2, fontWeight: 600, fontSize: 13, color: accent }}>{value}</div>
    </div>
  );
}

function thCompact(align: 'left' | 'right' | 'center'): React.CSSProperties {
  return {
    textAlign: align,
    padding: '4px 6px',
    fontFamily: 'var(--mono)',
    fontSize: 9,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--ink-mute, #7d7565)',
    fontWeight: 600,
    borderBottom: '1px solid var(--paper-deep)',
  };
}
