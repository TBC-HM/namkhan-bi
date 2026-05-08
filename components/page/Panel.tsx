// components/page/Panel.tsx
// Canonical container around any chart/table/list. PBS design manifesto
// 2026-05-09: every "card" on every page renders inside <Panel/>. No
// ad-hoc <div style={{ background, border, borderRadius }}> anywhere.

import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Right-aligned subtitle, e.g. "evidence" or "ai-fed". */
  eyebrow?: string;
  /** Right-aligned action overlay (✦ AI · ⊕ Save · ↻ Schedule · 📁 Project) */
  actions?: ReactNode;
  children: ReactNode;
}

export default function Panel({ title, eyebrow, actions, children }: PanelProps) {
  return (
    <div style={S.box}>
      <div style={S.head}>
        <div style={S.title}>{title}</div>
        <div style={S.headRight}>
          {eyebrow && <span style={S.eyebrow}>{eyebrow}</span>}
          {actions}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  box:  { background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 14 },
  title: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a',
  },
  headRight: { display: 'flex', alignItems: 'center', gap: 8 },
  eyebrow: {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5a5448',
  },
};
