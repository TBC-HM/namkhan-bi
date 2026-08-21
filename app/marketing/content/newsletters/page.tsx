// app/marketing/content/newsletters/page.tsx
// PBS 2026-08-21 · Newsletter surface under Content sub-strip.
// Redirects the bare-Namkhan URL to the property-scoped tenant page (URL LAW).
// The underlying newsletter body still lives at /guest/newsletters/*
// (Newsletter module = 21-file MUST-EXIST list — do not move).

import { redirect } from 'next/navigation';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';

export const dynamic = 'force-dynamic';

export default function MarketingContentNewslettersRedirect() {
  redirect(`/h/${NAMKHAN_PROPERTY_ID}/marketing/content/newsletters`);
}
