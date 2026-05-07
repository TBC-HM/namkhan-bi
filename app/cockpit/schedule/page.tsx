'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface ScheduleEntry {
  id: string | number
  title?: string
  start_date?: string
  end_date?: string
  status?: string
  assignee?: string
  notes?: string
  [key: string]: unknown
}

export default function SchedulePage() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSchedule() {
      try {
        // Attempt to fetch from cockpit_tickets as a schedule proxy
        // Replace with dedicated schedule view/table when available
        const { data, error: sbError } = await supabase
          .from('cockpit_tickets')
          .select('id, parsed_summary, status, arm, created_at, updated_at')
          .eq('arm', 'dev')
          .order('id', { ascending: false })
          .limit(50)

        if (sbError) throw sbError
        setEntries(
          (data ?? []).map((row) => ({
            id: row.id,
            title: row.parsed_summary?.slice(0, 80) ?? '—',
            start_date: row.created_at ?? null,
            end_date: row.updated_at ?? null,
            status: row.status ?? '—',
            assignee: row.arm ?? '—',
          }))
        )
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    fetchSchedule()
  }, [])

  return (
    <main style={{ padding: '2rem', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <h1
        style={{
          fontSize: 'var(--t-2xl, 1.5rem)',
          letterSpacing: 'var(--ls-extra, 0.05em)',
          color: 'var(--brass, #b8860b)',
          marginBottom: '1.5rem',
        }}
      >
        Schedule
      </h1>

      {loading && (
        <p style={{ color: 'var(--text-muted, #888)' }}>Loading schedule…</p>
      )}

      {error && (
        <div
          style={{
            background: 'var(--surface-error, #fee2e2)',
            border: '1px solid var(--border-error, #ef4444)',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1rem',
            color: 'var(--text-error, #b91c1c)',
          }}
        >
          <strong>Error loading schedule:</strong> {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p style={{ color: 'var(--text-muted, #888)' }}>No schedule entries found.</p>
      )}

      {!loading && !error && entries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 'var(--t-sm, 0.875rem)',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--brass, #b8860b)',
                  textAlign: 'left',
                  color: 'var(--text-muted, #888)',
                }}
              >
                <th style={{ padding: '0.5rem 1rem' }}>ID</th>
                <th style={{ padding: '0.5rem 1rem' }}>Title</th>
                <th style={{ padding: '0.5rem 1rem' }}>Status</th>
                <th style={{ padding: '0.5rem 1rem' }}>Arm</th>
                <th style={{ padding: '0.5rem 1rem' }}>Created</th>
                <th style={{ padding: '0.5rem 1rem' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr
                  key={entry.id}
                  style={{
                    background: idx % 2 === 0 ? 'transparent' : 'var(--surface-alt, rgba(0,0,0,0.03))',
                    borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
                  }}
                >
                  <td style={{ padding: '0.5rem 1rem', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.id ?? '—'}
                  </td>
                  <td
                    style={{
                      padding: '0.5rem 1rem',
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {entry.title ?? '—'}
                  </td>
                  <td style={{ padding: '0.5rem 1rem' }}>
                    <span
                      style={{
                        background:
                          entry.status === 'completed'
                            ? 'var(--surface-success, #d1fae5)'
                            : entry.status === 'working'
                            ? 'var(--surface-warn, #fef9c3)'
                            : 'var(--surface-subtle, #f3f4f6)',
                        color:
                          entry.status === 'completed'
                            ? 'var(--text-success, #065f46)'
                            : entry.status === 'working'
                            ? 'var(--text-warn, #92400e)'
                            : 'var(--text-default, #374151)',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 'var(--t-xs, 0.75rem)',
                        fontWeight: 600,
                      }}
                    >
                      {entry.status ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 1rem' }}>{entry.assignee ?? '—'}</td>
                  <td style={{ padding: '0.5rem 1rem', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.start_date
                      ? new Date(entry.start_date as string).toISOString().slice(0, 10)
                      : '—'}
                  </td>
                  <td style={{ padding: '0.5rem 1rem', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.end_date
                      ? new Date(entry.end_date as string).toISOString().slice(0, 10)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
