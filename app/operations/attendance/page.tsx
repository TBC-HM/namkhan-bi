// app/operations/attendance/page.tsx
// PBS 2026-05-13 — Attendance moved INSIDE /operations/staff as a tab.
// Old URL redirects to the new tab so existing bookmarks / external links
// don't 404.
import { redirect } from 'next/navigation';

export default function RedirectLegacyAttendance() {
  redirect('/operations/staff/attendance');
}
