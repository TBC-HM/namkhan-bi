// app/finance/_components/AgedArChart.tsx
// Bucketed AR aging — wired from mv_aged_ar. No invented numbers.

import { fmtMoney } from '@/lib/format';

export interface AgedRow {
  bucket: string;
  open_balance: number | null;
}

interface Props {
  rows: AgedRow[];
  title?: string;
  sub?: string;
}

const BUCKET_ORDER = ['current', '1_30', '31_60', '61_90', '90_plus'];
const BUCKET_LABEL: Record<string, string> = {
  current: 'Current',
  '1_30': '1–30d',
  '31_60': '31–60d',
  '61_90': '61–90d',
  '90_plus': '90+ d',
};
const BUCKET_COLOR: Record<string, string> = {
  current: 'var(--moss)',
  '1_30':   'var(--moss-glow)',
  '31_60':  'var(--brass-soft)',
  '61_90':  'var(--brass)',
  '90_plus': 'var(--st-bad)',
};

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
  borderRadius: 8, padding: '14px 16px', minHeight: 220,
};
const TITLE: React.CSSProperties = { fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2 };
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function AgedArChart({ rows, title = 'AR aging', sub = 'Open balance by bucket · USD' }: Props) {
  const totals: Record<string, number> = {};
  for (const r of rows) {
    if (!r.bucket) continue;
    totals[r.bucket] = (totals[r.bucket] ?? 0) + Number(r.open_balance ?? 0);
  }
  const ordered = BUCKET_ORDER.map((b) => ({ bucket: b, value: totals[b] ?? 0 }));
  const total = ordered.reduce((s, r) => s + r.value, 0);

  return (
    <div style={CARD}>
      <div style={TITLE}>{title}</div>
      <div style={SUB}>{sub}</div>
      {total === 0 ? (
        <div
          style={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            fontSize: 'var(--t-sm)',
          }}
        >
          AR is clear — no open balances.
        </div>
      ) : (
        <Chart rows={ordered} total={total} />
      )}
    </div>
  );
}

function Chart({ rows, total }: { rows: { bucket: string; value: number }[]; total: number }) {
  const w = 320, h = 200, padL = 4, padR = 86, padT = 6, padB = 6;
  const lineH = 28;
  const innerW = w - padL - padR;
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200 }}>
      {rows.map((r, i) => {
        const y = padT + i * (lineH + 4);
        const wPx = (r.value / max) * innerW;
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        return (
          <g key={r.bucket}>
            <rect x={padL} y={y} width={innerW} height={lineH} fill="var(--paper-deep)" />
            <rect x={padL} y={y} width={wPx} height={lineH} fill={BUCKET_COLOR[r.bucket]}>
              <title>{`${BUCKET_LABEL[r.bucket]} · ${fmtMoney(r.value, 'USD')} · ${pct.toFixed(0)}%`}</title>
            </rect>
            <text
              x={padL + 6}
              y={y + lineH / 2 + 4}
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--paper-warm)', fontWeight: 600 }}
            >
              {BUCKET_LABEL[r.bucket]}
            </text>
            <text
              x={w - padR + 4}
              y={y + lineH / 2 + 4}
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)', fontWeight: 600 }}
            >
              {fmtMoney(r.value, 'USD')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
