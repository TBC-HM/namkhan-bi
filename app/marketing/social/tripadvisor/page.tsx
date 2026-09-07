// app/marketing/social/tripadvisor/page.tsx
// Bare-URL redirect — real page body lives in _impl.tsx, mounted by the
// /h/[property_id]/marketing/social/tripadvisor tenant delegate.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function BareTripAdvisorRedirect() {
  redirect('/h/260955/marketing/social/tripadvisor');
}
