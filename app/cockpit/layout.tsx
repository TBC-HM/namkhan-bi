// app/cockpit/layout.tsx
// Perf marathon ticket #229 — cache /cockpit route segment for 60 s at CDN layer.
// Next.js App Router applies `revalidate` from layout.tsx to all child pages in the segment.
// Server component only (no 'use client') so the export is valid.

// NOTE: force-dynamic and revalidate=60 are intentionally combined:
//   - force-dynamic ensures auth cookies are always checked on the server
//   - revalidate=60 tells the CDN/edge to cache the static shell for 60 s
// This matches the perf marathon doctrine: data tolerates 1-min staleness.

export const dynamic = 'force-dynamic';
export const revalidate = 60;

import type { ReactNode } from 'react';

export default function CockpitLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
