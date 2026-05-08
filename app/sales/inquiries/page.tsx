'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface Inquiry {
  id: string | number;
  created_at: string;
  guest_name: string;
  email: string;
  channel: string;
  arrival_date: string;
  departure_date: string;
  nights: number;
  adults: number;
  children: number;
  room_type: string;
  status: string;
  assigned_to: string;
  response_time_hrs: number | null;
  revenue_potential_usd: number | null;
  notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: '#2563eb',
  open: '#7c3aed',
  quoted: '#d97706',
  confirmed: '#16a34a',
  lost: '#dc2626',
  cancelled: '#6b7280',
};

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status?.toLowerCase()] ?? '#6b7280';
  return (
    <span
      style={{
        background: color,
        color: '#fff',
        borderRadius: 999,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'capitalize',
        display: 'inline-block',
      }}
    >
      {status ?? '—'}
    </span>
  );
}

export default function SalesInquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('sales_inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (err) {
        const { data: d2, error: e2 } = await supabase
          .from('v_sales_inquiries')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        if (e2) {
          setError(e2.message);
        } else {
          setRows((d2 ?? []) as Inquiry[]);
        }
      } else {
        setRows((data ?? []) as Inquiry[]);
      }
      setLoading(false);
    }

    void load();
  }, []);

  const filtered = rows.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status?.toLowerCase() === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      r.guest_name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.channel?.toLowerCase().includes(q) ||
      r.room_type?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const total = rows.length;
  const newCount = rows.filter((r) => r.status?.toLowerCase() === 'new').length;
  const confirmedCount = rows.filter((r) => r.status?.toLowerCase() === 'confirmed').length;
  const totalRevPotential = rows.reduce((s, r) => s + (r.revenue_potential_usd ?? 0), 0);
  const avgResponseHrs =
    rows.filter((r) => r.response_time_hrs != null).length > 0
      ? (
          rows.reduce((s, r) => s + (r.response_time_hrs ?? 0), 0) /
          rows.filter((r) => r.response_time_hrs != null).length
        ).toFixed(1)
      : '—';

  const statuses = ['all', ...Array.from(new Set(rows.map((r) => r.status?.toLowerCase()).filter(Boolean)))];

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'Inter, sans-serif', color: '#111' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Sales</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Inquiries</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          { label: 'Total Inquiries', value: total },
          { label: 'New', value: newCount },
          { label: 'Confirmed', value: confirmedCount },
          { label: 'Rev. Potential', value: `$${totalRevPotential.toLocaleString()}` },
          { label: 'Avg Response', value: avgResponseHrs === '—' ? '—' : `${avgResponseHrs} hrs` },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
            }}
          >
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{loading ? '…' : value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search guest, email, channel…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 14,
            width: 280,
            outline: 'none',
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            border: '1px solid #d1d5db',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 14,
            background: '#fff',
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 'auto' }}>
          {filtered.length} of {total} inquiries
        </span>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c' }}>
          Data source unavailable: {error}. Ensure <code>sales_inquiries</code> or <code>v_sales_inquiries</code> view exists.
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Date', 'Guest', 'Email', 'Channel', 'Arrival', 'Nights', 'Pax', 'Room Type', 'Status', 'Assigned To', 'Response (hrs)', 'Rev. Potential'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                    whiteSpace: 'nowrap',
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
                <td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                  No inquiries found.
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
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    {r.created_at ? r.created_at.slice(0, 10) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{r.guest_name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{r.email ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{r.channel ?? '—'}</td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{r.arrival_date ?? '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>{r.nights ?? '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {r.adults != null ? `${r.adults}A` : '—'}
                    {r.children ? ` ${r.children}C` : ''}
                  </td>
                  <td style={{ padding: '10px 14px' }}>{r.room_type ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <StatusPill status={r.status} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>{r.assigned_to ?? '—'}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    {r.response_time_hrs != null ? r.response_time_hrs : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    {r.revenue_potential_usd != null
                      ? `$${r.revenue_potential_usd.toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
        Source: <code>sales_inquiries</code> · Showing last 200 records · Refresh to update
      </p>
    </main>
  );
}
