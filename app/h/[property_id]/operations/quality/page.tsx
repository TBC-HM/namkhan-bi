// app/h/[property_id]/operations/quality/page.tsx
// Brief quality-dashboard-v1 · Operations → Quality.
// Server component. ONE RPC — public.fn_qa_dash_payload(pid, max_age_min) — returns
// the whole payload from ops.qa_dash_payload_cache. Nothing is computed here or in
// the client; the component formats only.
//
// Deviation from the brief §7: it specifies `createClient` from '@/lib/supabase/server',
// a shim whose docstring says "anon" but which re-exports the SERVICE-ROLE singleton.
// This repo's real server-read pattern (app/marketing/audience/page.tsx) is
// getSupabaseAdmin(); fn_qa_dash_payload's guard exempts role='service_role', so this
// is the client that passes it. Tenancy: pid comes from the route param only (L22).
//
// max_age: the qa-dash-refresh-15min cron owns refreshing. A page load must never
// trigger the inline recompute — see the marketing dashboard, where that path blew
// the PostgREST statement timeout and killed the render. Accept a day-old cached
// payload; the header prints the true generated_at and age. ?refresh=1 still forces 0
// and falls back to the cache if the recompute times out.
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import QualityDashboard from './QualityDashboard';
import type { QaPayload } from './types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ property_id: string }>;
  searchParams?: Promise<{ tab?: string; refresh?: string }>;
}

export default async function OperationsQualityPage({ params, searchParams }: PageProps) {
  const { property_id } = await params;
  const sp = (await searchParams) ?? {};
  const pid = Number(property_id);
  if (!Number.isFinite(pid)) notFound();

  const maxAgeMinutes = sp.refresh === '1' ? 0 : 1440;

  // getSupabaseAdmin() throws when SUPABASE_SERVICE_ROLE_KEY is absent (any
  // environment but Vercel). Degrade to the error card rather than a 500.
  async function load(maxAge: number) {
    try {
      const res = await getSupabaseAdmin().rpc('fn_qa_dash_payload', {
        p_property_id: pid,
        p_max_age_minutes: maxAge,
      });
      return { data: res.data as unknown, message: res.error?.message ?? null };
    } catch (e) {
      return { data: null as unknown, message: e instanceof Error ? e.message : String(e) };
    }
  }

  let { data, message } = await load(maxAgeMinutes);

  let refreshFailed: string | null = null;
  if (message && maxAgeMinutes === 0) {
    refreshFailed = message;
    ({ data, message } = await load(1440));
  }

  if (message || !data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Quality dashboard</h1>
        <p className="mt-2 text-sm text-red-700">Could not load: {message ?? 'no payload returned'}</p>
      </div>
    );
  }

  return (
    <>
      {refreshFailed && (
        <p className="mx-auto max-w-[1320px] border-l-[3px] border-amber-600 bg-amber-50 px-3 py-2 text-sm">
          Refresh did not finish ({refreshFailed}). Showing the last cached payload — its age is in the header below.
        </p>
      )}
      <QualityDashboard pid={pid} payload={data as QaPayload} initialTab={sp.tab} />
    </>
  );
}
