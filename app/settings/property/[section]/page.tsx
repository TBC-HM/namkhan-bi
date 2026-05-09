// app/settings/property/[section]/page.tsx
// 15-section editable Property settings hub.
// 2026-05-09 (cockpit_bugs id=5): migrated from legacy
// <Banner>+<SubNav>+<PanelHero> chrome onto the canonical <Page> shell so
// the sub-pages strip + always-on header pills + SLH footer match the rest
// of the dashboard. Functionality (form submits via /api/settings/upsert,
// section sidebar, placeholder counters) unchanged.
//
// Reads come from marketing schema via getSupabaseAdmin() — required because
// every settings table has RLS that blocks anon reads. Writes go through
// /api/settings/upsert. See lib/settings.ts for the section→table mapping.

import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import SectionSidebar from '@/components/settings/SectionSidebar';
import SectionEditor from '@/components/settings/SectionEditor';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { SETTINGS_SUBPAGES } from '../../_subpages';
import {
  SECTION_TO_TABLE,
  SECTION_FIELD_WHITELIST,
  PROPERTY_ID,
  countPlaceholders,
  type SectionRow,
  type FieldSchemaRow,
} from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { section: string };
}

export default async function PropertySectionPage({ params }: PageProps) {
  const cfg = SECTION_TO_TABLE[params.section];
  if (!cfg) notFound();

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return (
      <Page
        eyebrow="Settings · Property"
        title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
        subPages={SETTINGS_SUBPAGES}
      >
        <Insight tone="alert" eye="config error">
          {e?.message ?? 'Service-role key missing'}. Add SUPABASE_SERVICE_ROLE_KEY in
          Vercel → namkhan-bi → Settings → Environment Variables, then redeploy.
        </Insight>
      </Page>
    );
  }

  // Parallel reads: sections, field schema for THIS table, rows for THIS section.
  const [sectionsRes, fieldSchemaRes, rowsRes] = await Promise.all([
    admin.schema('marketing').from('v_settings_sections_live').select('*').order('display_order'),
    admin.schema('marketing').from('v_settings_field_schema').select('*').eq('table_name', cfg.table).order('ordinal_position'),
    cfg.multiRow
      ? admin.schema('marketing').from(cfg.table).select('*').order(cfg.pk, { ascending: true })
      : admin.schema('marketing').from(cfg.table).select('*').eq('property_id', PROPERTY_ID).limit(1),
  ]);

  const sections: SectionRow[] = (sectionsRes.data ?? []) as SectionRow[];
  const fieldSchema: FieldSchemaRow[] = (fieldSchemaRes.data ?? []) as FieldSchemaRow[];
  const rows: any[] = rowsRes.data ?? [];
  const dbErr = sectionsRes.error || fieldSchemaRes.error || rowsRes.error;

  // Apply field whitelist for sections that share property_profile.
  const whitelist = SECTION_FIELD_WHITELIST[params.section];
  const fields = fieldSchema
    .filter((f) => f.input_type !== 'audit' && f.input_type !== 'hidden')
    .filter((f) => (whitelist ? whitelist.includes(f.column_name) : true));

  const currentSection = sections.find((s) => s.section_code === params.section);
  const placeholderCount = rows.reduce<number>((acc, r) => acc + countPlaceholders(r), 0);

  return (
    <Page
      eyebrow={`Settings · Property · ${currentSection?.display_name ?? params.section}`}
      title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
      subPages={SETTINGS_SUBPAGES}
    >
      {dbErr && (
        <Insight tone="alert" eye="db error">
          {dbErr.message}
        </Insight>
      )}

      {params.section === 'retreat_pricing' && (
        <Insight tone="warn" eye="data check">
          High Season and Green Season pricing currently identical across rows.
          Confirm with owner before sending proposals to partners.
        </Insight>
      )}

      {placeholderCount > 0 && (
        <Insight tone="warn" eye={`${placeholderCount} placeholders`}>
          This section still contains <strong>{placeholderCount}</strong> LOREM
          IPSUM markers. Replace them with real values before publishing to AI
          agents or partners.
        </Insight>
      )}

      <div className="settings-layout">
        <SectionSidebar sections={sections} active={params.section} />
        <Card
          title={currentSection?.display_name ?? 'Section'}
          sub={`${cfg.table} · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${fields.length} fields${currentSection?.description ? ` · ${currentSection.description}` : ''}`}
          source={`marketing.${cfg.table}`}
        >
          <SectionEditor
            sectionCode={params.section}
            table={cfg.table}
            pk={cfg.pk}
            multiRow={cfg.multiRow}
            hasPropertyId={cfg.hasPropertyId}
            fields={fields}
            rows={rows}
          />
        </Card>
      </div>
    </Page>
  );
}
