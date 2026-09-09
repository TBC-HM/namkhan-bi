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
  SECTION_LABELS,
  countPlaceholders,
  listSettingsSections,
  type FieldSchemaRow,
} from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { section: string };
  searchParams: { property_id?: string };
}

export default async function PropertySectionPage({ params, searchParams }: PageProps) {
  const cfg = SECTION_TO_TABLE[params.section];
  if (!cfg) notFound();

  // L22 — this editor lives in the LEGACY unprefixed tree and used to read and write
  // PROPERTY_ID (260955) unconditionally. Reachable from the left rail and the user
  // menu, that made it a Namkhan-only editor an operator could open from Donna's
  // context. The tenant is now explicit in the URL and there is NO default: with no
  // ?property_id, the page shows a picker instead of guessing. The real gate is still
  // requirePropertyAccess() in /api/settings/upsert — this is the UX half.
  const rawPid = (searchParams?.property_id ?? '').trim();
  const propertyId = /^\d+$/.test(rawPid) ? Number(rawPid) : null;

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

  // Section list comes from the code registry — marketing.v_settings_sections_live
  // was dropped and left this rail empty (PBS 2026-09-09).
  const sections = listSettingsSections();

  // A section whose table no longer exists has nothing to read or write. Say so
  // instead of rendering an empty form that 501s on save.
  if (cfg.missing) {
    return (
      <Page
        eyebrow={`Settings · Property · ${SECTION_LABELS[params.section] ?? params.section}`}
        title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
        subPages={SETTINGS_SUBPAGES}
      >
        <Insight tone="alert" eye="disconnected">
          <strong>{cfg.schema ?? 'marketing'}.{cfg.table}</strong> no longer exists in the
          database. The live data for this section is in <strong>property.*</strong> and is
          shown read-only at <strong>/h/[property_id]/settings/property</strong>. This editor
          has no working write path — it needs an owner decision (retire it, or repoint it at
          property.* and give it a tenant selector) before it can be used again.
        </Insight>
        <div className="settings-layout">
          <SectionSidebar sections={sections} active={params.section} propertyId={propertyId} />
        </div>
      </Page>
    );
  }

  const schema = cfg.schema ?? 'marketing';

  if (cfg.hasPropertyId && propertyId == null) {
    const { data: propRows } = await admin
      .from('v_tenancy_properties')
      .select('property_id, display_name, status')
      .order('property_id');
    const props = (propRows ?? []) as Array<{ property_id: number; display_name: string | null; status: string | null }>;
    return (
      <Page
        eyebrow={`Settings · Property · ${SECTION_LABELS[params.section] ?? params.section}`}
        title={<>Property <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>configuration</em>.</>}
        subPages={SETTINGS_SUBPAGES}
      >
        <Insight tone="warn" eye="pick a property">
          This section is tenant-scoped and this editor has no default property — a default
          would silently open one hotel&apos;s data from another&apos;s context. Choose which
          property to edit:
          {' '}
          {props.map((p) => (
            <a
              key={p.property_id}
              href={`/settings/property/${params.section}?property_id=${p.property_id}`}
              style={{ marginRight: 12, fontWeight: 600, color: 'var(--brass)' }}
            >
              {p.display_name ?? p.property_id}
            </a>
          ))}
        </Insight>
        <div className="settings-layout">
          <SectionSidebar sections={sections} active={params.section} propertyId={propertyId} />
        </div>
      </Page>
    );
  }
  // Parallel reads: field schema for THIS table, rows for THIS section.
  const [fieldSchemaRes, rowsRes] = await Promise.all([
    // table_schema is REQUIRED here: certifications, facilities and seasons exist in
    // BOTH marketing and property, so table_name alone would merge two column sets
    // into one form (migration settings_field_schema_add_property_content_scopes).
    admin.schema('marketing').from('v_settings_field_schema').select('*')
      .eq('table_name', cfg.table).eq('table_schema', schema).order('ordinal_position'),
    cfg.hasPropertyId
      ? (cfg.multiRow
          ? admin.schema(schema).from(cfg.table).select('*').eq('property_id', propertyId).order(cfg.pk, { ascending: true })
          : admin.schema(schema).from(cfg.table).select('*').eq('property_id', propertyId).limit(1))
      : admin.schema(schema).from(cfg.table).select('*').order(cfg.pk, { ascending: true }),
  ]);

  const fieldSchema: FieldSchemaRow[] = (fieldSchemaRes.data ?? []) as FieldSchemaRow[];
  const rows: any[] = rowsRes.data ?? [];
  const dbErr = fieldSchemaRes.error || rowsRes.error;

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
        <SectionSidebar sections={sections} active={params.section} propertyId={propertyId} />
        <Card
          title={currentSection?.display_name ?? 'Section'}
          sub={`${cfg.table} · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${fields.length} fields${currentSection?.description ? ` · ${currentSection.description}` : ''}`}
          source={`${schema}.${cfg.table}`}
        >
          <SectionEditor
            propertyId={propertyId}
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
