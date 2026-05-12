// components/page/ProposalCard.tsx — a single proposal in the brief or
// a lane. Always shows agent · action_type · signal · body + CTAs.

import type { ReactNode } from 'react';

export interface ProposalLite {
  id: number;
  agent_role: string;
  action_type: string;
  signal: string;
  body?: string | null;
  status: 'proposal' | 'in_process' | 'done' | 'rejected';
}

interface CTA { label: string; onClick: () => void; primary?: boolean }

interface Props {
  p: ProposalLite;
  /** Action buttons in the card footer (Approve / Reject / Mark done / …). */
  cta?: CTA[];
  /** Compact lane variant — smaller padding, no body text. */
  variant?: 'brief' | 'lane';
  /** Optional right-aligned action overlay (✦ AI · ⊕ Save · 📁 Project). */
  actions?: ReactNode;
}

export default function ProposalCard({ p, cta = [], variant = 'brief', actions }: Props) {
  const inProcess = p.status === 'in_process';
  const compact   = variant === 'lane';
  return (
    <div style={card(inProcess, compact)}>
      <div style={agentRow}>
        <div style={agentLine}>
          <span style={{ color: 'var(--accent, #a8854a)' }}>{p.agent_role}</span>
          <span style={{ color: 'var(--text-place, #5a5448)' }}>·</span>
          <span style={{ color: 'var(--text-dim, #7d7565)' }}>{p.action_type}</span>
        </div>
        {actions && <div>{actions}</div>}
      </div>
      <div style={signal(compact)}>{p.signal}</div>
      {p.body && !compact && <div style={body}>{p.body}</div>}

      {cta.length > 0 && (
        <div style={ctaRow}>
          {cta.map((c, i) => (
            <button key={i} onClick={c.onClick} style={ctaBtn(!!c.primary, compact)}>{c.label}</button>
          ))}
          {inProcess && cta.length === 0 && (
            <span style={inProcessTag}>● in process</span>
          )}
        </div>
      )}
    </div>
  );
}

const card = (inProcess: boolean, compact: boolean): React.CSSProperties => ({
  background:   compact ? 'var(--surf-0, #0a0a0a)' : 'var(--surf-2, #15110b)',
  border:       `1px solid ${inProcess ? 'var(--accent, #a8854a)' : 'var(--border-2, #2a261d)'}`,
  borderRadius: compact ? 8 : 10,
  padding:      compact ? '8px 10px' : '12px 14px',
  display:      'flex',
  flexDirection: 'column',
  gap:          compact ? 4 : 6,
});
const agentRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const agentLine: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  display: 'flex', gap: 6,
};
const signal = (compact: boolean): React.CSSProperties => ({
  fontSize: compact ? 12 : 14, color: compact ? 'var(--text-2, #d8cca8)' : 'var(--text-0, #e9e1ce)',
  lineHeight: 1.4, fontWeight: compact ? 400 : 500,
});
const body: React.CSSProperties = { fontSize: 12, color: 'var(--text-mute, #9b907a)', lineHeight: 1.5 };
const ctaRow: React.CSSProperties = { display: 'flex', gap: 6, marginTop: 6 };
const ctaBtn = (primary: boolean, compact: boolean): React.CSSProperties => ({
  background: primary ? (compact ? 'var(--surf-3, #1c160d)' : 'var(--accent, #a8854a)') : 'transparent',
  border: `1px solid ${primary ? (compact ? 'var(--border-2, #2a261d)' : 'var(--accent, #a8854a)') : 'var(--border-3, #3a3327)'}`,
  color: primary ? (compact ? 'var(--accent, #a8854a)' : 'var(--surf-0, #0a0a0a)') : (compact ? 'var(--text-dim, #7d7565)' : 'var(--text-mute, #9b907a)'),
  borderRadius: compact ? 6 : 8,
  padding: compact ? '3px 8px' : '5px 12px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: compact ? 9 : 10, letterSpacing: '0.14em', textTransform: 'uppercase',
  fontWeight: primary ? 600 : 500, cursor: 'pointer',
});
const inProcessTag: React.CSSProperties = {
  color: 'var(--accent-4, #c79a6b)',
  fontSize: 11, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  letterSpacing: '0.16em', textTransform: 'uppercase',
};
