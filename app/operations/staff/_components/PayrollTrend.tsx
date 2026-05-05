// app/operations/staff/_components/PayrollTrend.tsx
// 4-month payroll trend strip — USD primary with LAK in small parens.
// Surfaces missing months as dashed "Data needed" panels so the import gap
// (Jan/Feb 2026) doesn't hide silently.

import { fmtTableUsd, EMPTY } from '@/lib/format';
import StatusPill from '@/components/ui/StatusPill';

export type PayrollTrendRow = {
  period_month: string;
  headcount: number;
  total_grand_usd: number;
  total_net_lak: number;
  total_sc_lak: number;
  total_allow_lak: number;
};

interface Props {
  windowMonths: string[];
  data: PayrollTrendRow[];
  /** LAK per USD for the secondary display. */
  fx: number;
}

function fmtPeriod(iso: string): string {
  const [y, m] = iso.split('-');
  const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1];
  return `${monthName} ${y}`;
}

function fmtLakSmall(n: number): string {
  if (!n || n === 0) return '';
  if (Math.abs(n) >= 1_000_000_000) return `₭${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000)     return `₭${Math.round(n / 1_000_000)}M`;
  return `₭${Math.round(n / 1_000).toLocaleString()}k`;
}

export default function PayrollTrend({ windowMonths, data, fx }: Props) {
  const map = new Map(data.map(r => [r.period_month, r]));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${windowMonths.length}, 1fr)`, gap: 12 }}>
      {windowMonths.map((p) => {
        const row = map.get(p);
        const missing = !row;
        const benefits = row ? Number(row.total_sc_lak ?? 0) + Number(row.total_allow_lak ?? 0) : 0;
        const grandUsd = row ? Number(row.total_grand_usd) : 0;
        const totalLak = grandUsd * fx;
        return (
          <div
            key={p}
            className="panel"
            style={{
              padding: '12px 14px',
              borderStyle: missing ? 'dashed' : 'solid',
              opacity: missing ? 0.85 : 1,
            }}
          >
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              marginBottom: 6,
            }}>
              {fmtPeriod(p)}
            </div>
            <div style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-2xl)',
              color: missing ? 'var(--ink-faint)' : 'var(--ink)',
              lineHeight: 1.05,
            }}>
              {missing ? EMPTY : fmtTableUsd(grandUsd)}
              {!missing && (
                <span style={{
                  marginLeft: 8,
                  fontFamily: 'var(--mono)',
                  fontStyle: 'normal',
                  fontSize: 'var(--t-xs)',
                  color: 'var(--ink-mute)',
                  letterSpacing: 0,
                }}>
                  ({fmtLakSmall(totalLak)})
                </span>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', lineHeight: 1.5 }}>
              {missing ? (
                <span>
                  No payroll on file
                  <span style={{ marginLeft: 8 }}>
                    <StatusPill tone="pending">Data needed</StatusPill>
                  </span>
                </span>
              ) : (
                <>
                  Benefits {fmtLakSmall(benefits) || '—'} · {row.headcount} paid
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
