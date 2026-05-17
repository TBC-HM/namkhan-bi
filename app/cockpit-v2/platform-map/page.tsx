// app/cockpit-v2/platform-map/page.tsx
// Renders the owner-maintained platform map (content/settings/platform-map.md)
// inside the cockpit-v2 shell. Server component — reads the file from disk
// and hands it to <PlatformMapRenderer/> which extracts [STATUS:xxx] tags
// and tallies counts inline.
//
// Author: IT-team agent · 2026-05-13 · #79.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import PlatformMapRenderer from '@/components/settings/PlatformMapRenderer';
import { TOKENS, SERIF, MONO } from '../_components/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function readPlatformMap(): Promise<string | null> {
  try {
    const p = path.join(process.cwd(), 'content', 'settings', 'platform-map.md');
    return await fs.readFile(p, 'utf8');
  } catch (e) {
    console.error('[cockpit-v2 platform-map] read failed', e);
    return null;
  }
}

export default async function CockpitV2PlatformMapPage() {
  const md = await readPlatformMap();

  if (!md) {
    return (
      <div
        style={{
          padding: 24,
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.bgRaised,
          borderRadius: 2,
          color: TOKENS.text2,
          fontFamily: 'var(--sans)',
        }}
      >
        <h2 style={{ fontFamily: SERIF, fontSize: 22, color: TOKENS.ink, margin: 0 }}>
          Platform map
        </h2>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          <code style={{ fontFamily: MONO }}>content/settings/platform-map.md</code> could not be
          read from disk. Check the deploy bundle.
        </p>
      </div>
    );
  }

  return (
    <div style={{ color: TOKENS.ink }}>
      <PlatformMapRenderer markdown={md} />
    </div>
  );
}
