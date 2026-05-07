// app/revenue-v2/channels/page.tsx
import { createClient } from '@supabase/supabase-js';
import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import PageHeader from '@/components/layout/PageHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChannelRow {
  channel_name?: string | null;
  channel_code?: string | null;
  room_nights?: number | null;
  gross_revenue?: number | null;
  net_revenue?: number | null;
  adr?: number | null;
  commission_pct?: number | null;
  commission_amount?: number | null;
  revenue_share_pct?: number | null;
  reservations?: number | null;
  cancellations?: number | null;
  period_label?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt$( v: number | null | undefined ): string {
  if (v == null) return '—';
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct( v: number | null | undefined ): string {
  if (v == null) return '—';
  return `${(v * (Math.abs(v) <= 1 ? 100 : 1)).toFixed(1)}%`;
}

function fmtN( v: number | null | undefined ): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US');
}

function totalRevenue( rows: ChannelRow[] ): number {
  return rows.reduce((s, r) => s + (r.gross_revenue ?? 0), 0);
}

function totalNights( rows: ChannelRow[] ): number {
  return rows.reduce((s, r) => s + (r.room_nights ?? 0), 0);
}

function blendedADR( rows: ChannelRow[] ): string {
  const nights = totalNights(rows);
  if (nights === 0) return '—';
  return fmt$(totalRevenue(rows) / nights);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function ChannelsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('mv_channel_economics')
    .select('*')
    .order('gross_revenue', { ascending: false })
    .limit(100);

  const rows: ChannelRow[] = data ?? [];

  // Surface the most-recent period label from data if present
  const periodLabel: string = rows[0]?.period_label ?? 'Current Period';

  return (
    <main className="p-6 space-y-6">
      <PageHeader pillar="Revenue" tab="Channels" title="Channel Economics" />

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          Data unavailable: {error.message}
        </div>
      )}

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiBox
          label="Gross Revenue"
          value={fmt$(totalRevenue(rows))}
          sub={periodLabel}
        />
        <KpiBox
          label="Room Nights"
          value={fmtN(totalNights(rows))}
          sub={periodLabel}
        />
        <KpiBox
          label="Blended ADR"
          value={blendedADR(rows)}
          sub="across channels"
        />
        <KpiBox
          label="Active Channels"
          value={rows.length > 0 ? String(rows.length) : '—'}
          sub="by booking source"
        />
      </div>

      {/* Channel breakdown table */}
      <DataTable
        columns={[
          { key: 'channel_name',      header: 'Channel'         },
          { key: 'channel_code',      header: 'Code'            },
          { key: 'room_nights',       header: 'Room Nights'     },
          { key: 'reservations',      header: 'Reservations'    },
          { key: 'cancellations',     header: 'Cancellations'   },
          { key: 'adr',               header: 'ADR'             },
          { key: 'gross_revenue',     header: 'Gross Revenue'   },
          { key: 'net_revenue',       header: 'Net Revenue'     },
          { key: 'commission_pct',    header: 'Commission %'    },
          { key: 'commission_amount', header: 'Commission $'    },
          { key: 'revenue_share_pct', header: 'Rev Share %'     },
        ]}
        rows={rows.map((r) => ({
          channel_name:      r.channel_name      ?? '—',
          channel_code:      r.channel_code      ?? '—',
          room_nights:       fmtN(r.room_nights),
          reservations:      fmtN(r.reservations),
          cancellations:     fmtN(r.cancellations),
          adr:               fmt$(r.adr),
          gross_revenue:     fmt$(r.gross_revenue),
          net_revenue:       fmt$(r.net_revenue),
          commission_pct:    fmtPct(r.commission_pct),
          commission_amount: fmt$(r.commission_amount),
          revenue_share_pct: fmtPct(r.revenue_share_pct),
        }))}
      />
    </main>
  );
}
