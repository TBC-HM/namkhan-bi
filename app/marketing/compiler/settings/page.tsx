// app/marketing/compiler/settings/page.tsx
// Compiler config — read-only display of defaults the variant builder uses.
// v1: source-of-truth is hardcoded in lib/compiler/* and env vars. v1.1 will
// move these to a `compiler.settings` jsonb row so they're editable.

import Link from 'next/link';
import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../../_subpages';
import StatusPill from '@/components/ui/StatusPill';
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
    <Page eyebrow="Marketing · Compiler · Settings" title={<>Compiler <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>settings</em></>} subPages={MARKETING_SUBPAGES}>

      <div style={{ marginTop: 16, marginBottom: 8 }} className="t-eyebrow">Configuration</div>

      <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)' }}>Key</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)' }}>Value</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)' }}>Source</th>
            <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--paper-deep)', width: 110 }}>Editable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--paper-warm)' }}><strong>{r.key}</strong></td>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--paper-warm)' }}>{r.value}</td>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--paper-warm)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{r.source}</td>
              <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--paper-warm)', textAlign: 'center' }}>
                {r.editable === 'live' ? <StatusPill tone="active">live</StatusPill>
                  : r.editable === 'env' ? <StatusPill tone="info">env var</StatusPill>
                  : <StatusPill tone="pending">v1.1</StatusPill>}
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
