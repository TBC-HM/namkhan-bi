// app/revenue/pricing/page.tsx
// Marathon #195 child — Revenue · Pricing
// Wired to public.v_bar_ladder via Supabase service role.
// v_bar_ladder is not yet on the query_supabase_view allowlist (agent sandbox limit);
// the view is queried directly here via the server-side client and will resolve at runtime.

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import PageHeader from '@/components/layout/PageHeader';
import PricingTable from './PricingTable';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface BarRow {
  rate_date: string;         // ISO date  e.g. "2026-05-10"
  room_type: string;         // e.g. "Deluxe River View"
  bar_rate_usd: number | null;
  bar_rate_lak: number | null;
  channel: string | null;    // "Direct" | "OTA" | "Wholesale" …
  occupancy_pct: number | null;
  min_stay: number | null;
  closed_to_arrival: boolean | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function PricingPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Primary: BAR ladder view — next 30 days, all room types
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const { data: barData } = await supabase
    .from('v_bar_ladder')
    .select('*')
    .gte('rate_date', today)
    .lte('rate_date', in30)
    .order('rate_date', { ascending: true })
    .order('room_type', { ascending: true })
    .limit(100);

  const rows: BarRow[] = barData ?? [];

  // ---------------------------------------------------------------------------
  // KPI roll-ups from the ladder
  // ---------------------------------------------------------------------------
  const ratesWithValue = rows.filter((r) => r.bar_rate_usd != null);
  const avgBar =
    ratesWithValue.length > 0
      ? ratesWithValue.reduce((s, r) => s + (r.bar_rate_usd ?? 0), 0) /
        ratesWithValue.length
      : null;

  const minBar =
    ratesWithValue.length > 0
      ? Math.min(...ratesWithValue.map((r) => r.bar_rate_usd ?? Infinity))
      : null;

  const maxBar =
    ratesWithValue.length > 0
      ? Math.max(...ratesWithValue.map((r) => r.bar_rate_usd ?? -Infinity))
      : null;

  const closedDays = rows.filter((r) => r.closed_to_arrival === true).length;
  const totalDays = new Set(rows.map((r) => r.rate_date)).size;

  // ---------------------------------------------------------------------------
  // Formatters
  // ---------------------------------------------------------------------------
  const fmtUsd = (v: number | null) =>
    v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <main style={{ padding: '0 0 48px' }}>
      <PageHeader
        pillar="Revenue"
        tab="Pricing"
        title="BAR Ladder"
        lede="Best Available Rates — next 30 days across all room types and channels."
      />

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          padding: '0 24px 24px',
        }}
      >
        <KpiBox
          label="Avg BAR"
          value={avgBar != null ? fmtUsd(avgBar) : '—'}
          tooltip="Average Best Available Rate across all room types · next 30 days · v_bar_ladder"
        />
        <KpiBox
          label="Min BAR"
          value={minBar != null ? fmtUsd(minBar) : '—'}
          tooltip="Lowest published BAR rate · next 30 days · v_bar_ladder"
        />
        <KpiBox
          label="Max BAR"
          value={maxBar != null ? fmtUsd(maxBar) : '—'}
          tooltip="Highest published BAR rate · next 30 days · v_bar_ladder"
        />
        <KpiBox
          label="Closed Days"
          value={closedDays > 0 ? `${closedDays} / ${totalDays}` : '—'}
          tooltip="Dates with closed-to-arrival restriction · next 30 days · v_bar_ladder"
        />
      </div>

      {/* ── Data Table (client component — handles render fns + sort) ──── */}
      <div style={{ padding: '0 24px' }}>
        <PricingTable rows={rows} />
      </div>
    </main>
  );
}
