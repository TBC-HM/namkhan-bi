// app/marketing/social/google-business/page.tsx
// PBS 2026-08-21: bare Namkhan URL redirects to tenant-scoped route so the
// tenant chrome renders correctly. Real page body lives in ./_impl.tsx and
// is mounted by the /h/[property_id]/... delegate.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BareGbpRedirect() {
  redirect('/h/260955/marketing/social/google-business');
}
