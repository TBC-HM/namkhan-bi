'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ScheduleRow {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  department: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
}

export default function SchedulePage() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    void (async () => {
      try {
        // Try frontoffice schema first, fall back to public
        const { data, error: sbError } = await supabase
          .from('staff_schedule')
          .select('*')
          .order('start_date', { ascending: true })
          .limit(100);

        if (sbError) {
          // Surface a friendly error rather than crashing silently
          console.error('schedule fetch error:', sbError);
          setError(sbError.message);
        } else {
          setRows(data ?? []);
        }
      } catch (err) {
        console.error('schedule unexpected error:', err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Schedule</h1>
        <p style={{ color: '#6b7280' }}>Loading schedule…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Schedule</h1>
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: 16,
            color: '#b91c1c',
          }}
        >
          <strong>Failed to load schedule data.</strong>
          <p style={{ marginTop: 8, fontSize: 14 }}>{error}</p>
          <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
            Check that the <code>staff_schedule</code> view/table exists and RLS permits access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Schedule</h1>

      {rows.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No schedule entries found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                {['Title', 'Department', 'Start', 'End', 'Assigned To', 'Status', 'Notes'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#374151',
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid #e5e7eb' }}
                >
                  <td style={{ padding: '10px 12px' }}>{row.title ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.department ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.start_date ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.end_date ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{row.assigned_to ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          row.status === 'confirmed'
                            ? '#d1fae5'
                            : row.status === 'pending'
                            ? '#fef9c3'
                            : '#f3f4f6',
                        color:
                          row.status === 'confirmed'
                            ? '#065f46'
                            : row.status === 'pending'
                            ? '#854d0e'
                            : '#374151',
                      }}
                    >
                      {row.status ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{row.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
