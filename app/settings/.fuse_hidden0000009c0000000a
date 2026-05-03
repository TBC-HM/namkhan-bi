// app/settings/page.tsx
// Settings utility — property config + API keys + users.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import { PILLAR_HEADER, RAIL_SUBNAV } from '@/components/nav/subnavConfig';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const h = PILLAR_HEADER.settings;
  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Configuration</strong></>}
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings"
          title="Property"
          emphasis="configuration"
          sub="Preferences · users · API keys · property profile"
          kpis={
            <>
              <KpiCard label="Property" value="Namkhan" kind="text" hint="Luang Prabang, LA" />
              <KpiCard label="Active Rooms" value={19} hint="Tent 7 retired" />
              <KpiCard label="FX" value="21,800" kind="text" hint="LAK / USD" />
              <KpiCard label="Currency" value="USD" kind="text" hint="reporting" />
            </>
          }
        />

        <div className="card-grid-2">
          <Card title="Property profile" sub="Hard-coded · move to settings table Phase 2">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Static config</h3>
              <p>
                Cloudbeds property_id <strong>260955</strong>, FX rate <strong>21,800 LAK/USD</strong>,
                inventory <strong>19 active rooms</strong>. Move to Supabase{' '}
                <strong>property_settings</strong> table for runtime editing.
              </p>
            </div>
          </Card>

          <Card title="Users & access" sub="Coming Phase 2" source="grey">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Coming soon</h3>
              <p>
                User management — owner, GM, RM, finance roles. Currently password-gated only.
              </p>
            </div>
          </Card>
        </div>

        <div className="card-grid-2" style={{ marginTop: 22 }}>
          <Card title="API integrations" sub="Cloudbeds + Supabase live">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Status</h3>
              <p>
                Cloudbeds API: connected. Supabase: connected.
                Email parser (reviews): Phase 2.
                Vertex AI (action engine): Phase 4.
              </p>
            </div>
          </Card>

          <Card title="DQ engine" sub="Active · 5 known issues">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Active</h3>
              <p>
                See <strong>Operations · Snapshot</strong> for inline action cards built from the
                DQ engine. Phase 4 will add automated fix-suggester via Vertex.
              </p>
            </div>
          </Card>
        </div>

        <div className="card-grid-2" style={{ marginTop: 22 }}>
          <Card title="Agent" emphasis="guardrails" sub="Cross-pillar AI agent governance — global config" source="new">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Global agent governance</h3>
              <p>
                Operating mode · detection thresholds · approval matrix · data quality ·
                audit trail · master kill switch. Domain-specific rules (Revenue rate caps,
                Marketing ad spend) live on each pillar's <strong>Agents</strong> tab.
              </p>
              <p style={{ marginTop: 10 }}>
                <a href="/settings/agents" style={{ color: 'var(--moss)', fontWeight: 600 }}>Open Agent guardrails →</a>
              </p>
            </div>
          </Card>
          <Card title="Platform" emphasis="map" sub="Owner-maintained reference · sources · DB · agents · frontend" source="new">
            <div className="stub" style={{ padding: 32 }}>
              <h3>Full-stack inventory</h3>
              <p>
                Layer-by-layer map of the entire platform — every source system, ingestion
                Edge Function, schema, agent, frontend page and cross-cutting concern.
                Each row carries a <strong>[STATUS]</strong> tag (Gap / Next / Partial / Live)
                that drives the colour. Edit{' '}
                <code>content/settings/platform-map.md</code> and push to update.
              </p>
              <p style={{ marginTop: 10 }}>
                <a href="/settings/platform-map" style={{ color: 'var(--moss)', fontWeight: 600 }}>Open Platform map →</a>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
