'use client';

interface Props {
  activeAgents: number;
  allAgents: number;
  ticketsInFlight: number;
  costUsd24h: number;
}

export default function ItHeroStrip({
  activeAgents,
  allAgents,
  ticketsInFlight,
  costUsd24h,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-6)',
        padding: 'var(--space-5) var(--space-6)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      <HeroStat
        label="Agents Online"
        value={`${activeAgents} / ${allAgents}`}
        accent={activeAgents > 0 ? 'var(--green)' : 'var(--red)'}
      />
      <HeroStat label="Tickets In-Flight" value={String(ticketsInFlight)} />
      <HeroStat label="Cost 24h" value={`$${costUsd24h.toFixed(2)}`} />
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <span
        style={{
          fontSize: 'var(--t-xs)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--t-2xl)',
          fontWeight: 700,
          color: accent ?? 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}
