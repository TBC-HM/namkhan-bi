// app/revenue/page.tsx
// Revenue dept entry — v2 layout restored 2026-05-08 per PBS directive.
// PBS reference: this is the page that shipped in PR #173. Greeting strip,
// 4-tile KPI strip (Occ / ADR / RevPAR / Revenue) and a sub-page chip grid
// linking to every existing revenue surface. No chat on the entry page —
// chat lives at /chat or /architect.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import ChatShell from '@/components/chat/ChatShell';
import { resolvePeriod } from '@/lib/period';
import { getOverviewKpis } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface Props { searchParams: Record<string, string | string[] | undefined>; }

const SUB_PAGES = [
  { href: '/revenue/pulse',     label: 'Pulse',      hint: '6-graph snapshot · alerts' },
  { href: '/revenue/pace',      label: 'Pace',       hint: 'OTB curve · pickup' },
  { href: '/revenue/channels',  label: 'Channels',   hint: 'BDC, Expedia, direct mix' },
  { href: '/revenue/pricing',   label: 'Pricing',    hint: 'BAR ladder · room types' },
  { href: '/revenue/rateplans', label: 'Rate Plans', hint: 'Plan inventory · LOS' },
  { href: '/revenue/compset',   label: 'Comp Set',   hint: 'MPI · ARI · RGI' },
  { href: '/revenue/parity',    label: 'Parity',     hint: 'OTA vs direct breaches' },
  { href: '/revenue/agents',    label: 'Agents',     hint: 'Variance · pricing AI' },
  { href: '/revenue/demand',    label: 'Demand',     hint: 'Search · book window' },
  { href: '/revenue/promotions',label: 'Promotions', hint: 'Active rates · stops' },
  { href: '/revenue/inventory', label: 'Inventory',  hint: 'Holds · close-outs' },
] as const;

export default async function RevenueIndexPage({ searchParams }: Props) {
  const period = resolvePeriod(searchParams);

  // Best-effort KPIs — never throw, render empties if data isn't there.
  let kpis: any = null;
  try { kpis = await getOverviewKpis(period); } catch { kpis = null; }

  const cur = (Array.isArray(kpis) ? kpis.find?.((r: any) => r.period === 'cur') : kpis?.cur) ?? null;
  const cmp = (Array.isArray(kpis) ? kpis.find?.((r: any) => r.period === 'cmp') : kpis?.cmp) ?? null;

  const occ      = num(cur?.occupancy_pct ?? cur?.occ ?? cur?.occupancy);
  const adr      = num(cur?.adr_usd ?? cur?.adr);
  const revpar   = num(cur?.revpar_usd ?? cur?.revpar);
  const revenue  = num(cur?.revenue_usd ?? cur?.revenue);

  const occPrior     = num(cmp?.occupancy_pct ?? cmp?.occ ?? cmp?.occupancy);
  const adrPrior     = num(cmp?.adr_usd ?? cmp?.adr);
  const revparPrior  = num(cmp?.revpar_usd ?? cmp?.revpar);
  const revenuePrior = num(cmp?.revenue_usd ?? cmp?.revenue);

  return (
    <main style={{ background: 'var(--bg-page, #0a0a08)', minHeight: '100vh', padding: '32px 28px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* greeting strip */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 28, gap: 16,
        }}>
          <div style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--brass, #a8854a)',
            fontFamily: 'Menlo, monospace',
          }}>
            BOSS · PAUL BAUER
          </div>
          <Link href="/" style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--ink-mute, #888)',
            fontFamily: 'Menlo, monospace', textDecoration: 'none',
          }}>
            ← HOME
          </Link>
        </div>

        <PageHeader
          pillar="Namkhan"
          tab="Revenue"
          title={<>Revenue, <em style={{ color: 'var(--brass, #a8854a)', fontStyle: 'italic' }}>at a glance</em>.</>}
          lede={`${period.from} → ${period.to}`}
        />

        {/* KPI strip */}
        <section style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          marginTop: 28, marginBottom: 36,
        }}>
          <KpiBox
            label="Occupancy"
            value={occ}
            unit="pct"
            delta={delta1(occ, occPrior, 'pp')}
            state={occ === null ? 'data-needed' : 'live'}
          />
          <KpiBox
            label="ADR"
            value={adr}
            unit="usd"
            delta={delta1(adr, adrPrior, '%')}
            state={adr === null ? 'data-needed' : 'live'}
          />
          <KpiBox
            label="RevPAR"
            value={revpar}
            unit="usd"
            delta={delta1(revpar, revparPrior, '%')}
            state={revpar === null ? 'data-needed' : 'live'}
          />
          <KpiBox
            label="Revenue"
            value={revenue}
            unit="usd"
            delta={delta1(revenue, revenuePrior, '%')}
            state={revenue === null ? 'data-needed' : 'live'}
          />
        </section>

        {/* Sub-page chips */}
        <section style={{ marginBottom: 36 }}>
          <div style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--brass, #a8854a)',
            fontFamily: 'Menlo, monospace', marginBottom: 14,
          }}>
            REVENUE PAGES
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10,
          }}>
            {SUB_PAGES.map((sp) => (
              <Link key={sp.href} href={sp.href} style={{
                display: 'block', padding: '14px 16px',
                background: 'var(--bg-card, rgba(255,255,255,0.04))',
                border: '1px solid var(--border-soft, rgba(168,133,74,0.25))',
                borderRadius: 6, textDecoration: 'none',
              }}>
                <div style={{
                  fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic',
                  fontSize: 'var(--t-lg)', color: 'var(--ink, #f5efe3)',
                  marginBottom: 4,
                }}>
                  {sp.label}
                </div>
                <div style={{
                  fontSize: 'var(--t-xs)', color: 'var(--ink-mute, #888)',
                  fontFamily: 'Menlo, monospace',
                }}>
                  {sp.hint}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Chat with Vector — embedded below the boxes */}
        <section style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-extra, 0.18em)',
            textTransform: 'uppercase', color: 'var(--brass, #a8854a)',
            fontFamily: 'Menlo, monospace', marginBottom: 14,
          }}>
            ASK VECTOR
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-soft, rgba(168,133,74,0.18))',
            borderRadius: 8,
            padding: 12,
          }}>
            <ChatShell
              role="revenue_hod"
              displayName="Vector"
              dept="Revenue"
              emoji="📈"
              mentionNickname="vector"
              placeholder="Ask Vector about Pulse, pricing, channel mix, parity…"
              embedded
            />
          </div>
        </section>

      </div>
    </main>
  );
}

function num(x: unknown): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function delta1(cur: number | null, prior: number | null, mode: 'pp' | '%' = '%'): { value: number; unit: 'pp' | 'pct'; period: string } | undefined {
  if (cur === null || prior === null || prior === 0) return undefined;
  const diff = mode === 'pp' ? (cur - prior) : ((cur - prior) / prior) * 100;
  return { value: diff, unit: mode === 'pp' ? 'pp' : 'pct', period: 'STLY' };
}
