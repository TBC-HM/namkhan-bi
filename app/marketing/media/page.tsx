// app/marketing/media/page.tsx
// 2026-05-09 (cockpit_bugs id=4): legacy "media" page used to render the
// marketing.media_links table only — Drive folder URLs, no preview, no
// drill-down. The canonical media browser is /marketing/library (180 real
// assets in marketing.v_media_ready, full drawer, AI search, drop-zone).
// Redirect so the old URL still works.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function MediaPageRedirect() {
  redirect('/marketing/library');
}
