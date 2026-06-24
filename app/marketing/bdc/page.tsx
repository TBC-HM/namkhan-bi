// app/marketing/bdc/page.tsx
// Marathon #195 child — Marketing · BDC — adapt + wire
// Wires v_bdc_funnel via service-role Supabase client.
// All columns from the view are treated as optional (unknown shape at commit time).

import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ─── types ────────────────────────────────────────────────────────────────────

interface BdcRow {
  period?: string | null;
  channel?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  bookings?: number | null;
  revenue_usd?: number | null;
  ctr_pct?: number | null;
  conversion_pct?: number | null;
  cost_usd?: number | null;
  roas?: number | null;
  [key: string]: unknown;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, prefix = ''): string {
  if (v == null) return '—';
  return `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)} %`;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function BdcPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('v_bdc_funnel')
    .select('*')
    .order('period', { ascending: false })
    .limit(50);

  const rows: BdcRow[] = data ?? [];

  // ── aggregate KPIs from all returned rows ───────────────────────────────────
  const totalImpressions = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const totalClicks      = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const totalBookings    = rows.reduce((s, r) => s + (r.bookings ?? 0), 0);
  const totalRevenue     = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalCost        = rows.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const avgRoas          = totalCost > 0 ? totalRevenue / totalCost : null;
  const blendedCtr       = totalImpressions > 0
    ? (totalClicks / totalImpressions) * 100
    : null;
  const blendedCvr       = totalClicks > 0
    ? (totalBookings / totalClicks) * 100
    : null;

  // ── table columns ───────────────────────────────────────────────────────────
  const columns = [
    { key: 'period',          header: 'Period'         },
    { key: 'channel',         header: 'Channel'        },
    { key: 'impressions',     header: 'Impressions'    },
    { key: 'clicks',          header: 'Clicks'         },
    { key: 'ctr_pct',         header: 'CTR %'          },
    { key: 'bookings',        header: 'Bookings'       },
    { key: 'conversion_pct',  header: 'CVR %'          },
    { key: 'revenue_usd',     header: 'Revenue (USD)'  },
    { key: 'cost_usd',        header: 'Cost (USD)'     },
    { key: 'roas',            header: 'ROAS'           },
  ];

  // ── format rows for DataTable ────────────────────────────────────────────────
  const tableRows = rows.map((r) => ({
    period:         r.period         ?? '—',
    channel:        r.channel        ?? '—',
    impressions:    fmt(r.impressions),
    clicks:         fmt(r.clicks),
    ctr_pct:        pct(r.ctr_pct),
    bookings:       fmt(r.bookings),
    conversion_pct: pct(r.conversion_pct),
    revenue_usd:    fmt(r.revenue_usd, '$\u00A0'),
    cost_usd:       fmt(r.cost_usd,    '$\u00A0'),
    roas:           r.roas != null ? r.roas.toFixed(2) + '\u00D7' : '—',
  }));

  return (
    <main>
      <PageHeader pillar="Marketing" tab="BDC" title="Booking Distribution Channels" />

      {error && (
        <p style={{ color: 'var(--color-danger, #e74c3c)', padding: '0 24px 16px' }}>
          ⚠ Data unavailable — {error.message}
        </p>
      )}

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div
        className="kpi-strip cols-5"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, padding: '0 24px 24px' }}
      >
        <KpiBox label="Impressions"      value={fmt(totalImpressions)}         />
        <KpiBox label="Clicks"           value={fmt(totalClicks)}              />
        <KpiBox label="Blended CTR"      value={pct(blendedCtr)}              />
        <KpiBox label="Bookings"         value={fmt(totalBookings)}            />
        <KpiBox label="Blended CVR"      value={pct(blendedCvr)}              />
        <KpiBox label="Revenue (USD)"    value={fmt(totalRevenue,  '$\u00A0')} />
        <KpiBox label="Cost (USD)"       value={fmt(totalCost,     '$\u00A0')} />
        <KpiBox label="ROAS"             value={avgRoas != null ? avgRoas.toFixed(2) + '\u00D7' : '—'} />
        <KpiBox label="Channels tracked" value={String(new Set(rows.map((r) => r.channel).filter(Boolean)).size) || '—'} />
        <KpiBox label="Periods"          value={String(new Set(rows.map((r) => r.period).filter(Boolean)).size)  || '—'} />
      </div>

      {/* ── Funnel detail table ─────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 40px' }}>
        <h2
          className="panel-head-title"
          style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          BDC Funnel — by Channel &amp; Period
        </h2>
        <DataTable columns={columns} rows={tableRows} />
      </section>
    </main>
  );
}
