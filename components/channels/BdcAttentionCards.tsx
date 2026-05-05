// components/channels/BdcAttentionCards.tsx — "What needs attention" panel
// Server component. Calls the rules engine and renders cards sorted by severity.
// Each card is fully self-explanatory — title, evidence, action.

import { getBdcAttentionCards, type AttentionCard, type AttentionSeverity } from '@/lib/data-bdc-attention';

const SEV_STYLES: Record<AttentionSeverity, { border: string; chip: string; chipText: string; label: string }> = {
  critical: { border: '#b03826',  chip: 'rgba(176,56,38,0.12)',  chipText: '#7a2618', label: 'CRITICAL' },
  warn:     { border: '#a87a18',  chip: 'rgba(168,122,24,0.12)', chipText: '#6e4d0d', label: 'WARN' },
  info:     { border: 'var(--brass)', chip: 'rgba(177,138,72,0.12)', chipText: '#6b5022', label: 'INFO' },
  positive: { border: '#3b6b3a',  chip: 'rgba(59,107,58,0.12)',  chipText: '#2a4d29', label: 'STRENGTH' },
};

function Card({ c }: { c: AttentionCard }) {
  const s = SEV_STYLES[c.severity];
  return (
    <div style={{
      background: 'var(--paper)',
      border: `1px solid ${s.border}`,
      borderLeft: `4px solid ${s.border}`,
      borderRadius: 6,
      padding: '12px 14px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          background: s.chip,
          color: s.chipText,
          padding: '2px 6px',
          borderRadius: 3,
        }}>{s.label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{c.scope}</span>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 'var(--t-lg)', color: 'var(--ink)', marginBottom: 6, lineHeight: 1.3 }}>
        {c.title}
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', marginBottom: 8, lineHeight: 1.5 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginRight: 6 }}>Why:</span>
        {c.evidence}
      </div>
      <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', lineHeight: 1.5 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginRight: 6 }}>Action:</span>
        {c.recommendation}
      </div>
    </div>
  );
}

export default async function BdcAttentionCards() {
  const cards = await getBdcAttentionCards();
  if (cards.length === 0) {
    return (
      <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)', marginBottom: 10 }}>What needs attention</h2>
        <div style={{ padding: '12px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
          No actionable signals detected in the latest BDC snapshot. Nothing critical, nothing leaking.
        </div>
      </div>
    );
  }
  const counts = { critical: 0, warn: 0, info: 0, positive: 0 };
  for (const c of cards) counts[c.severity]++;

  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)' }}>What needs attention</h2>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>
          {counts.critical > 0 && <span style={{ color: '#b03826', marginRight: 10 }}>● {counts.critical} critical</span>}
          {counts.warn > 0 && <span style={{ color: '#a87a18', marginRight: 10 }}>● {counts.warn} warn</span>}
          {counts.positive > 0 && <span style={{ color: '#3b6b3a', marginRight: 10 }}>● {counts.positive} strength</span>}
          · {cards.length} total
        </span>
      </div>
      {cards.map((c) => <Card key={c.rule + c.scope} c={c} />)}
    </div>
  );
}
