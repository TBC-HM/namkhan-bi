// app/revenue/compset/page.tsx
// Source: public.v_compset_overview + public.v_compset_properties (proxies of revenue.* views)
// Read-only; replaces prior mockup stub.

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { SourceCard } from './_components/SourceCard';
import { CompsetTable } from './_components/CompsetTable';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

type Overview = {
  set_id: string;
  set_name: string;
  set_type:
    | 'pms'
    | 'bdc_rate_insights'
    | 'manual'
    | 'external_feed'
    | 'ai_proposed';
  source: string | null;
  is_primary: boolean;
  properties_tracked: number;
  last_rate_shop: string | null;
  freshness: 'fresh' | 'aging' | 'stale' | 'no_data';
  notes: string | null;
};

type PropertyRow = {
  comp_id: string;
  set_id: string;
  set_type: Overview['set_type'];
  property_name: string;
  star_rating: number | null;
  rooms: number | null;
  latest_stay_date: string | null;
  latest_shop_date: string | null;
  latest_rate_usd: number | null;
  avg_rate_usd_30d: number | null;
  observations_30d: number | null;
};

const TYPE_ORDER: Overview['set_type'][] = [
  'pms',
  'bdc_rate_insights',
  'manual',
  'ai_proposed',
];

const TYPE_LABEL: Record<Overview['set_type'], string> = {
  pms: 'Cloudbeds PMS',
  bdc_rate_insights: 'Booking Rate Insights',
  manual: 'Manual Strategic',
  ai_proposed: 'AI Proposed',
  external_feed: 'External feed',
};

export default async function CompsetPage() {
  const [{ data: overview }, { data: properties }] = await Promise.all([
    supabase
      .from('v_compset_overview')
      .select('*')
      .eq('property_id', 260955),
    supabase
      .from('v_compset_properties')
      .select(
        'comp_id, set_id, set_type, property_name, star_rating, rooms, ' +
          'latest_stay_date, latest_shop_date, latest_rate_usd, ' +
          'avg_rate_usd_30d, observations_30d, property_id, is_active'
      )
      .eq('property_id', 260955)
      .eq('is_active', true),
  ]);

  const sets: Overview[] = (overview as unknown as Overview[]) ?? [];
  const props: PropertyRow[] = (properties as unknown as PropertyRow[]) ?? [];

  // Index properties by set_id for the detail tables
  const bySet = new Map<string, PropertyRow[]>();
  for (const p of props) {
    if (!bySet.has(p.set_id)) bySet.set(p.set_id, []);
    bySet.get(p.set_id)!.push(p);
  }

  // Order sets by canonical type order
  const ordered = [...sets].sort(
    (a, b) =>
      TYPE_ORDER.indexOf(a.set_type) - TYPE_ORDER.indexOf(b.set_type)
  );

  const primary = ordered.find((s) => s.is_primary) ?? ordered[0];
  const primaryProps = primary ? bySet.get(primary.set_id) ?? [] : [];

  // Empty-state detection for the primary manual set: peers exist but no rate
  // observations have been logged. Without this banner the page reads as broken
  // (table renders 7 rows of "—") to anyone outside the workflow.
  const manualPrimary =
    primary?.set_type === 'manual' && primary.properties_tracked > 0;
  const ratesLoggedThisWeek = primaryProps.some(
    (p) => p.latest_rate_usd != null && Number(p.latest_rate_usd) > 0
  );
  const showEmptyStateBanner = !!manualPrimary && !ratesLoggedThisWeek;

  // Days since last shop on the primary set — for the urgency tone of the CTA
  const daysSinceLastShop = (() => {
    if (!primary?.last_rate_shop) return null;
    const last = new Date(primary.last_rate_shop + 'T00:00:00');
    const now = new Date();
    return Math.floor((now.getTime() - last.getTime()) / 86_400_000);
  })();

  return (
    <div className="space-y-8 px-8 py-6">
      {/* Empty-state CTA — only when the primary manual set has no rates logged */}
      {showEmptyStateBanner && (
        <div className="rounded-sm border-2 border-emerald-700/50 bg-emerald-50/70 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-emerald-900">
                {daysSinceLastShop == null
                  ? 'No peer rates have been logged yet.'
                  : `No peer rates logged for ${daysSinceLastShop} day${daysSinceLastShop === 1 ? '' : 's'}.`}
              </p>
              <p className="mt-1 text-xs text-emerald-900/80">
                The comparison table below will be empty until you log this
                week&apos;s Booking.com rates for the {primary?.properties_tracked} peers.
                Takes ~5&nbsp;min weekly.
              </p>
            </div>
            <Link
              href="/revenue/compset/manual"
              className="rounded-sm bg-emerald-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white hover:bg-emerald-700"
            >
              Log this week&apos;s rates →
            </Link>
          </div>
        </div>
      )}

      {/* Honest banner */}
      <div className="rounded-sm border border-stone-300 bg-stone-50/80 p-4 text-sm text-stone-700">
        <p>
          <span className="font-medium">What changed:</span> Comp set is no
          longer one source — it&apos;s <strong>4 complementary sources</strong>{' '}
          shown side-by-side. The Cloudbeds API does not expose a comp-set
          rates endpoint, so the PMS source is configuration-only and ages out
          fast. Use the <strong>Manual Strategic</strong> set as your decision
          source until a rate-shop feed is wired.
        </p>
      </div>

      {/* Source cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TYPE_ORDER.map((type) => {
          const s = ordered.find((x) => x.set_type === type);
          if (!s) return null;
          return (
            <SourceCard
              key={s.set_id}
              setId={s.set_id}
              label={TYPE_LABEL[type]}
              setType={type}
              properties={s.properties_tracked}
              lastShop={s.last_rate_shop}
              freshness={s.freshness}
              isPrimary={s.is_primary}
              note={s.notes ?? ''}
            />
          );
        })}
      </section>

      {/* Primary set table */}
      {primary && (
        <section>
          <header className="mb-3 flex items-baseline justify-between">
            <div>
              <h2 className="font-serif text-xl text-stone-900">
                {primary.set_name}{' '}
                <em className="text-stone-400">
                  · {primaryProps.length} properties
                </em>
              </h2>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
                {primary.notes}
              </p>
            </div>
            <Link
              href={`/revenue/compset/manual`}
              className="rounded-sm border border-stone-300 bg-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-700 hover:bg-stone-50"
            >
              Manage manual set →
            </Link>
          </header>

          <CompsetTable
            rows={primaryProps}
            showRates={primary.set_type !== 'pms'}
          />

          {primary.set_type === 'pms' && (
            <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-stone-500">
              No daily rate tracking available from Cloudbeds PMS — peer ADR is
              static configuration. Switch to Manual Strategic for live
              comparisons.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
