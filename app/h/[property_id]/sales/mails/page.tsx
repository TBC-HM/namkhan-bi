// app/h/[property_id]/sales/mails/page.tsx
// PBS 2026-07-13 — Donna sales/mails delegate. Redirects Namkhan operators to
// the canonical /sales/mails; Donna operators see the stub explaining that
// the shared-mailbox inbox is Namkhan-scoped for now.
import DeptSubpageStub from '@/app/h/[property_id]/_shared/DeptSubpageStub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaSalesMails({ params }: { params: { property_id: string } }) {
  return (
    <DeptSubpageStub
      propertyId={Number(params.property_id)}
      deptLabel="Sales"
      routeLabel="Mails"
      namkhanPath="/sales/mails"
      hint="Shared-mailbox inbox is Namkhan-scoped today. Per-property mailboxes will land once Donna's Google Workspace is connected."
    />
  );
}
