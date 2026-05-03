// app/settings/property/[section]/page.tsx
// 15-section editable Property settings hub.
// Reads come from marketing schema via getSupabaseAdmin() — required because
// every settings table has RLS that blocks anon reads. Writes go through
// /api/settings/upsert. See lib/settings.ts for the section→table mapping.

import { notFound } from 'next/navigation';
import Banner from '@/components/nav/Banner';
import SubNav from '@/components/nav/SubNav';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import Insight from '@/components/sections/Insight';
import { RAIL_SUBNAV, PILLAR_HEADER } from '@/components/nav/subnavConfig';
import SectionSidebar from '@/components/settings/SectionSidebar';
import SectionEditor from '@/components/settings/SectionEditor';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
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
      <>
        <Banner
          eyebrow={PILLAR_HEADER.settings.eyebrow}
          title={PILLAR_HEADER.settings.title}
          titleEmphasis={PILLAR_HEADER.settings.emphasis}
          meta={<><strong>Property profile</strong></>}
        />
        <SubNav items={RAIL_SUBNAV.settings} />
        <div className="panel">
          <Insight tone="alert" eye="config error">
            {e?.message ?? 'Service-role key missing'}. Add SUPABASE_SERVICE_ROLE_KEY in
            Vercel → namkhan-bi → Settings → Environment Variables, then redeploy.
          </Insight>
        </div>
      </>
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
  const h = PILLAR_HEADER.settings;

  return (
    <>
      <Banner
        eyebrow={h.eyebrow}
        title={h.title}
        titleEmphasis={h.emphasis}
        meta={<><strong>Property profile</strong> · {currentSection?.display_name ?? params.section}</>}
      />
      <SubNav items={RAIL_SUBNAV.settings} />
      <div className="panel">
        <PanelHero
          eyebrow="Settings · Property"
          title={currentSection?.display_name ?? params.section}
          sub={currentSection?.description ?? 'Owner-editable property facts'}
        />

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
            sub={`${cfg.table} · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${fields.length} fields`}
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
      </div>
    </>
  );
}
