// app/marketing/compiler/page.tsx
// PBS 2026-07-05: Compiler hub — new paper-white design.
// Migrated from legacy <Page> shell to DashboardPage + KpiTile.
// Preserves the CompilerCockpit (Ongoing offers · Fixed retreats · Lock &
// Distribute wizard), InlinePromptBar, action tiles, and Recent runs table.
//
// Data sources (all LIVE):
//   • v_compiler_runs           → recent generation runs (id, prompt, status, cost, ts)
//   • pricing.pricelist         → active SKU count
//   • v_retreats                → published retreat count

import type { CSSProperties } from 'react';
import TenantLink from '@/components/nav/TenantLink';
import {
  DashboardPage, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import { MARKETING_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import InlinePromptBar from './_components/InlinePromptBar';
import CompilerActionRow from './_components/CompilerActionRow';
import RecentRunsTable, { type RunRow } from './_components/RecentRunsTable';
import CompilerCockpit from './_components/CompilerCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const CREAM = '#F7F0E1';
const FOREST= '#084838';
const RED   = '#B03826';

type CompilerView = 'ongoing' | 'fixed' | 'lock';
function parseCompilerView(v: string | string[] | undefined): CompilerView {
  const s = typeof v === 'string' ? v : 'ongoing';
  return (['ongoing', 'fixed', 'lock'] as string[]).includes(s) ? (s as CompilerView) : 'ongoing';
}

const TEMPLATES = [
  '5 day mindfulness retreat — 4 pax — full moon',
  '3 night detox — 2 pax — green season',
  '7 day river tales — 6 pax — mid tier',
  '4 day retreat life — 6 pax — lux',
];

interface TemplateRow {
  id: string;
  template_name: string;
  slug: string;
  theme: string;
  tier: string;
  duration_nights: number;
  season: string[] | null;
  lunar_required: boolean;
}

async function loadAll() {
  const admin = getSupabaseAdmin();
  const [recent, pricelist, retreats, templates] = await Promise.all([
    admin.from('v_compiler_runs')
      .select('id, prompt, status, cost_eur, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin.schema('pricing').from('pricelist').select('*', { head: true, count: 'exact' }).eq('is_active', true),
    admin.from('v_retreats').select('*', { head: true, count: 'exact' }).eq('status', 'published'),
    // PBS 2026-07-09 pm: seed templates now populated (5 rows) — surface as one-click starters.
    admin.schema('compiler').from('itinerary_templates')
      .select('id, template_name, slug, theme, tier, duration_nights, season, lunar_required')
      .eq('is_active', true).order('duration_nights'),
  ]);
  return {
    recent: (recent.data ?? []) as RunRow[],
    pricelistCount: pricelist.count ?? 0,
    retreatsCount: retreats.count ?? 0,
    templates: (templates.data ?? []) as TemplateRow[],
  };
}

function templateToPrompt(t: TemplateRow): string {
  const seasonStr = (t.season && t.season.length > 0) ? ` — ${t.season.join('/')} season` : '';
  const lunar = t.lunar_required ? ' — full moon' : '';
  return `${t.duration_nights} day ${t.theme.replace('-',' ')} retreat — ${t.tier} tier${seasonStr}${lunar} — 4 pax`;
}

interface Props { searchParams?: { view?: string; offer?: string } }

export default async function CompilerHomePage({ searchParams }: Props) {
  let data: Awaited<ReturnType<typeof loadAll>> | null = null;
  let dbErr: string | null = null;
  try { data = await loadAll(); } catch (e: any) { dbErr = e?.message ?? String(e); }

  const view = parseCompilerView(searchParams?.view);
  const selectedOfferId = typeof searchParams?.offer === 'string' ? searchParams.offer : undefined;

  const recent = data?.recent ?? [];
  // Status buckets aligned to RecentRunsTable's STATUS_TONE mapping:
  //   deployed → active/ok · halted → bad · draft/compiling/rendering → in progress
  const okRuns      = recent.filter(r => r.status === 'deployed' || r.status === 'ready').length;
  const inProgress  = recent.filter(r => r.status === 'compiling' || r.status === 'rendering' || r.status === 'draft').length;
  const failRuns    = recent.filter(r => r.status === 'halted' || r.status === 'error' || r.status === 'failed').length;
  const totalCost   = recent.reduce((s, r) => s + (Number(r.cost_eur) || 0), 0);

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/compiler',
  }));

  const templates = data?.templates ?? [];
  const templatePrompts = templates.map(templateToPrompt);

  const tiles: KpiTileProps[] = [
    { label: 'Recent runs',     value: recent.length,         size: 'sm', footnote: 'last 20 shown' },
    { label: 'Deployed',        value: okRuns,                size: 'sm', footnote: 'ready / deployed' },
    { label: 'In progress',     value: inProgress,            size: 'sm', footnote: 'draft / compiling' },
    { label: 'Halted',          value: failRuns,              size: 'sm', footnote: 'error / halted' },
    { label: 'Cost · recent',   value: `€${totalCost.toFixed(2)}`, size: 'sm', footnote: 'sum · last 20' },
    { label: 'Templates',       value: templates.length,      size: 'sm', footnote: 'seed itineraries' },
    { label: 'Pricelist SKUs',  value: data?.pricelistCount ?? 0, size: 'sm', footnote: 'active' },
    { label: 'Live retreats',   value: data?.retreatsCount ?? 0,  size: 'sm', footnote: 'published' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Compiler"
        subtitle={`Retreat compiler · v1.3 · NRF rates · stub Stripe / Klaviyo / PDF · ${recent.length} recent run${recent.length === 1 ? '' : 's'}`}
        tabs={tabs}
      >
        {/* KPI strip */}
        <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* 2-tab cockpit: Ongoing offers · Fixed retreats. Lock wizard via ?view=lock&offer=<id> */}
        <div style={fullRow}>
          <CompilerCockpit view={view} selectedOfferId={selectedOfferId} />
        </div>

        {/* Prompt bar — presets now come from compiler.itinerary_templates + hardcoded fallbacks */}
        <div style={fullRow}>
          <InlinePromptBar presets={templatePrompts.length > 0 ? templatePrompts : TEMPLATES} />
        </div>

        {/* PBS 2026-07-09 pm: Seed templates surface — one-click starters */}
        {templates.length > 0 && (
          <div style={fullRow}>
            <div style={{ padding: 14, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: INK_M, marginBottom: 8 }}>
                Seed templates · click one to prefill the prompt
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {templates.map((t) => (
                  <div key={t.id} style={{ padding: 12, border: '1px solid ' + HAIR, borderRadius: 4, background: CREAM }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4 }}>{t.template_name}</div>
                    <div style={{ fontSize: 11, color: INK_M, marginBottom: 8 }}>
                      {t.duration_nights} nights · {t.theme.replace('-', ' ')} · {t.tier} tier
                      {t.lunar_required ? ' · lunar' : ''}
                      {t.season && t.season.length > 0 ? ' · ' + t.season.join('/') : ''}
                    </div>
                    <div style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: INK_M, background: WHITE, padding: 8, borderRadius: 3, border: '1px solid ' + HAIR }}>
                      {templateToPrompt(t)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {dbErr && (
          <div style={{ ...fullRow, ...errBox }}>
            <span style={{ fontWeight: 700, marginRight: 8 }}>DB ERROR</span>{dbErr}
          </div>
        )}

        {/* Action tiles: Settings · Pricelist · Live retreats */}
        <div style={fullRow}>
          <CompilerActionRow
            actions={[
              { href: '/marketing/compiler/settings', label: 'Settings',
                meta: 'rate plan defaults · margin floors · property' },
              { href: '/marketing/compiler/pricelist', label: 'Pricelist',
                meta: `${data?.pricelistCount ?? 0} SKUs · sheet sync pending` },
              { href: '/marketing/compiler/retreats', label: 'Live retreats',
                meta: `${data?.retreatsCount ?? 0} published` },
            ]}
          />
        </div>

        {/* Recent runs */}
        <div style={fullRow}>
          <div style={{ ...sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Recent runs · {recent.length}</span>
            <span style={{ fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: INK_M, letterSpacing: '0.06em' }}>
              v1.3 · NRF rates · stub Stripe / Klaviyo / PDF
            </span>
          </div>
          <RecentRunsTable rows={recent} />
        </div>
      </DashboardPage>
    </div>
  );
}

const fullRow: CSSProperties = { gridColumn: '1 / -1' };
const sectionHeader: CSSProperties = {
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_M, fontWeight: 600, margin: '8px 2px 8px',
};
const errBox: CSSProperties = {
  padding: '8px 12px', background: '#FBE8E4', color: '#8A2419',
  border: '1px solid #E8B7AB', borderLeft: '3px solid ' + RED,
  borderRadius: 6, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
