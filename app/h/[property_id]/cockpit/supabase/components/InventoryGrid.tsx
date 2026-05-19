// Section-grouped tile grid. Preserves first-appearance order of group keys
// in the underlying data (e.g. Revenue, Occupancy, Pace, ...). Sort within a
// group is by `code` — KPIs use numeric sort so #2 < #10.

import type { InventoryRow, TabKey } from '../lib/types';
import InventoryTile from './InventoryTile';

function groupKey(row: InventoryRow, kind: TabKey): string {
  if (kind === 'container') return row.page_slug ?? row.section ?? 'other';
  return row.section ?? 'other';
}

function compareCodes(a: InventoryRow, b: InventoryRow): number {
  if (a.kind === 'kpi' && b.kind === 'kpi') {
    const ai = Number(a.code);
    const bi = Number(b.code);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
  }
  return a.code.localeCompare(b.code);
}

export default function InventoryGrid({
  rows,
  kind,
}: {
  rows: InventoryRow[];
  kind: TabKey;
}) {
  if (rows.length === 0) {
    return (
      <div style={S.empty}>
        Nothing here yet — adjust filters or insert new registry rows.
      </div>
    );
  }

  // Build groups in first-appearance order to keep visual stability across renders.
  const order: string[] = [];
  const groups = new Map<string, InventoryRow[]>();
  for (const row of rows) {
    const k = groupKey(row, kind);
    if (!groups.has(k)) {
      groups.set(k, []);
      order.push(k);
    }
    groups.get(k)!.push(row);
  }

  return (
    <div style={S.wrap}>
      {order.map((key) => {
        const items = (groups.get(key) ?? []).slice().sort(compareCodes);
        const wired = items.filter((r) => r.status_color === 'green').length;
        const notWired = items.filter((r) => r.status_color === 'red').length;
        const partial = items.filter((r) => r.status_color === 'amber').length;
        return (
          <section key={key} style={S.section}>
            <header style={S.groupHeader}>
              <span style={S.groupName}>{key}</span>
              <span style={S.groupCount}>({items.length})</span>
              <span style={S.groupSplit}>
                {wired} wired · {notWired} not wired
                {partial > 0 ? ` · ${partial} partial` : ''}
              </span>
            </header>
            <div style={S.grid}>
              {items.map((r) => (
                <InventoryTile key={`${r.kind}:${r.code}`} row={r} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 32 },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  groupHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    paddingBottom: 6,
    borderBottom: '1px solid var(--line-soft, rgba(251, 246, 233, 0.15))',
  },
  groupName: {
    fontFamily: 'var(--serif, "Fraunces", Georgia, serif)',
    fontStyle: 'italic',
    fontSize: 18,
    fontWeight: 500,
    color: 'var(--ink, #fbf6e9)',
    textTransform: 'capitalize',
  },
  groupCount: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 11,
    color: 'var(--ink-mute, #cfc3a3)',
  },
  groupSplit: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 10,
    color: 'var(--ink-faint, #a59a7d)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginLeft: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 12,
  },
  empty: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    border: '1px dashed var(--line-soft, rgba(251, 246, 233, 0.15))',
    borderRadius: 8,
    color: 'var(--ink-mute, #cfc3a3)',
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 12,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
};
