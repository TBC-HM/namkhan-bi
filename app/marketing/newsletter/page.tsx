// app/marketing/newsletter/page.tsx
// PBS 2026-07-21 · Server-side alias — /marketing/newsletter redirects to /guest/newsletters.
// The real newsletter tooling still lives at /guest/newsletters; this route is a UX bridge only.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function NewsletterAlias() {
  redirect('/guest/newsletters');
}
