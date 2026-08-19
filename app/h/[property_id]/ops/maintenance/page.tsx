// app/h/[property_id]/ops/maintenance/page.tsx
// 307 redirect to canonical route /operations/maintenance
// Directive 2026-08-21: maintaining backward compatibility
import { redirect } from "next/navigation";

export default function MaintenanceRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/operations/maintenance`);
}
