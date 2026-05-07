'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ItAskBox() {
  const [query, setQuery] = useState('')
  const router = useRouter()

  const handleAsk = () => {
    const dest = query.trim()
      ? `/cockpit?q=${encodeURIComponent(query.trim())}`
      : '/cockpit'
    router.push(dest)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAsk()
  }

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2
        style={{
          fontSize: 'var(--t-lg)',
          fontWeight: 600,
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Ask anything
      </h2>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="Ask the team anything…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: '1 1 300px',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-primary)',
            fontSize: 'var(--t-sm)',
            outline: 'none',
          }}
        />

        <button
          onClick={handleAsk}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--brass)',
            color: 'var(--surface-1)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 'var(--t-sm)',
            cursor: 'pointer',
            letterSpacing: 'var(--ls-extra)',
          }}
        >
          Ask →
        </button>

        <button
          onClick={() => router.push('/cockpit')}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'transparent',
            color: 'var(--brass)',
            border: '1px solid var(--brass)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: 'var(--t-sm)',
            cursor: 'pointer',
            letterSpacing: 'var(--ls-extra)',
          }}
        >
          Open workspace
        </button>
      </div>

      <p
        style={{
          marginTop: 'var(--space-2)',
          fontSize: 'var(--t-xs)',
          color: 'var(--text-muted)',
        }}
      >
        Opens the Cockpit chat workspace. Your question will be pre-filled.
      </p>
    </section>
  )
}
