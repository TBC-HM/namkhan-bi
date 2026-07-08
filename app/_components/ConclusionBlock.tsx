'use client';
// app/_components/ConclusionBlock.tsx
// PBS 2026-07-06 v2: 2-column-ready · dismissable · deep-link to /guest/behaviour/insight/[key].
// Modern layout — no colored card backgrounds, just a priority pill + hairline border.
// Dismissed insights are hidden client-side and persisted in localStorage.

import TenantLink from '@/components/nav/TenantLink';
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

  // Track which insight has the dismiss-reason picker open + selected reason
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [otherFor, setOtherFor]   = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');

  // PBS 2026-07-07: max 5 reasons, one is "Other…" with a free-text note.
  // Every dismiss MUST pick a reason — cancel closes the picker but does NOT dismiss.
  const DISMISS_REASONS = [
    { key: 'handled',      label: 'Already handled'     },
    { key: 'not_relevant', label: 'Not relevant here'   },
    { key: 'threshold',    label: 'Threshold too tight' },
    { key: 'false_signal', label: 'Wrong signal'        },
    { key: 'other',        label: 'Other…'              },
  ];

  const dismissWithReason = async (sig: string, reasonKey: string, insightKey?: string, note?: string) => {
    const next = new Set(dismissed); next.add(sig); persist(next);
    setPickerFor(null);
    setOtherFor(null);
    setOtherText('');
    try {
      await fetch('/api/guardrail/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insight_key: insightKey ?? sig, reason: reasonKey, note: note ?? null }),
        keepalive: true,
      });
    } catch { /* ignore */ }
  };
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
                        <TenantLink href={href} style={linkBtn(p.dot)}>{actionLabel ?? 'See guests →'}</TenantLink>
                      ) : actionLabel ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: p.dot }}>→ {actionLabel}</span>
                      ) : null}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setPickerFor(pickerFor === sig ? null : sig)}
                  aria-label="Dismiss"
                  title="Dismiss with a reason — helps fine-tune the guardrail thresholds"
                  style={dismissBtn}
                >×</button>
              </div>

              {pickerFor === sig && (
                <div style={pickerBox}>
                  <div style={{ fontSize: 10, color: '#5A5A5A', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                    Why are you dismissing this? (required)
                  </div>
                  {otherFor === sig ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        autoFocus
                        value={otherText}
                        onChange={e => setOtherText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && otherText.trim()) {
                            dismissWithReason(sig, 'other', ins.key, otherText.trim());
                          }
                        }}
                        placeholder="Say why…"
                        style={{ ...reasonChip, minWidth: 220, background: '#FFFFFF' }}
                      />
                      <button
                        onClick={() => otherText.trim() && dismissWithReason(sig, 'other', ins.key, otherText.trim())}
                        disabled={!otherText.trim()}
                        style={{ ...reasonChip, background: otherText.trim() ? '#084838' : '#EEE', color: otherText.trim() ? '#FFFFFF' : '#8A8A8A', border: 'none' }}
                      >Dismiss</button>
                      <button onClick={() => { setOtherFor(null); setOtherText(''); }} style={{ ...reasonChip, background: 'transparent', border: 'none', color: '#5A5A5A' }}>back</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DISMISS_REASONS.map(r => (
                        <button
                          key={r.key}
                          onClick={() => {
                            if (r.key === 'other') setOtherFor(sig);
                            else dismissWithReason(sig, r.key, ins.key);
                          }}
                          style={reasonChip}
                        >{r.label}</button>
                      ))}
                      <button onClick={() => setPickerFor(null)} style={{ ...reasonChip, background: 'transparent', border: 'none', color: '#5A5A5A' }}>cancel</button>
                    </div>
                  )}
                </div>
              )}
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
const pickerBox: React.CSSProperties = { marginTop: 6, marginLeft: 16, padding: '8px 10px', background: '#FAFAF7', border: '1px solid #E6DFCC', borderRadius: 4 };
const reasonChip: React.CSSProperties = { fontSize: 10, fontWeight: 500, padding: '4px 8px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 3, cursor: 'pointer', color: '#1B1B1B' };
const linkBtn = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 8px',
  border: '1px solid ' + color, color: color, background: '#FFFFFF',
  fontSize: 10, fontWeight: 600, borderRadius: 3, textDecoration: 'none',
});
