'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Types
interface GuestRow {
  id: string;
  reservation_id?: string;
  guest_name?: string;
  email?: string;
  phone?: string;
  nationality?: string;
  check_in?: string;
  check_out?: string;
  room_number?: string;
  room_type?: string;
  status?: string;
  total_usd?: number;
  total_lak?: number;
  source_channel?: string;
  notes?: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() ?? '';
  const map: Record<string, { bg: string; label: string }> = {
    checked_in:   { bg: '#16a34a', label: 'Checked In' },
    checked_out:  { bg: '#6b7280', label: 'Checked Out' },
    reserved:     { bg: '#2563eb', label: 'Reserved' },
    cancelled:    { bg: '#dc2626', label: 'Cancelled' },
    no_show:      { bg: '#d97706', label: 'No Show' },
  };
  const style = map[s] ?? { bg: '#6b7280', label: status ?? '—' };
  return (
    <span style={{
      background: style.bg,
      color: '#fff',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}

export default function GuestPage() {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      // Try the most likely view names; fall back gracefully
      const candidates = [
        'v_guest_entry',
        'v_guests',
        'v_reservations',
        'reservations',
        'guests',
      ];

      let found = false;
      for (const table of candidates) {
        const { data, error: qErr } = await supabase
          .from(table)
          .select('*')
          .order('check_in', { ascending: false })
          .limit(200);

        if (!qErr && data) {
          setRows(data as GuestRow[]);
          found = true;
          break;
        }
      }

      if (!found) {
        setError('No guest data source found — please wire a view named v_guest_entry or v_reservations.');
      }
      setLoading(false);
    }
    void load();
  }, []);

  // Client-side filter
  const filtered = rows.filter((r) => {
    const matchSearch =
      search.trim() === '' ||
      [r.guest_name, r.email, r.reservation_id, r.room_number]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' || (r.status?.toLowerCase() ?? '') === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = ['all', 'checked_in', 'reserved', 'checked_out', 'cancelled', 'no_show'];

  const fmt = (v?: string | null) => v ?? '—';
  const fmtDate = (v?: string | null) => {
    if (!v) return '—';
    return v.slice(0, 10); // ISO YYYY-MM-DD
  };
  const fmtUsd = (v?: number | null) =>
    v != null ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <main style={{ fontFamily: 'Inter, sans-serif', padding: '24px 32px', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Guest
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 700, color: '#111827' }}>
          Guest Entry
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
          Reservation log — search by name, email, or reservation ID
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search guest, email, reservation ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 280px',
            padding: '8px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
            background: '#fff',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 14px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {loading ? 'Loading…' : `${filtered.length} guest${filtered.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#991b1b',
          fontSize: 14,
          marginBottom: 20,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                {[
                  'Reservation ID',
                  'Guest Name',
                  'Email',
                  'Phone',
                  'Nationality',
                  'Room',
                  'Room Type',
                  'Check-in',
                  'Check-out',
                  'Status',
                  'Total (USD)',
                  'Channel',
                  'Notes',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>
                    Loading guest data…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af' }}>
                    No guests match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr
                    key={r.id ?? i}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
                      {fmt(r.reservation_id)}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#111827' }}>
                      {fmt(r.guest_name)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{fmt(r.email)}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {fmt(r.phone)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{fmt(r.nationality)}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827' }}>
                      {fmt(r.room_number)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{fmt(r.room_type)}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {fmtDate(r.check_in)}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {fmtDate(r.check_out)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                      {fmtUsd(r.total_usd)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{fmt(r.source_channel)}</td>
                    <td style={{ padding: '10px 14px', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fmt(r.notes)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
        Namkhan BI · Guest Entry · Data refreshes on page load
      </p>
    </main>
  );
}
