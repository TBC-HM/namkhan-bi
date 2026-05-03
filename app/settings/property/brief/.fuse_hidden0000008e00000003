// app/settings/property/brief/page.tsx
// Renders the auto-generated AI agent factsheet markdown
// (marketing.f_factsheet_markdown). Read-only — to change any fact,
// edit it in the per-section editor.

import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import PanelHero from '@/components/sections/PanelHero';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import SectionSidebar from '@/components/settings/SectionSidebar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID, type SectionRow } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function FactsheetBriefPage() {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return (
      <div className="panel">
        <Insight tone="alert" eye="config error">
          {e?.message ?? 'Service-role key missing'}.
        </Insight>
      </div>
    );
  }

  const [sectionsRes, mdRes] = await Promise.all([
    admin.schema('marketing').from('v_settings_sections_live').select('*').order('display_order'),
    admin.schema('marketing').rpc('f_factsheet_markdown', { p_property_id: PROPERTY_ID }),
  ]);

  const sections: SectionRow[] = (sectionsRes.data ?? []) as SectionRow[];
  const markdown: string = typeof mdRes.data === 'string' ? mdRes.data : '';
  const placeholderHits = (markdown.match(/\[LOREM IPSUM/g) ?? []).length;
  const h = PILLAR_HEADER.settings;

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Property profile</strong> · AI agent brief</>}
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings · Property"
          title="AI agent"
          emphasis="brief"
          sub="Markdown factsheet auto-generated from every editable section. Inject this into agent system prompts."
        />

        {mdRes.error && (
          <Insight tone="alert" eye="rpc error">
            {mdRes.error.message}
          </Insight>
        )}

        {placeholderHits > 0 && (
          <Insight tone="warn" eye={`${placeholderHits} placeholders`}>
            The brief still contains <strong>{placeholderHits}</strong> LOREM
            IPSUM markers — agents will hallucinate or refuse on these. Resolve
            them in the per-section editor.
          </Insight>
        )}

        <div className="settings-layout">
          <SectionSidebar sections={sections} active="" />
          <Card
            title="Factsheet"
            sub={`${markdown.length.toLocaleString()} chars · marketing.f_factsheet_markdown`}
            source="marketing.f_factsheet_markdown(260955)"
          >
            <pre className="factsheet-md">{markdown || '— empty —'}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}
