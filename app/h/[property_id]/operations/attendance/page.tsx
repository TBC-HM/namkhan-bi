// app/h/[property_id]/operations/attendance/page.tsx
// PBS 2026-05-13 — Attendance moved INSIDE /operations/staff. Redirect.
import { redirect } from 'next/navigation';

export default function RedirectLegacyAttendanceScoped({ params }: { params: { property_id: string } }) {
  redirect(`/h/${params.property_id}/operations/staff/attendance`);
}
