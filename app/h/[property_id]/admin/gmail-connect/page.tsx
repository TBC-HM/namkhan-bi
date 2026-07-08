// app/h/[property_id]/admin/gmail-connect/page.tsx
// PBS 2026-07-08 — Donna admin/gmail-connect structural mirror.
import { notFound } from "next/navigation";
import DeptSubpageStub from "@/app/h/[property_id]/_shared/DeptSubpageStub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DonnaPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return (
    <DeptSubpageStub
      propertyId={pid}
      deptLabel="Admin"
      routeLabel="Gmail connect"
      namkhanPath="/admin/gmail-connect"
      hint="Google OAuth connect flow for shared inbox. Will scope per Donna workspace once auth wiring lands."
    />
  );
}
