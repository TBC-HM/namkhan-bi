// app/_components/ConclusionBlock.tsx
// PBS 2026-07-06: reusable primitive for "so what does the data actually mean?" blocks.
// Consumers evaluate their domain rules (see lib/rules/*), produce Insight[],
// pass to <ConclusionBlock/>. Colored priorities + evidence + action + optional deep-link.
//
// Meant to be usable on any data-heavy page — retention today, pace/pickup/leakage tomorrow.
// The reason we ship this as a primitive (not one-off): the "so what?" layer is where
// operator judgment lives. Codifying it as rules makes conclusions consistent + reviewable.

import Link from 'next/link';

export type InsightPriority = 'critical' | 'warning' | 'info' | 'positive';

export interface Insight {
  priority: InsightPriority;
  title: string;         // one-line headline
  body: string;          // the "so what"
  evidence?: string;     // supporting numbers
  action?: string;       // recommended next step
  href?: string;         // deep link (button label = action if set)
}

const PRI: Record<InsightPriority, { icon: string; color: string; bg: string; label: string; order: number }> = {
  critical: { icon: '🔴', color: '#B04A2F', bg: '#FFF3F1', label: 'CRITICAL',    order: 0 },
  warning:  { icon: '🟠', color: '#8B5A1C', bg: '#FFF9E6', label: 'WARNING',     order: 1 },
  info:     { icon: '🔵', color: '#1F3A5A', bg: '#EEF2FA', label: 'INFO',        order: 2 },
  positive: { icon: '🟢', color: '#1F5C2C', bg: '#F0F7F2', label: 'OPPORTUNITY', order: 3 },
};

interface Props {
  insights: Insight[];
  title?: string;              // "CONCLUSIONS · retention"
  subtitle?: string;
  emptyText?: string;
  maxRender?: number;          // cap for very long lists
}

export default function ConclusionBlock({ insights, title = 'CONCLUSIONS', subtitle, emptyText = 'No signals to surface right now — targets met.', maxRender = 12 }: Props) {
  const sorted = [...insights].sort((a, b) => PRI[a.priority].order - PRI[b.priority].order);
  const render = sorted.slice(0, maxRender);

  const counts = { critical: 0, warning: 0, info: 0, positive: 0 };
  for (const i of sorted) counts[i.priority]++;

  return (
    <div style={box}>
      <div style={header}>
        <span style={badgePill}>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5A5A5A' }}>
          {sorted.length === 0 ? 'nothing to flag' :
            `${counts.critical} critical · ${counts.warning} warn · ${counts.positive} opp`
          }
        </span>
      </div>

      <div style={{ padding: 12 }}>
        {subtitle && <div style={{ fontSize: 11, color: '#5A5A5A', marginBottom: 10 }}>{subtitle}</div>}

        {render.length === 0 && (
          <div style={{ fontSize: 12, color: '#5A5A5A', padding: '18px 6px', textAlign: 'center', fontStyle: 'italic' }}>
            {emptyText}
          </div>
        )}

        {render.map((ins, i) => {
          const p = PRI[ins.priority];
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px',
              background: p.bg,
              borderLeft: `3px solid ${p.color}`,
              borderRadius: 4,
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 12, marginTop: 1 }}>{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: p.color }}>{p.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B' }}>{ins.title}</span>
                </div>
                <div style={{ fontSize: 12, color: '#3A3A3A', marginTop: 3, lineHeight: 1.55 }}>{ins.body}</div>
                {ins.evidence && (
                  <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 3, fontFamily: 'monospace' }}>{ins.evidence}</div>
                )}
                {ins.action && (
                  <div style={{ marginTop: 6 }}>
                    {ins.href ? (
                      <Link href={ins.href} style={{
                        display: 'inline-block', padding: '4px 10px',
                        background: p.color, color: '#FFFFFF',
                        fontSize: 11, fontWeight: 600, borderRadius: 3, textDecoration: 'none',
                      }}>→ {ins.action}</Link>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: p.color }}>→ {ins.action}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sorted.length > render.length && (
          <div style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>
            + {sorted.length - render.length} more · showing top {render.length}
          </div>
        )}
      </div>
    </div>
  );
}

const box: React.CSSProperties = { border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF', overflow: 'hidden' };
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' };
const badgePill: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#FFFFFF', background: '#1B1B1B', borderRadius: 99 };
