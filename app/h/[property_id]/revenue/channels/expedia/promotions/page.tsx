// app/h/[property_id]/revenue/channels/expedia/promotions/page.tsx
// PBS 2026-07-08 Donna structural mirror.
import { notFound } from "next/navigation";
import DeptSubpageStub from "@/app/h/[property_id]/_shared/DeptSubpageStub";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function DonnaPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  if (!Number.isFinite(pid)) notFound();
  return (<DeptSubpageStub propertyId={pid} deptLabel="Revenue" routeLabel="Expedia · Promotions" namkhanPath="/revenue/channels/expedia/promotions" hint="OTA promotion state is per-property; Donna channel_promotions row pending." />);
}
