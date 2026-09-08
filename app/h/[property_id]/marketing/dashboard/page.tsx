// app/h/[property_id]/marketing/dashboard/page.tsx
// Brief marketing-dashboard-v1 · replaces /marketing/overview.
// Server component. ONE RPC — public.fn_mkt_dash_payload(pid, max_age_min) — returns the
// whole payload from marketing.dash_payload_cache. Nothing is computed here or in the client.
//
// Deviation from the brief §7: the brief's `createClient` from '@/lib/supabase/server' is a
// shim whose docstring says "anon" but which re-exports the SERVICE-ROLE singleton. This repo's
// real server-read pattern (app/marketing/audience/page.tsx) is getSupabaseAdmin(); the RPC's
// own guard exempts role='service_role', so this is the client that passes it.
// Tenancy: pid comes from the route param only — never a default (L22).
import { notFound } from 'next/navigation';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionScope, canSeeProperty } from '@/lib/session-scope';
import MarketingDashboard from './MarketingDashboard';
import type { Payload } from './types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ property_id: string }>;
  searchParams?: Promise<{ tab?: string; refresh?: string }>;
}

export default async function MarketingDashboardPage({ params, searchParams }: PageProps) {
  const { property_id } = await params;
  const sp = (await searchParams) ?? {};
  const pid = Number(property_id);
  if (!Number.isFinite(pid)) notFound();

  const scope = await getSessionScope();
  if (!canSeeProperty(pid, scope)) notFound();

  // The department strip must render on THIS route too. Without the DashboardPage
  // shell the page drew its own markup only, so clicking Marketing → Dashboard made
  // the sub-menu (HoD · Dashboard · Audience · Content · Socials · Web · Reputation
  // · Behaviour) disappear. Tabs come from DEPT_CFG and are rewritten to the active
  // tenant, the same way the /h/[property_id]/[...rest] catch-all does it.
  // The page's own five tabs live inside the component and are a level below these.
  const deptTabs: DashboardTab[] = rewriteSubPagesForProperty(
    DEPT_CFG.marketing.subPages ?? [], pid,
  ).map((s2) => ({ key: s2.href, label: s2.label, href: s2.href }));

  // The mkt-dash-refresh-15min cron owns refreshing the cache. A page load must
  // NEVER trigger fn_mkt_dash_payload's fallback path: that recompute takes ~17 s,
  // blows the PostgREST statement timeout and kills the render. Observed on Donna
  // (1000001), whose cache the cron does not keep warm — at 1 h 45 min old, every
  // load fell through and failed. So accept a day-old cached payload and let the
  // header show its true age; ?refresh=1 still forces a deliberate recompute.
  const maxAgeMinutes = sp.refresh === '1' ? 0 : 1440;

  // getSupabaseAdmin() throws when SUPABASE_SERVICE_ROLE_KEY is absent (any
  // environment but Vercel). Degrade to the error card rather than a 500.
  async function load(maxAge: number) {
    try {
      const res = await getSupabaseAdmin().rpc('fn_mkt_dash_payload', {
        p_property_id: pid,
        p_max_age_minutes: maxAge,
      });
      return { data: res.data as unknown, message: res.error?.message ?? null };
    } catch (e) {
      return { data: null as unknown, message: e instanceof Error ? e.message : String(e) };
    }
  }

  let { data, message } = await load(maxAgeMinutes);

  // ?refresh=1 asks fn_mkt_dash_payload to recompute inline, which currently
  // exceeds the PostgREST statement timeout (~17 s of work). Rather than leave a
  // dead page, fall back to the cached payload and say the refresh failed. The
  // real fix is a statement_timeout raise on the function — SQL, so out of scope
  // for this brief.
  let refreshFailed: string | null = null;
  if (message && maxAgeMinutes === 0) {
    refreshFailed = message;
    ({ data, message } = await load(1440));
  }

  // The error state keeps the shell too — losing the navigation is exactly the
  // failure this wrapper exists to prevent.
  if (message || !data) {
    return (
      <DashboardPage title="Marketing · Dashboard" tabs={deptTabs}>
        <div style={{ gridColumn: '1 / -1' }} className="p-6">
          <p className="text-sm text-red-700">Could not load dashboard: {message ?? 'no payload returned'}</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title="Marketing · Dashboard" tabs={deptTabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        {refreshFailed && (
          <p className="mx-auto max-w-[1320px] border-l-[3px] border-amber-600 bg-amber-50 px-3 py-2 text-sm">
            Refresh did not finish ({refreshFailed}). Showing the last cached payload — its age is in the header below.
          </p>
        )}
        <MarketingDashboard pid={pid} payload={data as Payload} initialTab={sp.tab} />
      </div>
    </DashboardPage>
  );
}
