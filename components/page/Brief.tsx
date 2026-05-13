// components/page/Brief.tsx
// THE answer shape. Every agentic question lands here:
//   signal · body · Good (opportunity) · Bad (leakage) · proposals row.
//
// Lives separately from the canvas page so any future surface (a /sample
// view, an embedded widget, a brief shipped via email) can render the
// same shape from the same data.
//
// PBS design manifesto 2026-05-09: NEVER reimplement the good/bad/signal
// pattern inline. Use this component.

import type { ReactNode } from 'react';

export interface BriefData {
  signal: string;
  body?: string;
  good: string[];
  bad: string[];
}

interface Props {
  brief: BriefData;
  /** Proposal cards rendered under the Good/Bad row. */
  proposalSlot?: ReactNode;
  /** Right-aligned action overlay on the brief itself (e.g. ✦ Refresh). */
  actions?: ReactNode;
}

export default function Brief({ brief, proposalSlot, actions }: Props) {
  return (
    <div style={S.wrap}>
      <div style={S.headRow}>
        <div style={S.eyebrow}>✦ Signal</div>
        {actions && <div>{actions}</div>}
      </div>
      <div style={S.line}>{brief.signal}</div>
      {brief.body && <div style={S.body}>{brief.body}</div>}

      <div style={S.gbGrid}>
        <div style={S.good}>
          <div style={S.goodEyebrow}>Good · opportunity</div>
          <ul style={S.list}>{brief.good.map((g, i) => <li key={i} style={S.itemGood}>{g}</li>)}</ul>
        </div>
        <div style={S.bad}>
          <div style={S.badEyebrow}>Bad · leakage</div>
          <ul style={S.list}>{brief.bad.map((b, i) => <li key={i} style={S.itemBad}>{b}</li>)}</ul>
        </div>
      </div>

      {proposalSlot && <div style={{ marginTop: 18 }}>{proposalSlot}</div>}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 880, margin: '20px auto 24px', padding: 22,
    background: 'linear-gradient(180deg, var(--surf-1, #0f0d0a) 0%, var(--surf-1b, #100c08) 100%)',
    border: '1px solid var(--border-2, #2a261d)', borderRadius: 14,
  },
  headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  eyebrow: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--accent, #a8854a)',
  },
  line: { fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 22, lineHeight: 1.4, color: 'var(--text-0, #e9e1ce)', marginBottom: 8 },
  body: { fontSize: 14, color: 'var(--text-3, #c9bb96)', lineHeight: 1.6, marginBottom: 14 },
  gbGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  good: { background: 'var(--surf-ok, #0a1f12)', border: '1px solid #1c3526', borderRadius: 10, padding: '12px 14px' },
  bad:  { background: 'var(--surf-warn, #1f0e0c)', border: '1px solid #5a2825', borderRadius: 10, padding: '12px 14px' },
  goodEyebrow: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#7c9a6b', marginBottom: 8 },
  badEyebrow:  { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--st-bad-bd)', marginBottom: 8 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  itemGood: { fontSize: 13, color: 'var(--text-2, #d8cca8)', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid #7c9a6b', paddingTop: 2, paddingBottom: 2 },
  itemBad:  { fontSize: 13, color: 'var(--text-2, #d8cca8)', lineHeight: 1.5, paddingLeft: 12, borderLeft: '2px solid #c0584c', paddingTop: 2, paddingBottom: 2 },
};
