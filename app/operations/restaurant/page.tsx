'use client';

import { useEffect, useState } from 'react';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';

interface RestaurantRow {
  date?: string;
  meal_period?: string;
  covers?: number;
  revenue?: number;
  revenue_lak?: number;
  avg_spend_usd?: number;
  avg_spend_lak?: number;
  voids?: number;
  discounts_usd?: number;
  food_cost_pct?: number;
  beverage_cost_pct?: number;
  table_turns?: number;
  no_shows?: number;
  reservations?: number;
  walk_ins?: number;
  staff_count?: number;
}

const COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'meal_period', header: 'Period' },
  { key: 'covers', header: 'Covers' },
  { key: 'revenue_fmt', header: 'Revenue (USD)' },
  { key: 'revenue_lak_fmt', header: 'Revenue (LAK)' },
  { key: 'avg_spend_fmt', header: 'Avg Spend' },
  { key: 'food_cost_pct_fmt', header: 'Food Cost %' },
  { key: 'beverage_cost_pct_fmt', header: 'Bev Cost %' },
  { key: 'table_turns', header: 'Table Turns' },
  { key: 'reservations', header: 'Reservations' },
  { key: 'walk_ins', header: 'Walk-ins' },
  { key: 'no_shows', header: 'No-shows' },
];

function fmt(v: number | undefined | null, prefix = '$', decimals = 0): string {
  if (v == null) return '\u2014';
  return `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function pct(v: number | undefined | null): string {
  if (v == null) return '\u2014';
  return `${v.toFixed(1)}%`;
}

export default function RestaurantPage() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/operations/restaurant')
      .then((r) => r.json())
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const latest = rows[0] ?? {};
  const totalCovers = rows.reduce((s, r) => s + (r.covers ?? 0), 0);
  const totalRevenue = rows.reduce((s, r) => s + (r.revenue ?? 0), 0);
  const avgSpend = totalCovers > 0 ? totalRevenue / totalCovers : null;
  const avgFoodCostRows = rows.filter((r) => r.food_cost_pct != null);
  const avgFoodCost =
    avgFoodCostRows.length > 0
      ? avgFoodCostRows.reduce((s, r) => s + (r.food_cost_pct ?? 0), 0) / avgFoodCostRows.length
      : null;

  const tableRows = rows.map((r) => ({
    ...r,
    date: r.date ?? '\u2014',
    meal_period: r.meal_period ?? '\u2014',
    covers: r.covers ?? '\u2014',
    revenue_fmt: fmt(r.revenue, '$'),
    revenue_lak_fmt: fmt(r.revenue_lak, '\u20AD'),
    avg_spend_fmt: fmt(r.avg_spend_usd, '$', 2),
    food_cost_pct_fmt: pct(r.food_cost_pct),
    beverage_cost_pct_fmt: pct(r.beverage_cost_pct),
    table_turns: r.table_turns ?? '\u2014',
    reservations: r.reservations ?? '\u2014',
    walk_ins: r.walk_ins ?? '\u2014',
    no_shows: r.no_shows ?? '\u2014',
  }));

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#000',
        color: '#fff',
        padding: '24px',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}
    >
      <PageHeader pillar="Operations" tab="Restaurant" title="Restaurant" />

      {loading && (
        <p style={{ color: '#888', marginTop: 24 }}>Loading\u2026</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <KpiBox label="Total Covers" value={totalCovers > 0 ? String(totalCovers) : (latest.covers != null ? String(latest.covers) : '\u2014')} />
        <KpiBox label="Total Revenue" value={fmt(totalRevenue > 0 ? totalRevenue : (latest.revenue ?? null), '$')} />
        <KpiBox label="Avg Spend / Cover" value={fmt(avgSpend ?? latest.avg_spend_usd ?? null, '$', 2)} />
        <KpiBox label="Food Cost %" value={pct(avgFoodCost ?? latest.food_cost_pct ?? null)} />
        <KpiBox label="Bev Cost %" value={pct(latest.beverage_cost_pct ?? null)} />
        <KpiBox label="Table Turns" value={latest.table_turns != null ? String(latest.table_turns) : '\u2014'} />
        <KpiBox label="Reservations" value={latest.reservations != null ? String(latest.reservations) : '\u2014'} />
        <KpiBox label="No-shows" value={latest.no_shows != null ? String(latest.no_shows) : '\u2014'} />
      </div>

      <DataTable columns={COLUMNS} rows={tableRows} />
    </main>
  );
}
