// app/settings/property/brief/page.tsx
// Renders the auto-generated AI agent factsheet markdown
// (marketing.f_factsheet_markdown). Read-only — to change any fact,
// edit it in the per-section editor.
//
// 2026-05-09 (cockpit_bugs id=5): migrated from legacy <Banner>+<SubNav>+
// <PanelHero> chrome onto the canonical <Page> shell.

import Page from '@/components/page/Page';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import SectionSidebar from '@/components/settings/SectionSidebar';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SETTINGS_SUBPAGES } from '../../_subpages';
import { PROPERTY_ID, type SectionRow } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function FactsheetBriefPage() {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return (
      <Page
        eyebrow="Settings · Property · AI agent brief"
        title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
        subPages={SETTINGS_SUBPAGES}
      >
        <Insight tone="alert" eye="config error">
          {e?.message ?? 'Service-role key missing'}.
        </Insight>
      </Page>
    );
  }

  const [sectionsRes, mdRes] = await Promise.all([
    admin.schema('marketing').from('v_settings_sections_live').select('*').order('display_order'),
    admin.schema('marketing').rpc('f_factsheet_markdown', { p_property_id: PROPERTY_ID }),
  ]);

  const sections: SectionRow[] = (sectionsRes.data ?? []) as SectionRow[];
  const markdown: string = typeof mdRes.data === 'string' ? mdRes.data : '';
  const placeholderHits = (markdown.match(/\[LOREM IPSUM/g) ?? []).length;

  return (
    <Page
      eyebrow="Settings · Property · AI agent brief"
      title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
      subPages={SETTINGS_SUBPAGES}
    >
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
          sub={`${markdown.length.toLocaleString()} chars · marketing.f_factsheet_markdown · auto-generated from every editable section. Inject this into agent system prompts.`}
          source="marketing.f_factsheet_markdown(260955)"
        >
          <pre className="factsheet-md">{markdown || '— empty —'}</pre>
        </Card>
      </div>
    </Page>
  );
}
