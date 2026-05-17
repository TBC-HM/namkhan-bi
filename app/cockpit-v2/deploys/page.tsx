// app/cockpit-v2/deploys/page.tsx
// Deploys console — V2 port. Calls existing /api/cockpit/deployments to list
// recent Vercel deploys (with audit_log fallback). Client-side polls the
// same endpoint every 60s + does live HEAD route smoke checks against a
// curated route allowlist.
//
// Author: IT-team agent · 2026-05-13 · #58.

import { DeploysView } from './DeploysView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function CockpitV2DeploysPage() {
  // Server doesn't pre-fetch — the existing /api/cockpit/deployments handles
  // its own caching (no-store) and can run heavy Vercel API calls; we let
  // the client pull on mount so the page TTFB is fast.
  return <DeploysView />;
}
