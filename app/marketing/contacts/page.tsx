// app/marketing/contacts/page.tsx
// PBS 2026-07-21 pm — /marketing/contacts is now consolidated into
// /marketing/subscribers?tab=candidates. This file preserves the URL as a
// server-side redirect so any existing bookmarks / links still land correctly.
// The former ContactsClient.tsx is retained unused for reference/rollback.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ContactsRedirect(): never {
  redirect('/marketing/subscribers?tab=candidates');
}
