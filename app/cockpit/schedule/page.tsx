'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TicketRow {
  id: number;
  created_at: string;
  arm: string | null;
  intent: string | null;
  status: string | null;
  parsed_summary: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  working: '#3b82f6',
  triaged: '#f59e0b',
  triage_failed: '#ef4444',
  awaits_user: '#a855f7',
  new: '#6b7280',
};

export default function SchedulePage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('cockpit_tickets')
        .select('id, created_at, arm, intent, status, parsed_summary')
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) {
        setError(err.message);
      } else {
        setTickets(data ?? []);
      }
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <main style={{ padding: '24px', fontFamily: 'var(--font-sans, sans-serif)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Cockpit Schedule</h1>
        <p style={{ color: '#6b7280', marginTop: 4 }}>Recent tickets and task queue</p>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
          Loading schedule…
        </div>
      )}

      {error && (
        <div style={{
          padding: 16,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          color: '#dc2626',
          marginBottom: 16,
        }}>
          Error loading schedule: {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Arm</th>
                <th style={thStyle}>Intent</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, width: '40%' }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#6b7280' }}>
                    No tickets found
                  </td>
                </tr>
              )}
              {tickets.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{t.id}</td>
                  <td style={tdStyle}>
                    {t.created_at
                      ? new Date(t.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td style={tdStyle}>{t.arm ?? '—'}</td>
                  <td style={tdStyle}>{t.intent ?? '—'}</td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: `${STATUS_COLORS[t.status ?? ''] ?? '#6b7280'}22`,
                      color: STATUS_COLORS[t.status ?? ''] ?? '#6b7280',
                      border: `1px solid ${STATUS_COLORS[t.status ?? ''] ?? '#6b7280'}55`,
                    }}>
                      {t.status ?? '—'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 400 }}>
                    <span style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      color: '#374151',
                    }}>
                      {t.parsed_summary
                        ? t.parsed_summary.replace(/\*\*/g, '').slice(0, 200)
                        : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#374151',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 16px',
  verticalAlign: 'top',
  color: '#111827',
};
