// app/marketing/compiler/page.tsx
// Marketing · Compiler — compset-density home (v1.3, no vanity KPIs).
//
// Layout: prompt → action row (Settings · Pricelist · Live retreats) → recent runs.

import Page from '@/components/page/Page';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import InlinePromptBar from './_components/InlinePromptBar';
import CompilerActionRow from './_components/CompilerActionRow';
import RecentRunsTable, { type RunRow } from './_components/RecentRunsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TEMPLATES = [
  '5 day mindfulness retreat — 4 pax — full moon',
  '3 night detox — 2 pax — green season',
  '7 day river tales — 6 pax — mid tier',
  '4 day retreat life — 6 pax — lux',
];

async function loadAll() {
  const admin = getSupabaseAdmin();
  const [recent, pricelist, retreats] = await Promise.all([
    admin.from('v_compiler_runs')
      .select('id, prompt, status, cost_eur, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin.schema('pricing').from('pricelist').select('*', { head: true, count: 'exact' }).eq('is_active', true),
    admin.from('v_retreats').select('*', { head: true, count: 'exact' }).eq('status', 'published'),
  ]);
  return {
    recent: (recent.data ?? []) as RunRow[],
    pricelistCount: pricelist.count ?? 0,
    retreatsCount: retreats.count ?? 0,
  };
}

export default async function CompilerHomePage() {
  let data: Awaited<ReturnType<typeof loadAll>> | null = null;
  let dbErr: string | null = null;
  try { data = await loadAll(); } catch (e: any) { dbErr = e?.message ?? String(e); }

  return (
    <Page eyebrow="Marketing · Compiler" title={<>Retreat <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>compiler</em></>} subPages={MARKETING_SUBPAGES}>

      <InlinePromptBar presets={TEMPLATES} />

      {dbErr && (
        <div style={{
          marginTop: 14, padding: '8px 12px',
          border: '1px solid var(--st-bad, #b65f4a)',
          borderRadius: 4, fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
          color: 'var(--st-bad, #b65f4a)', background: 'var(--paper-deep, #f5efdf)',
        }}>
          DB ERROR · {dbErr}
        </div>
      )}

      <CompilerActionRow
        actions={[
          {
            href: '/marketing/compiler/settings',
            label: 'Settings',
            meta: 'rate plan defaults · margin floors · property',
          },
          {
            href: '/marketing/compiler/pricelist',
            label: 'Pricelist',
            meta: `${data?.pricelistCount ?? 0} SKUs · sheet sync pending`,
          },
          {
            href: '/marketing/compiler/retreats',
            label: 'Live retreats',
            meta: `${data?.retreatsCount ?? 0} published`,
          },
        ]}
      />

      <div style={{
        marginTop: 22, marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      }}>
        <div className="t-eyebrow">Recent runs</div>
        <div style={{
          fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
          color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)',
        }}>
          v1.3 · NRF rates · stub Stripe / Klaviyo / PDF
        </div>
      </div>

      <RecentRunsTable rows={data?.recent ?? []} />
    </Page>
  );
}
