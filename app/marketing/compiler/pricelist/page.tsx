// app/marketing/compiler/pricelist/page.tsx
// Read-only view of pricing.pricelist — what the variant builder reads from.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import DataTable from '@/components/ui/DataTable';
import { fmtKpi, EMPTY } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PriceRow {
  sku: string;
  item_name: string;
  source_table: string;
  sell_price_usd: number;
  cost_lak: number;
  margin_pct: number;
  margin_floor_pct: number;
  tier_visibility: string[];
  is_active: boolean;
  usali_category: string | null;
  valid_from: string;
}

export default async function PricelistPage() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .schema('pricing').from('pricelist')
    .select('sku, item_name, source_table, sell_price_usd, cost_lak, margin_pct, margin_floor_pct, tier_visibility, is_active, usali_category, valid_from')
    .order('sku');
  const rows = (data ?? []) as PriceRow[];

  return (
    <>
      <PageHeader
        pillar="Marketing"
        tab="Compiler · Pricelist"
        title={<>Active <em style={{ color: 'var(--brass)' }}>pricelist</em></>}
        lede="Cost stack the variant builder reads from. Rooms come from Cloudbeds rate_inventory directly — these are everything else (board, activities, spa, ceremonies, workshops, transport, addons)."
      />

      <div style={{
        marginTop: 14, padding: '10px 14px',
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 6,
        fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
        color: 'var(--ink-mute)',
        letterSpacing: 'var(--ls-loose)',
      }}>
        SHEET SYNC · NOT CONNECTED · using {rows.length} baseline SKUs · wire Sheets MCP to import "Namkhan Packages 1.2"
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 'var(--t-xs)', color: 'var(--st-bad)' }}>
          DB error: {error.message}
        </div>
      )}

      <div style={{ marginTop: 18, marginBottom: 8 }} className="t-eyebrow">SKUs · {rows.length}</div>

      <DataTable<PriceRow>
        rowKey={r => r.sku}
        rows={rows}
        defaultSort={{ key: 'sku', dir: 'asc' }}
        columns={[
          { key: 'sku', header: 'SKU', align: 'left', width: '140px',
            render: r => <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.sku}</span>,
            sortValue: r => r.sku,
          },
          { key: 'item_name', header: 'Item', align: 'left', render: r => <strong>{r.item_name}</strong>, sortValue: r => r.item_name },
          { key: 'source_table', header: 'Source', align: 'left', width: '170px',
            render: r => <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{r.source_table}</span>,
            sortValue: r => r.source_table,
          },
          { key: 'usali_category', header: 'USALI', align: 'left', width: '110px',
            render: r => r.usali_category ?? EMPTY,
            sortValue: r => r.usali_category ?? '',
          },
          { key: 'sell_price_usd', header: 'Sell', align: 'right', numeric: true, width: '90px',
            render: r => fmtKpi(r.sell_price_usd, 'usd', 0),
            sortValue: r => r.sell_price_usd,
          },
          { key: 'cost_lak', header: 'Cost ₭', align: 'right', numeric: true, width: '120px',
            render: r => `₭${(r.cost_lak / 1000).toFixed(0)}k`,
            sortValue: r => r.cost_lak,
          },
          { key: 'margin_pct', header: 'Margin', align: 'right', numeric: true, width: '90px',
            render: r => fmtKpi(r.margin_pct, 'pct', 1),
            sortValue: r => r.margin_pct,
          },
          { key: 'margin_floor_pct', header: 'Floor', align: 'right', numeric: true, width: '70px',
            render: r => fmtKpi(r.margin_floor_pct, 'pct', 0),
            sortValue: r => r.margin_floor_pct,
          },
          { key: 'tier_visibility', header: 'Tiers', align: 'left', width: '120px',
            render: r => (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {(r.tier_visibility ?? []).join(' · ')}
              </span>
            ),
          },
          { key: 'is_active', header: 'Status', align: 'center', width: '90px',
            render: r => r.is_active ? <StatusPill tone="active">active</StatusPill> : <StatusPill tone="inactive">off</StatusPill>,
            sortValue: r => r.is_active ? 1 : 0,
          },
        ]}
      />

      <div style={{ marginTop: 18, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        <Link href="/marketing/compiler" style={{ color: 'var(--brass)' }}>← BACK TO COMPILER</Link>
      </div>
    </>
  );
}
