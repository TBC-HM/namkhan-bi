// app/h/[property_id]/finance/docs/page.tsx
// PBS 2026-07-08 Donna structural mirror.
import { notFound } from "next/navigation";
import DeptSubpageStub from "@/app/h/[property_id]/_shared/DeptSubpageStub";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function DonnaPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return (<DeptSubpageStub propertyId={pid} deptLabel="Finance" routeLabel="Documents" namkhanPath="/finance/docs" hint="Documents registry — Donna filter (property_id) pending." />);
}
