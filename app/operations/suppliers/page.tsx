'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

interface Supplier {
  id: string;
  name: string;
  category: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  currency: string | null;
  lead_time_days: number | null;
  last_order_date: string | null;
  notes: string | null;
}

const STATUS_COLORS: Record<string, 'green' | 'yellow' | 'red' | 'grey'> = {
  active: 'green',
  inactive: 'grey',
  suspended: 'red',
  pending: 'yellow',
};

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  useEffect(() => {
    void fetch('/api/operations/suppliers')
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d) ? d : d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(rows.map((r) => r.category).filter(Boolean)))];

  const filtered = rows.filter((r) => {
    const matchesCat = categoryFilter === 'All' || r.category === categoryFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.name?.toLowerCase().includes(q) ||
      r.contact_name?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const totalActive = rows.filter((r) => r.status === 'active').length;
  const totalSuspended = rows.filter((r) => r.status === 'suspended').length;
  const totalPending = rows.filter((r) => r.status === 'pending').length;

  const columns = [
    { key: 'name', header: 'SUPPLIER' },
    { key: 'category', header: 'CATEGORY' },
    {
      key: 'status',
      header: 'STATUS',
      render: (v: string) => (
        <StatusPill color={STATUS_COLORS[v?.toLowerCase()] ?? 'grey'} label={v ?? '—'} />
      ),
    },
    { key: 'contact_name', header: 'CONTACT' },
    { key: 'contact_phone', header: 'PHONE' },
    { key: 'contact_email', header: 'EMAIL' },
    { key: 'payment_terms', header: 'PAYMENT TERMS' },
    {
      key: 'lead_time_days',
      header: 'LEAD TIME',
      render: (v: number | null) => (v != null ? `${v}d` : '—'),
    },
    {
      key: 'last_order_date',
      header: 'LAST ORDER',
      render: (v: string | null) => v ?? '—',
    },
    { key: 'notes', header: 'NOTES' },
  ];

  return (
    <main style={{ padding: '24px 32px', fontFamily: 'var(--font-sans)' }}>
      <PageHeader pillar="Operations" tab="Suppliers" title="Suppliers" />

      {/* KPI tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Suppliers" value={loading ? '…' : String(rows.length)} />
        <KpiBox label="Active" value={loading ? '…' : String(totalActive)} />
        <KpiBox label="Suspended" value={loading ? '…' : String(totalSuspended)} />
        <KpiBox label="Pending" value={loading ? '…' : String(totalPending)} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search supplier, contact, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #d4af37',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: 13,
            width: 280,
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #d4af37',
            background: '#1a1a1a',
            color: '#fff',
            fontSize: 13,
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#aaa', fontStyle: 'italic' }}>Loading suppliers…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#aaa', fontStyle: 'italic' }}>No suppliers found — {search ? 'try a different search' : 'no data available'}.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered.map((r) => ({
            ...r,
            contact_name: r.contact_name ?? '—',
            contact_phone: r.contact_phone ?? '—',
            contact_email: r.contact_email ?? '—',
            payment_terms: r.payment_terms ?? '—',
            notes: r.notes ?? '—',
          }))}
        />
      )}
    </main>
  );
}
