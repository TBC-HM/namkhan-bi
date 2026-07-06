'use client';
// app/_components/ConclusionBlock.tsx
// PBS 2026-07-06 v2: 2-column-ready · dismissable · deep-link to /guest/behaviour/insight/[key].
// Modern layout — no colored card backgrounds, just a priority pill + hairline border.
// Dismissed insights are hidden client-side and persisted in localStorage.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

export type InsightPriority = 'critical' | 'warning' | 'info' | 'positive' | 'observation';

export interface Insight {
  key?: string;                // stable id — used for dismiss + drilldown
  priority: InsightPriority;
  title: string;
  body: string;
  evidence?: string;
  action?: string;
  href?: string;               // full url, wins over insightKey
  insightKey?: string;         // shortcut: renders → /guest/behaviour/insight/{insightKey}
  guardrail?: 'dynamic' | 'fixed';  // is the threshold data-driven or hardcoded?
}

const PRI: Record<InsightPriority, { dot: string; label: string; order: number }> = {
  critical:    { dot: '#B04A2F', label: 'CRITICAL',    order: 0 },
  warning:     { dot: '#8B5A1C', label: 'WARNING',     order: 1 },
  info:        { dot: '#1F3A5A', label: 'INFO',        order: 2 },
  observation: { dot: '#5A5A5A', label: 'OBSERVATION', order: 3 },
  positive:    { dot: '#1F5C2C', label: 'OPPORTUNITY', order: 4 },
};

function insightSig(i: Insight): string {
  return i.key ?? `${i.priority}::${i.title}`;
}

interface Props {
  insights: Insight[];
  title?: string;
  subtitle?: string;
  emptyText?: string;
  maxRender?: number;
  storageKey?: string;   // scope dismiss state per block (e.g. "behaviour_signals")
}

export default function ConclusionBlock({
  insights,
  title = 'CONCLUSIONS',
  subtitle,
  emptyText = 'Nothing to flag right now — targets met.',
  maxRender = 12,
  storageKey = 'default',
}: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const storeKey = `nk_dismissed_${storageKey}`;

  useEffect(() => {
    setMounted(true);
    try {
      const raw = window.localStorage.getItem(storeKey);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [storeKey]);

  const persist = (next: Set<string>) => {
    setDismissed(next);
    try { window.localStorage.setItem(storeKey, JSON.stringify(Array.from(next))); }
    catch { /* ignore */ }
  };

  const dismiss = (sig: string) => { const next = new Set(dismissed); next.add(sig); persist(next); };
  const restoreAll = () => persist(new Set());

  const sorted = useMemo(
    () => [...insights].sort((a, b) => PRI[a.priority].order - PRI[b.priority].order),
    [insights],
  );

  const visible = mounted
    ? sorted.filter(i => !dismissed.has(insightSig(i)))
    : sorted;
  const render = visible.slice(0, maxRender);
  const hiddenCount = mounted ? dismissed.size : 0;

  return (
    <div style={box}>
      <div style={header}>
        <span style={pill}>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#5A5A5A', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>{visible.length} shown{sorted.length > visible.length ? ` · ${sorted.length - visible.length} dismissed` : ''}</span>
          {hiddenCount > 0 && (
            <button onClick={restoreAll} style={restoreBtn}>restore</button>
          )}
        </span>
      </div>

      <div style={{ padding: 8 }}>
        {subtitle && <div style={{ fontSize: 10, color: '#5A5A5A', margin: '2px 4px 8px' }}>{subtitle}</div>}

        {render.length === 0 && (
          <div style={{ fontSize: 11, color: '#8A8A8A', padding: '18px 6px', textAlign: 'center', fontStyle: 'italic' }}>
            {emptyText}
          </div>
        )}

        {render.map((ins) => {
          const p = PRI[ins.priority];
          const sig = insightSig(ins);
          const href = ins.href
            ?? (ins.insightKey ? `/guest/behaviour/insight/${ins.insightKey}` : undefined);
          const actionLabel = ins.action ?? (href ? 'See guests →' : undefined);

          return (
            <div key={sig} style={row}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 99, background: p.dot, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: p.dot }}>{p.label}</span>
                    {ins.guardrail === 'dynamic' && (
                      <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.08em', color: '#5A5A5A', border: '1px solid #E6DFCC', padding: '1px 4px', borderRadius: 2 }}>DYNAMIC</span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1B1B1B' }}>{ins.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#3A3A3A', marginTop: 3, lineHeight: 1.5 }}>{ins.body}</div>
                  {ins.evidence && (
                    <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 3, fontFamily: 'monospace' }}>{ins.evidence}</div>
                  )}
                  {(actionLabel || href) && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {href ? (
                        <Link href={href} style={linkBtn(p.dot)}>{actionLabel ?? 'See guests →'}</Link>
                      ) : actionLabel ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: p.dot }}>→ {actionLabel}</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismiss(sig)}
                  aria-label="Dismiss"
                  title="Dismiss this signal — comes back when the condition re-fires"
                  style={dismissBtn}
                >×</button>
              </div>
            </div>
          );
        })}

        {visible.length > render.length && (
          <div style={{ fontSize: 10, color: '#5A5A5A', textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
            + {visible.length - render.length} more · showing top {render.length}
          </div>
        )}
      </div>
    </div>
  );
}

const box: React.CSSProperties = { border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF', overflow: 'hidden' };
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' };
const pill: React.CSSProperties = { display: 'inline-block', padding: '3px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#FFFFFF', background: '#1B1B1B', borderRadius: 99 };
const row: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid #F5F0E1' };
const restoreBtn: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#5A5A5A', padding: '2px 6px', borderRadius: 3, cursor: 'pointer' };
const dismissBtn: React.CSSProperties = { flexShrink: 0, width: 18, height: 18, border: '1px solid transparent', background: 'transparent', color: '#8A8A8A', fontSize: 14, cursor: 'pointer', borderRadius: 3, lineHeight: 1, padding: 0 };
const linkBtn = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px',
  border: '1px solid ' + color, color: color, background: '#FFFFFF',
  fontSize: 10, fontWeight: 600, borderRadius: 3, textDecoration: 'none',
});
