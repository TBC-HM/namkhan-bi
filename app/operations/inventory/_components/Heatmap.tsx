// app/operations/inventory/_components/Heatmap.tsx
// Server component — pure markup, no event handlers.
// Renders a category × location grid colored by stock health.

import type { HeatmapCell } from '../_data';

interface Props {
  cells: HeatmapCell[];
}

const HEALTH_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  ok:        { bg: '#dcebe0', fg: '#2f6f3a', label: 'OK' },
  low:       { bg: '#fbecc4', fg: '#7d5a18', label: 'LOW' },
  out:       { bg: '#f5d4d0', fg: '#8a3026', label: 'OUT' },
  overstock: { bg: '#d6e6f1', fg: '#1f4f6e', label: 'OVR' },
  empty:     { bg: 'transparent', fg: 'var(--ink-faint)', label: '—' },
};

export default function Heatmap({ cells }: Props) {
  const cats = Array.from(new Map(cells.map(c => [c.category_code, c.category_name])).entries());
  const locs = Array.from(new Map(cells.map(c => [c.location_code, c.location_name])).entries());
  const cellMap = new Map<string, HeatmapCell>();
  cells.forEach(c => cellMap.set(`${c.category_code}::${c.location_code}`, c));

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--rule, #e3dfd3)', background: 'var(--paper, #fbf9f3)' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 'var(--t-xs)' }}>
        <thead>
          <tr>
            <th style={{
              padding: '8px 10px',
              textAlign: 'left',
              fontFamily: 'var(--mono)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--ls-extra)',
              color: 'var(--brass)',
              borderBottom: '1px solid var(--rule, #e3dfd3)',
              background: 'var(--paper-deep, #f6f3ec)',
            }}>Category \\ Location</th>
            {locs.map(([code, name]) => (
              <th key={code} style={{
                padding: '8px 6px',
                textAlign: 'center',
                fontFamily: 'var(--mono)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-extra)',
                color: 'var(--brass)',
                fontSize: 'var(--t-xs)',
                borderBottom: '1px solid var(--rule, #e3dfd3)',
                background: 'var(--paper-deep, #f6f3ec)',
                whiteSpace: 'nowrap',
              }} title={name}>{code.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map(([catCode, catName]) => (
            <tr key={catCode}>
              <td style={{
                padding: '6px 10px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-soft)',
                borderBottom: '1px solid var(--rule, #e3dfd3)',
                whiteSpace: 'nowrap',
              }} title={catName}>{catCode}</td>
              {locs.map(([locCode]) => {
                const c = cellMap.get(`${catCode}::${locCode}`);
                const health = c?.health ?? 'empty';
                const colors = HEALTH_COLORS[health];
                return (
                  <td key={locCode} style={{
                    padding: '6px 4px',
                    textAlign: 'center',
                    background: colors.bg,
                    color: colors.fg,
                    borderBottom: '1px solid var(--rule, #e3dfd3)',
                    fontFamily: 'var(--mono)',
                    fontSize: 'var(--t-xs)',
                    fontWeight: health === 'out' || health === 'low' ? 600 : 400,
                  }}
                  title={`${catName} @ ${c?.location_name ?? ''}: ${c?.item_count ?? 0} items, status: ${colors.label}`}>
                    {health === 'empty' ? '—' : `${c?.item_count ?? 0}`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--rule, #e3dfd3)',
        background: 'var(--paper-deep, #f6f3ec)',
        display: 'flex',
        gap: 16,
        fontSize: 'var(--t-xs)',
        color: 'var(--ink-soft)',
      }}>
        <Legend bg={HEALTH_COLORS.ok.bg} fg={HEALTH_COLORS.ok.fg} label="OK" />
        <Legend bg={HEALTH_COLORS.low.bg} fg={HEALTH_COLORS.low.fg} label="Below par" />
        <Legend bg={HEALTH_COLORS.out.bg} fg={HEALTH_COLORS.out.fg} label="Out of stock" />
        <Legend bg={HEALTH_COLORS.overstock.bg} fg={HEALTH_COLORS.overstock.fg} label="Overstock" />
        <Legend bg="transparent" fg="var(--ink-faint)" label="No items mapped" />
      </div>
    </div>
  );
}

function Legend({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 14, height: 12, background: bg, border: '1px solid var(--rule, #e3dfd3)' }} />
      <span style={{ color: fg }}>{label}</span>
    </span>
  );
}
