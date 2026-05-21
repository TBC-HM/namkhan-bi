// app/revenue/channel/page.tsx
// Singular slug retired on 2026-05-21 — merged into the plural /revenue/channels
// surface. This file stays as a 308 redirect so any saved bookmarks /
// scheduled-report URLs keep working.

import { redirect } from 'next/navigation';

export default function ChannelRedirect() {
  redirect('/revenue/channels');
}
