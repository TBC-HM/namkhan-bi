// app/marketing/compiler/settings/page.tsx
// Compiler config — read-only display of defaults the variant builder uses.
// v1: source-of-truth is hardcoded in lib/compiler/* and env vars. v1.1 will
// move these to a `compiler.settings` jsonb row so they're editable.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import StatusPill from '@/components/ui/StatusPill';
import DataTable from '@/components/ui/DataTable';
import { fmtKpi } from '@/lib/format';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_RATE_PLAN_ID, listNrfRatePlans } from '@/lib/compiler/roomPricing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SettingRow { key: string; value: string; source: string; editable: 'live' | 'env' | 'soon'; }

export default async function CompilerSettingsPage() {
  const admin = getSupabaseAdmin();
  let defaultRateName = 'Non Refundable';
  try {
    const plans = await listNrfRatePlans();
    defaultRateName = plans.find(p => p.rate_id === DEFAULT_RATE_PLAN_ID)?.rate_name ?? defaultRateName;
  } catch {}

  const { count: pricelistCount } = await admin
    .schema('pricing').from('pricelist').select('*', { head: true, count: 'exact' }).eq('is_active', true);
  const { count: seasonsCount } = await admin
    .schema('pricing').from('seasons').select('*', { head: true, count: 'exact' });

  const rows: SettingRow[] = [
    { key: 'Property',                     value: 'namkhan',                              source: 'NEXT_PUBLIC_PROPERTY_ID',           editable: 'env' },
    { key: 'Default rate plan',            value: `${defaultRateName} (id ${DEFAULT_RATE_PLAN_ID})`, source: 'lib/compiler/roomPricing.ts',       editable: 'soon' },
    { key: 'Default window',               value: '2026-05-01 → 2026-09-30',              source: 'OfferConfigForm initial state',     editable: 'soon' },
    { key: 'Default currency',             value: 'USD (LAK base)',                        source: 'NEXT_PUBLIC_DEFAULT_CURRENCY',      editable: 'env' },
    { key: 'FX lock days',                 value: '7',                                     source: 'FX_LOCK_DAYS env (fallback 7)',     editable: 'env' },
    { key: 'Margin floor · rooms',         value: '60%',                                   source: 'MARGIN_FLOOR_ROOMS_PCT (fallback)', editable: 'env' },
    { key: 'Margin floor · F&B',           value: '70%',                                   source: 'MARGIN_FLOOR_FNB_PCT (fallback)',   editable: 'env' },
    { key: 'Margin floor · activities',    value: '35%',                                   source: 'MARGIN_FLOOR_ACT_PCT (fallback)',   editable: 'env' },
    { key: 'Variant intensity ladder',     value: 'cheapest=light · mid=medium · dearest=full', source: 'lib/compiler/variants.ts',       editable: 'soon' },
    { key: 'Recommended marker',           value: 'middle variant by price (auto)',        source: 'lib/compiler/variants.ts',          editable: 'soon' },
    { key: 'Deposit % at booking',         value: '30%',                                   source: 'app/api/checkout/session/route.ts', editable: 'soon' },
    { key: 'Balance due',                  value: 'arrival − 30 days',                     source: 'spec',                              editable: 'soon' },
    { key: 'Active pricelist SKUs',        value: String(pricelistCount ?? 0),             source: 'pricing.pricelist',                 editable: 'live' },
    { key: 'Rate seasons',                 value: String(seasonsCount ?? 0),               source: 'pricing.seasons',                   editable: 'live' },
    { key: 'Parser model',                 value: 'regex (MVP)',                           source: 'lib/compiler/parse.ts',             editable: 'soon' },
    { key: 'Variant builder',              value: 'real Cloudbeds NRF rate × selection',   source: 'lib/compiler/variants.ts',          editable: 'live' },
    { key: 'PDF render',                   value: 'STUB · returns placeholder URL',        source: 'app/api/compiler/runs/[id]/render', editable: 'soon' },
    { key: 'Stripe checkout',              value: 'STUB · holds booking, no charge',       source: 'STRIPE_SECRET_KEY missing',         editable: 'env' },
    { key: 'Cloudbeds reserve on payment', value: 'STUB · not auto-created',               source: 'CLOUDBEDS_REFRESH_TOKEN missing',   editable: 'env' },
    { key: 'Klaviyo lead flow',            value: 'STUB · capture writes to web.subscribers, no flow',  source: 'KLAVIYO_PRIVATE_KEY missing', editable: 'env' },
  ];

  return (
    <>
      <PageHeader
        pillar="Marketing"
        tab="Compiler · Settings"
        title={<>Compiler <em style={{ color: 'var(--brass)' }}>settings</em></>}
        lede="What the variant builder uses by default. v1 read-only — env vars editable in Vercel, code-default settings move to an editable `compiler.settings` table in v1.1."
      />

      <div style={{ marginTop: 16, marginBottom: 8 }} className="t-eyebrow">Configuration</div>

      <DataTable<SettingRow>
        rowKey={r => r.key}
        rows={rows}
        columns={[
          { key: 'key', header: 'Key', align: 'left', render: r => <strong>{r.key}</strong>, sortValue: r => r.key },
          { key: 'value', header: 'Value', align: 'left', render: r => r.value, sortValue: r => r.value },
          { key: 'source', header: 'Source', align: 'left', render: r => (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{r.source}</span>
          ) },
          { key: 'editable', header: 'Editable', align: 'center', width: '110px', render: r => (
            r.editable === 'live' ? <StatusPill tone="active">live</StatusPill>
            : r.editable === 'env' ? <StatusPill tone="info">env var</StatusPill>
            : <StatusPill tone="pending">v1.1</StatusPill>
          ) },
        ]}
      />

      <div style={{ marginTop: 18, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>
        <Link href="/marketing/compiler" style={{ color: 'var(--brass)' }}>← BACK TO COMPILER</Link>
      </div>
    </>
  );
}
