export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import React from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type PosterRow = {
  id: number;
  month: string;
  category: string;
  revenue: number;
  cost: number;
  profit: number;
};

async function getPosterData(): Promise<PosterRow[]> {
  const { data, error } = await supabase
    .from('finance_poster_report')
    .select('*')
    .order('month', { ascending: false });
  if (error || !data) return [];
  return data as PosterRow[];
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

export default async function FinancePosterReportPage() {
  const rows = await getPosterData();

  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) + '%' : '—';

  return (
    <main style={{ padding: 'var(--space-6, 1.5rem)', fontFamily: 'var(--font-body, sans-serif)', color: 'var(--ink)' }}>
      {/* Page header */}
      <header style={{ marginBottom: 'var(--space-5, 1.25rem)' }}>
        <h1 style={{ fontSize: 'var(--t-xl, 1.25rem)', fontWeight: 700, margin: 0 }}>Finance · Poster Report</h1>
        <p style={{ fontSize: 'var(--t-sm, 0.8125rem)', color: 'var(--ink-muted)', margin: '0.25rem 0 0' }}>
          Revenue, cost, and profit summary across all poster categories.
        </p>
      </header>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-4, 1rem)',
          marginBottom: 'var(--space-6, 1.5rem)',
        }}
      >
        {[
          { label: 'Total Revenue', value: fmt(totalRevenue) },
          { label: 'Total Cost', value: fmt(totalCost) },
          { label: 'Total Profit', value: fmt(totalProfit) },
          { label: 'Margin', value: margin },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'var(--surface, #fff)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 'var(--radius, 0.5rem)',
              padding: 'var(--space-4, 1rem)',
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--t-xs, 0.75rem)', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </p>
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: 'var(--t-2xl, 1.5rem)',
                fontFamily: 'Fraunces, serif',
                fontStyle: 'italic',
                color: 'var(--brass, #b5862b)',
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Data table */}
      <div
        style={{
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 'var(--radius, 0.5rem)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 'var(--space-4, 1rem)', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--t-base, 0.9375rem)', fontWeight: 600 }}>Line Items</h2>
        </div>
        {rows.length === 0 ? (
          <p style={{ padding: 'var(--space-4, 1rem)', color: 'var(--ink-muted)', fontSize: 'var(--t-sm, 0.8125rem)' }}>
            No data available.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm, 0.8125rem)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt, #f9fafb)' }}>
                  {['Month', 'Category', 'Revenue', 'Cost', 'Profit'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '0.5rem 1rem',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--ink-muted)',
                        borderBottom: '1px solid var(--border, #e5e7eb)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid var(--border-subtle, #f3f4f6)' }}
                  >
                    <td style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>{r.month ?? '—'}</td>
                    <td style={{ padding: '0.5rem 1rem' }}>{r.category ?? '—'}</td>
                    <td style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>{fmt(r.revenue)}</td>
                    <td style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>{fmt(r.cost)}</td>
                    <td
                      style={{
                        padding: '0.5rem 1rem',
                        whiteSpace: 'nowrap',
                        color: (r.profit ?? 0) >= 0 ? 'var(--moss, #3d6b4f)' : 'var(--rose, #b94a4a)',
                        fontWeight: 600,
                      }}
                    >
                      {fmt(r.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
