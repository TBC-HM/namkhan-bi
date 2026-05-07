'use client'

interface Props {
  activeAgents: number
  allAgents: number
  ticketsInFlight: number
  costUsd24h: number
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
        gap: 'var(--space-4)',
        padding: 'var(--space-5)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
      }}
    >
      <HeroStat
        label="Agents online"
        value={`${activeAgents} / ${allAgents}`}
        accent={activeAgents > 0 ? 'var(--green)' : 'var(--red)'}
      />
      <HeroStat label="Tickets in-flight" value={String(ticketsInFlight)} />
      <HeroStat
        label="Audit cost 24 h"
        value={`$${costUsd24h.toFixed(2)}`}
      />
    </div>
  )
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div style={{ minWidth: 140 }}>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--t-xs)',
          color: 'var(--text-muted)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '4px 0 0',
          fontSize: 'var(--t-2xl)',
          fontWeight: 700,
          color: accent ?? 'var(--text-primary)',
        }}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}
