// Header strip: counts summary + "Viewing as" + refresh button.
// Pure presentational; the orchestrator owns refresh state.

'use client';

interface Props {
  total: number;
  green: number;
  red: number;
  amber: number;
  propertyName: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function InventoryHeader({
  total, green, red, amber, propertyName, refreshing, onRefresh,
}: Props) {
  return (
    <div style={S.wrap}>
      <div style={S.summary}>
        <span style={S.totalNum}>{total}</span>
        <span style={S.totalLabel}>items</span>
        <span style={S.sep}>·</span>
        <span style={{ ...S.split, color: '#2E7D32' }}>{green} wired</span>
        <span style={S.sep}>·</span>
        <span style={{ ...S.split, color: 'var(--terracotta, #B8542A)' }}>{red} not wired</span>
        <span style={S.sep}>·</span>
        <span style={{ ...S.split, color: 'var(--sand, #B8A878)' }}>{amber} partial</span>
      </div>
      <div style={S.rightCluster}>
        <span style={S.viewingAs}>Viewing as: <strong style={S.propName}>{propertyName}</strong></span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          style={{ ...S.refreshBtn, ...(refreshing ? S.refreshBtnDisabled : null) }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottom: '1px solid var(--line-soft, rgba(251, 246, 233, 0.15))',
    marginBottom: 16,
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'baseline',
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 12,
    color: 'var(--ink-soft, #ead9b4)',
  },
  totalNum: {
    fontFamily: 'var(--serif, "Fraunces", Georgia, serif)',
    fontStyle: 'italic',
    fontSize: 24,
    fontWeight: 500,
    color: 'var(--ink, #fbf6e9)',
    lineHeight: 1,
  },
  totalLabel: {
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--ink-mute, #cfc3a3)',
  },
  sep: { color: 'var(--ink-faint, #a59a7d)' },
  split: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  rightCluster: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  viewingAs: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-mute, #cfc3a3)',
  },
  propName: {
    color: 'var(--ink, #fbf6e9)',
    fontWeight: 600,
  },
  refreshBtn: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '7px 14px',
    borderRadius: 4,
    border: '1px solid var(--line, rgba(251, 246, 233, 0.26))',
    background: 'transparent',
    color: 'var(--ink, #fbf6e9)',
    cursor: 'pointer',
    transition: 'background 100ms ease',
  },
  refreshBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
