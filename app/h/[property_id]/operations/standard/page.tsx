// app/h/[property_id]/operations/standard/page.tsx
// Operations → Quality → Standard. The first UI that reads the standards corpus.
//
// Server component. ONE RPC — public.fn_standards_payload(pid, dept) — returns the
// summary always and the selected department's requirements when ?dept= is set.
// Nothing is computed here or in the client; the components format and filter only.
//
// Why the bridge: the `standards` schema is deliberately absent from
// pgrst.db_schemas, so no client can reach standards.atoms directly. Every read
// goes through a public.fn_* SECURITY DEFINER function (invariant 3), and that
// function is granted to authenticated + service_role, never anon.
//
// Tenancy: pid comes from the route param only — never a default (L22). The atom
// corpus is tenant-neutral by design (spec §3): every property is measured against
// the same standard. Only sop_coverage and the department LABELS are per-property,
// and the bridge filters both on p_property_id. Middleware gates /h/<id> pages.
import { notFound } from 'next/navigation';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import StandardBrowser from './StandardBrowser';
import type { StandardPayload } from './types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ property_id: string }>;
  searchParams?: Promise<{ dept?: string }>;
}

export default async function OperationsStandardPage({ params, searchParams }: PageProps) {
  const { property_id } = await params;
  const sp = (await searchParams) ?? {};
  const pid = Number(property_id);
  if (!Number.isFinite(pid)) notFound();

  // ?dept= is untrusted input. It is passed as an RPC parameter (no injection
  // surface) and an unknown value simply selects no rows, but trimming to empty
  // keeps a stray "?dept=" from being sent as a literal empty department.
  const dept = (sp.dept ?? '').trim() || null;

  const deptTabs: DashboardTab[] = rewriteSubPagesForProperty(
    DEPT_CFG.operations.subPages ?? [], pid,
  ).map((s2) => ({ key: s2.href, label: s2.label, href: s2.href }));

  // getSupabaseAdmin() throws when SUPABASE_SERVICE_ROLE_KEY is absent (any
  // environment but Vercel). Degrade to the error card rather than a 500 — and
  // keep the shell, because losing the navigation is the failure this prevents.
  let data: unknown = null;
  let message: string | null = null;
  try {
    const res = await getSupabaseAdmin().rpc('fn_standards_payload', {
      p_property_id: pid,
      p_dept: dept,
    });
    data = res.data;
    message = res.error?.message ?? null;
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }

  if (message || !data) {
    return (
      <DashboardPage title="Operations · Standard" tabs={deptTabs}>
        <div style={{ gridColumn: '1 / -1' }} className="p-6">
          <p className="text-sm text-red-700">Could not load: {message ?? 'no payload returned'}</p>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage title="Operations · Standard" tabs={deptTabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <StandardBrowser pid={pid} payload={data as StandardPayload} />
      </div>
    </DashboardPage>
  );
}
