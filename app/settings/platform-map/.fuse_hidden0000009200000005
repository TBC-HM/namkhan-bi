// app/settings/platform-map/page.tsx
// Owner-maintained platform map. Source: content/settings/platform-map.md
// Edit the markdown + push — change [STATUS:xxx] tags to update colours.
// Architecture diagram view (v5) lives at /platform-map-v5.html (public asset).

import fs from 'node:fs';
import path from 'node:path';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import { PILLAR_HEADER, RAIL_SUBNAV } from '@/components/nav/subnavConfig';
import PlatformMapRenderer from '@/components/settings/PlatformMapRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function loadMarkdown(): string {
  const p = path.join(process.cwd(), 'content', 'settings', 'platform-map.md');
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '# Platform Map\n\n> Source markdown not found at `content/settings/platform-map.md`.\n';
  }
}

export default function PlatformMapPage() {
  const h = PILLAR_HEADER.settings;
  const md = loadMarkdown();

  // Pull last-refreshed line if present
  const refreshedMatch = md.match(/Last refreshed:\s*([^·*]+)/i);
  const refreshed = refreshedMatch ? refreshedMatch[1].trim() : '—';

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title="Platform"
        titleEmphasis="map"
        meta={
          <>
            <strong>Owner reference</strong> · last refreshed {refreshed}
          </>
        }
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings"
          title="Platform"
          emphasis="map"
          sub="Source systems · ingestion · DB · agents · frontend · cross-cutting. Edit content/settings/platform-map.md and push to update."
        />

        <Card
          title="Architecture diagram"
          sub="Self-contained visual (v5)"
          source="new"
        >
          <div style={{ padding: '14px 18px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a
              href="/platform-map-v5.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '8px 14px',
                background: 'var(--moss)',
                color: 'var(--paper-warm)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                textDecoration: 'none',
                borderRadius: 2,
              }}
            >
              Open architecture diagram →
            </a>
            <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              Layered visual map (sources → ingest → DB → agents → frontend). Opens in a new tab.
            </span>
          </div>
        </Card>

        <Card
          title="Platform map"
          sub="Markdown-driven · sorted Gap → Next → Partial → Ready → Live → Done → Out"
          source="new"
        >
          <div style={{ padding: '18px 22px' }}>
            <PlatformMapRenderer markdown={md} />
          </div>
        </Card>
      </div>
    </>
  );
}
