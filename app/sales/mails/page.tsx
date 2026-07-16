// app/sales/mails/page.tsx
// PBS 2026-07-16 (item 7) — legacy /sales/mails is deprecated.
// The Mail Inbox at /mail now covers everything this page used to do
// (unified shared-mailbox view, per-row Convert-to-Lead, dismiss, bulk
// actions, attachments). Redirect old bookmarks to the canonical surface.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function SalesMailsRedirect(): never {
  redirect('/mail');
}
