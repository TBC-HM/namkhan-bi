'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

type ScheduleRow = {
  id: string | number;
  title?: string;
  start_date?: string;
  end_date?: string;
  department?: string;
  status?: string;
  assigned_to?: string;
  notes?: string;
  [key: string]: unknown;
};

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  const bg =
    s === 'confirmed' ? '#16a34a' :
    s === 'pending'   ? '#d97706' :
    '#6b7280';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      background: bg,
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'capitalize',
    }}>
      {status ?? '—'}
    </span>
  );
}

export default function SchedulePage() {
  const [rows, setRows]     = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Try multiple known view/table names in order
        const candidates = [
          'v_staff_schedule',
          'staff_schedule',
          'schedule',
          'ops_schedule',
        ];

        let found = false;
        for (const tbl of candidates) {
          const { data, error: qErr } = await supabase
            .from(tbl)
            .select('*')
            .order('start_date', { ascending: true })
            .limit(100);

          if (!qErr && data) {
            setRows(data as ScheduleRow[]);
            found = true;
            break;
          }
        }

        if (!found) {
          setError(
            'No schedule table found. Checked: ' + candidates.join(', ') +
            '. Please ensure a schedule view exists and RLS allows reads.'
          );
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Schedule</h1>
        <p style={{ color: '#6b7280' }}>Loading schedule…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Schedule</h1>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: 20,
          color: '#991b1b',
        }}>
          <strong>Failed to load schedule</strong>
          <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</pre>
        </div>
      </main>
    );
  }

  if (rows.length === 0) {
    return (
      <main style={{ padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Schedule</h1>
        <p style={{ color: '#6b7280' }}>No schedule entries found.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Schedule</h1>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          background: '#fff',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              {['Title', 'Department', 'Start', 'End', 'Assigned To', 'Status', 'Notes'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#374151',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id ?? i} style={{
                borderBottom: '1px solid #f3f4f6',
                background: i % 2 === 0 ? '#fff' : '#f9fafb',
              }}>
                <td style={{ padding: '9px 14px' }}>{String(row.title ?? '—')}</td>
                <td style={{ padding: '9px 14px' }}>{String(row.department ?? '—')}</td>
                <td style={{ padding: '9px 14px' }}>{String(row.start_date ?? '—')}</td>
                <td style={{ padding: '9px 14px' }}>{String(row.end_date ?? '—')}</td>
                <td style={{ padding: '9px 14px' }}>{String(row.assigned_to ?? '—')}</td>
                <td style={{ padding: '9px 14px' }}><StatusBadge status={String(row.status ?? '')} /></td>
                <td style={{ padding: '9px 14px', color: '#6b7280', maxWidth: 200 }}>{String(row.notes ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: '#9ca3af' }}>
        {rows.length} record{rows.length !== 1 ? 's' : ''}
      </p>
    </main>
  );
}
