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
import { listSettingsSections } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function FactsheetBriefPage({
  searchParams,
}: {
  searchParams: { property_id?: string };
}) {
  // L22 — same fix as the section editor: this page rendered NAMKHAN's factsheet
  // whatever tenant the operator came from, because f_factsheet_markdown was called
  // with the hardcoded PROPERTY_ID. The tenant is explicit in the URL now, with a
  // picker and no default when it is absent.
  const rawPid = (searchParams?.property_id ?? '').trim();
  const propertyId = /^\d+$/.test(rawPid) ? Number(rawPid) : null;
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

  // marketing.v_settings_sections_live was dropped — the rail now comes from the
  // code registry (PBS 2026-09-09), same source as the write path.
  const sections = listSettingsSections();

  if (propertyId == null) {
    const { data: propRows } = await admin
      .from('v_tenancy_properties')
      .select('property_id, display_name')
      .order('property_id');
    const props = (propRows ?? []) as Array<{ property_id: number; display_name: string | null }>;
    return (
      <Page
        eyebrow="Settings · Property · AI agent brief"
        title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
        subPages={SETTINGS_SUBPAGES}
      >
        <Insight tone="warn" eye="pick a property">
          The factsheet is per-property and this page has no default. Choose one:
          {' '}
          {props.map((p) => (
            <a
              key={p.property_id}
              href={`/settings/property/brief?property_id=${p.property_id}`}
              style={{ marginRight: 12, fontWeight: 600, color: 'var(--brass)' }}
            >
              {p.display_name ?? p.property_id}
            </a>
          ))}
        </Insight>
        <div className="settings-layout">
          <SectionSidebar sections={sections} active="" />
        </div>
      </Page>
    );
  }

  const mdRes = await admin.schema('marketing').rpc('f_factsheet_markdown', { p_property_id: propertyId });
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
        <SectionSidebar sections={sections} active="" propertyId={propertyId} />
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
