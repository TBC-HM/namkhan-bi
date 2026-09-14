// app/h/[property_id]/operations/quality/[dept]/page.tsx
// Task 5 of the department-qa-discharge-modes plan · Operations → Quality → <dept>.
// Server component. ONE RPC — public.fn_dept_qa_payload(pid, dept) — carries every
// number this page shows for the department itself; a second, property-wide read of
// public.fn_audit_documents(pid) feeds the downloadable-reports block (PBS request,
// additional scope beyond the Task 5 brief — see task-5-brief.md). Nothing is
// computed here or in the client component; both format only.
//
// Pattern copied from the sibling app/h/[property_id]/operations/quality/page.tsx:
// getSupabaseAdmin() (service-role — NOT the anon the docstring in
// lib/supabase/server.ts claims; see CLAUDE.md "Data access gotchas"), dynamic =
// 'force-dynamic', notFound() on a non-numeric property_id, and an error card that
// KEEPS the navigation shell rather than throwing — losing the Operations strip is
// exactly the failure this wrapper exists to prevent.
import { notFound } from 'next/navigation';
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import DepartmentQa from './DepartmentQa';
import type { AuditDocument, DeptQaPayload } from './types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: Promise<{ property_id: string; dept: string }>;
}

export default async function DepartmentQaPage({ params }: PageProps) {
  const { property_id, dept } = await params;
  const pid = Number(property_id);
  if (!Number.isFinite(pid)) notFound();

  // The Operations department strip must render on this route too, same as every
  // other page under operations/* — see the matching note on the sibling dashboard.
  const deptTabs: DashboardTab[] = rewriteSubPagesForProperty(
    DEPT_CFG.operations.subPages ?? [], pid,
  ).map((s2) => ({ key: s2.href, label: s2.label, href: s2.href }));

  // getSupabaseAdmin() throws when SUPABASE_SERVICE_ROLE_KEY is absent (any
  // environment but Vercel). Degrade to the error card rather than a 500.
  async function loadPayload() {
    try {
      const res = await getSupabaseAdmin().rpc('fn_dept_qa_payload', {
        p_property_id: pid,
        p_dept: dept,
      });
      return { data: res.data as unknown, message: res.error?.message ?? null };
    } catch (e) {
      return { data: null as unknown, message: e instanceof Error ? e.message : String(e) };
    }
  }

  const { data, message } = await loadPayload();

  // The error state keeps the shell too — losing the navigation is exactly the
  // failure this wrapper exists to prevent.
  if (message || !data) {
    return (
      <DashboardPage title="Operations · Quality" tabs={deptTabs}>
        <div style={{ gridColumn: '1 / -1' }} className="p-6">
          <p className="text-sm text-red-700">Could not load: {message ?? 'no payload returned'}</p>
        </div>
      </DashboardPage>
    );
  }

  const payload = data as DeptQaPayload;

  // Audit reports are PROPERTY-WIDE, not per-department (PBS request, additional
  // scope — task-5-brief.md). Fetched separately from the department payload on
  // purpose: it is a different RPC with a different failure mode, and a document
  // listing that fails to load must never take the department's own QA numbers down
  // with it — degrade to an empty list, same pattern as the reputation tile on the
  // sibling dashboard.
  let auditDocs: AuditDocument[] = [];
  try {
    const docs = await getSupabaseAdmin().rpc('fn_audit_documents', { p_property_id: pid });
    auditDocs = (docs.data as AuditDocument[] | null) ?? [];
  } catch {
    auditDocs = [];
  }

  return (
    <DashboardPage title={`Operations · Quality · ${payload.dept_name ?? dept}`} tabs={deptTabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <DepartmentQa pid={pid} payload={payload} auditDocs={auditDocs} />
      </div>
    </DashboardPage>
  );
}
