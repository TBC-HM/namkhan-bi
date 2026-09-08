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
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
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

  // The mkt-dash-refresh-15min cron owns refreshing the cache. A page load must
  // NEVER trigger fn_mkt_dash_payload's fallback path: that recompute takes ~17 s,
  // blows the PostgREST statement timeout and kills the render. Observed on Donna
  // (1000001), whose cache the cron does not keep warm — at 1 h 45 min old, every
  // load fell through and failed. So accept a day-old cached payload and let the
  // header show its true age; ?refresh=1 still forces a deliberate recompute.
  const maxAgeMinutes = sp.refresh === '1' ? 0 : 1440;

  // getSupabaseAdmin() throws when SUPABASE_SERVICE_ROLE_KEY is absent (any
  // environment but Vercel). Degrade to the error card rather than a 500.
  let data: unknown;
  let message: string | null = null;
  try {
    const res = await getSupabaseAdmin().rpc('fn_mkt_dash_payload', {
      p_property_id: pid,
      p_max_age_minutes: maxAgeMinutes,
    });
    data = res.data;
    message = res.error?.message ?? null;
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }

  if (message || !data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Marketing dashboard</h1>
        <p className="mt-2 text-sm text-red-700">Could not load dashboard: {message ?? 'no payload returned'}</p>
      </div>
    );
  }

  return <MarketingDashboard pid={pid} payload={data as Payload} initialTab={sp.tab} />;
}
