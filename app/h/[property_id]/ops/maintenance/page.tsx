// app/h/[property_id]/ops/maintenance/page.tsx
// Redirect to canonical route
// Directive 2026-08-21: /operations/maintenance is canonical; /ops/maintenance redirects (307 temporary)
import { redirect } from "next/navigation";

export default function MaintenanceRedirect({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/operations/maintenance`);
}