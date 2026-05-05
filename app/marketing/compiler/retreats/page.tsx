// app/marketing/compiler/retreats/page.tsx
// All retreats published from the compiler. Status / spots / link.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import DataTable from '@/components/ui/DataTable';
import { fmtIsoDate, fmtKpi } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RetreatRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  arrival_window_from: string;
  arrival_window_to: string;
  spots_total: number;
  spots_booked: number;
  spots_remaining: number;
  price_usd_from: number;
  status: string;
  series_slug: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, StatusTone> = {
  draft: 'pending',
  published: 'active',
  sold_out: 'expired',
  expired: 'inactive',
  cancelled: 'inactive',
};

export default async function RetreatsListPage() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('web').from('retreats')
    .select('id, slug, name, tagline, arrival_window_from, arrival_window_to, spots_total, spots_booked, spots_remaining, price_usd_from, status, series_slug, created_at')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as RetreatRow[];

  return (
    <>
      <PageHeader
        pillar="Marketing"
        tab="Compiler · Retreats"
        title={<>Live <em style={{ color: 'var(--brass)' }}>retreats</em></>}
        lede="All retreats published by the compiler. Click a slug to open the public page."
      />

      {error && (
        <div style={{ marginTop: 12, fontSize: 'var(--t-xs)', color: 'var(--st-bad)' }}>
          DB error: {error.message}
        </div>
      )}

      <div style={{ marginTop: 16, marginBottom: 8 }} className="t-eyebrow">Published · {rows.length}</div>

      <DataTable<RetreatRow>
        rowKey={r => r.id}
        rows={rows}
        defaultSort={{ key: 'created_at', dir: 'desc' }}
        emptyState={
          <span style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontSize: 'var(--t-sm)' }}>
            No retreats published yet. Compile + deploy from the home page.
          </span>
        }
        columns={[
          { key: 'name', header: 'Name', align: 'left', render: r => (
            <Link href={`/r/${r.slug}`} target="_blank" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
              <strong>{r.name}</strong>
              <div style={{ fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
                /r/{r.slug} ↗
              </div>
            </Link>
          ), sortValue: r => r.name },
          { key: 'series_slug', header: 'Series', align: 'left', width: '130px',
            render: r => r.series_slug ?? '—',
            sortValue: r => r.series_slug ?? '' },
          { key: 'window', header: 'Window', align: 'left', width: '180px',
            render: r => `${fmtIsoDate(r.arrival_window_from)} → ${fmtIsoDate(r.arrival_window_to)}`,
            sortValue: r => r.arrival_window_from,
          },
          { key: 'price_usd_from', header: 'From / pax', align: 'right', numeric: true, width: '110px',
            render: r => fmtKpi(r.price_usd_from, 'usd', 0),
            sortValue: r => r.price_usd_from,
          },
          { key: 'spots', header: 'Spots', align: 'right', numeric: true, width: '110px',
            render: r => `${r.spots_remaining} / ${r.spots_total}`,
            sortValue: r => r.spots_remaining,
          },
          { key: 'status', header: 'Status', align: 'center', width: '120px',
            render: r => <StatusPill tone={STATUS_TONE[r.status] ?? 'info'}>{r.status}</StatusPill>,
            sortValue: r => r.status,
          },
          { key: 'created_at', header: 'Deployed', align: 'right', width: '130px',
            render: r => fmtIsoDate(r.created_at),
            sortValue: r => r.created_at,
          },
        ]}
      />

      <div style={{ marginTop: 18, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        <Link href="/marketing/compiler" style={{ color: 'var(--brass)' }}>← BACK TO COMPILER</Link>
      </div>
    </>
  );
}
