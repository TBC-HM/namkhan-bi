'use client';

// app/operations/page.tsx
// Operations entry page — Phase 2.5 foundation
// Ticket #159 | Assumed: no dedicated ops view exists yet; wired to v_overview_kpis as fallback KPI source.
// Assumed: PageHeader pillar="Operations" is valid. Assumed: tabs will be wired later (this is the entry/index only).

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OpsKpiRow {
  occ_pct: number | null;
  rooms_sold: number | null;
  rooms_available: number | null;
  adr_usd: number | null;
}

const LINKS: { label: string; href: string; description: string }[] = [
  {
    label: 'Staff',
    href: '/operations/staff',
    description: 'Headcount, shifts and department roster.',
  },
  {
    label: 'Inventory',
    href: '/operations/inventory',
    description: 'Room status, housekeeping queue and maintenance flags.',
  },
  {
    label: 'Incidents',
    href: '/operations/incidents',
    description: 'Open cockpit incidents and resolution log.',
  },
];

export default function OperationsPage() {
  const [kpis, setKpis] = useState<OpsKpiRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState<string>('—');

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('v_overview_kpis')
        .select('occ_pct, rooms_sold, rooms_available, adr_usd')
        .limit(1)
        .maybeSingle();

      setKpis(data ?? null);
      setAsOf(new Date().toISOString().slice(0, 10));
      setLoading(false);
    })();
  }, []);

  const fmt = (v: number | null | undefined, prefix = '') =>
    v == null ? '—' : `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;

  return (
    <main style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader pillar="Operations" tab="Overview" title="Operations" />

      {/* KPI ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox
          label="Occupancy"
          value={loading ? '…' : `${fmt(kpis?.occ_pct)}%`}
          sub={`As of ${asOf}`}
        />
        <KpiBox
          label="Rooms Sold"
          value={loading ? '…' : fmt(kpis?.rooms_sold)}
          sub="Tonight"
        />
        <KpiBox
          label="Rooms Available"
          value={loading ? '…' : fmt(kpis?.rooms_available)}
          sub="Tonight"
        />
        <KpiBox
          label="ADR"
          value={loading ? '…' : fmt(kpis?.adr_usd, '$')}
          sub="USD"
        />
      </div>

      {/* Section nav cards */}
      <h2
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#6B7280',
          marginBottom: 16,
        }}
      >
        Sections
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
        {LINKS.map(({ label, href, description }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'block',
              padding: '20px 24px',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              background: '#FFFFFF',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.boxShadow =
                '0 4px 12px rgba(0,0,0,0.08)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none')
            }
          >
            <div
              style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#111827' }}
            >
              {label}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              {description}
            </div>
          </a>
        ))}
      </div>

      {/* Phase note */}
      <p
        style={{
          marginTop: 40,
          fontSize: 12,
          color: '#9CA3AF',
          textAlign: 'center',
        }}
      >
        Operations — Phase 2.5 foundation. Staff and inventory sub-pages ship in follow-on
        slices.
      </p>
    </main>
  );
}
