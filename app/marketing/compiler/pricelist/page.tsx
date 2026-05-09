// app/marketing/compiler/pricelist/page.tsx
// Read-only view of pricing.pricelist — what the variant builder reads from.

import Link from 'next/link';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../../_subpages';
import StatusPill from '@/components/ui/StatusPill';
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
    <Page eyebrow="Marketing · Compiler · Pricelist" title={<>Active <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>pricelist</em></>} subPages={MARKETING_SUBPAGES}>

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

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-sm)' }}>
        <thead>
          <tr>
            {['SKU','Item','Source','USALI','Sell','Cost ₭','Margin','Floor','Tiers','Status'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sku} style={{ borderBottom: '1px solid var(--paper-warm)' }}>
              <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.sku}</td>
              <td style={{ padding: '6px 12px' }}><strong>{r.item_name}</strong></td>
              <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{r.source_table}</td>
              <td style={{ padding: '6px 12px' }}>{r.usali_category ?? EMPTY}</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtKpi(r.sell_price_usd, 'usd', 0)}</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>₭{(r.cost_lak / 1000).toFixed(0)}k</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtKpi(r.margin_pct, 'pct', 1)}</td>
              <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtKpi(r.margin_floor_pct, 'pct', 0)}</td>
              <td style={{ padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{(r.tier_visibility ?? []).join(' · ')}</td>
              <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                {r.is_active ? <StatusPill tone="active">active</StatusPill> : <StatusPill tone="inactive">off</StatusPill>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 18, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        <Link href="/marketing/compiler" style={{ color: 'var(--brass)' }}>← BACK TO COMPILER</Link>
      </div>
    </Page>
  );
}
