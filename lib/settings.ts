// lib/settings.ts
// Types + section→table mapping for the Property Settings editor.
// Reads happen server-side via getSupabaseAdmin() in the page; writes go
// through POST /api/settings/upsert and /api/settings/delete (service-role).
//
// IMPORTANT: marketing schema RLS only allows authenticated owner/gm/
// marketing_lead. The app currently uses mock auth (no JWT), so service-role
// is the only path for both reads and writes on these tables.

// L22: this is the LEGACY single-tenant editor's default and is used only by the
// unprefixed /settings/* tree. It is NOT a fallback for the property-scoped API —
// /api/settings/upsert now resolves the tenant from the request and verifies it.
export const PROPERTY_ID = 260955;

export interface SectionRow {
  section_code: string;
  display_name: string;
  description: string;
  source_table: string;
  display_order: number;
  row_count: number;
  last_edited: string | null;
}

export interface FieldSchemaRow {
  table_name: string;
  column_name: string;
  ordinal_position: number;
  data_type: string;       // 'text' | 'integer' | 'jsonb' | 'ARRAY' | …
  udt_name: string;        // 'text' | 'int4' | 'jsonb' | '_text' | 'contact_kind' | …
  nullable: boolean;
  column_default: string | null;
  input_type: string;      // 'text'|'textarea'|'number'|'array'|'json'|'toggle'|'enum'|'color'|'url'|'date'|'time'|'datetime'|'audit'|'hidden'
  label: string;
}

// section_code → physical table info.
//
// PBS 2026-09-09 audit — three corrections, all verified against the live DB:
//  · `schema` is explicit. `data_integrations` lives in `property`, everything
//    else in `marketing`; the route used to hardcode `.schema('marketing')`.
//  · `missing: true` marks a target absent from the live DB. RESOLVED 2026-09-09
//    (PBS-approved): the 7 sections that pointed at the dropped marketing tables
//    (property_profile / property_contact / booking_policies / property_banking /
//    property_licenses) now point at their real homes in property.* and content.*,
//    which is where the /h/[pid] pages already read. The flag stays in the type so
//    a future drop fails loudly instead of raising a bare Postgres 42P01.
//  · `hasPropertyId` matched reality for only 14 of 17 rows. social_accounts and
//    room_type_content DO carry property_id (were false → tenant scope was never
//    applied); retreat_pricing does NOT (was true).
export const SECTION_TO_TABLE: Record<
  string,
  {
    table: string;
    pk: string;
    multiRow: boolean;
    hasPropertyId: boolean;
    schema?: 'marketing' | 'property' | 'content';
    /** Target table is absent from the live DB — reject the write loudly. */
    missing?: boolean;
  }
> = {
  property_identity: { table: 'identity',  pk: 'property_id', multiRow: false, hasPropertyId: true, schema: 'property' },
  location_climate:  { table: 'location',  pk: 'property_id', multiRow: false, hasPropertyId: true, schema: 'property' },
  brand:             { table: 'brand',     pk: 'property_id', multiRow: false, hasPropertyId: true, schema: 'property' },
  contacts:          { table: 'contacts',  pk: 'contact_id',  multiRow: true,  hasPropertyId: true, schema: 'property' },
  social:            { table: 'social_accounts',  pk: 'id',          multiRow: true,  hasPropertyId: true },
  rooms:             { table: 'room_type_content',pk: 'room_type_id',multiRow: true,  hasPropertyId: true },
  booking_policies:  { table: 'policies',  pk: 'property_id', multiRow: false, hasPropertyId: true, schema: 'property' },
  certifications:    { table: 'certifications',   pk: 'cert_id',     multiRow: true,  hasPropertyId: true },
  facilities:        { table: 'facilities',       pk: 'facility_id', multiRow: true,  hasPropertyId: true },
  activities:        { table: 'activities_catalog', pk: 'activity_id', multiRow: true, hasPropertyId: true },
  meeting_rooms:     { table: 'meeting_rooms',    pk: 'meeting_room_id', multiRow: true, hasPropertyId: true },
  meeting_packages:  { table: 'meeting_packages', pk: 'package_id',  multiRow: true,  hasPropertyId: true },
  retreats:          { table: 'retreat_programs', pk: 'retreat_id',  multiRow: true,  hasPropertyId: true },
  retreat_pricing:   { table: 'retreat_pricing',  pk: 'pricing_id',  multiRow: true,  hasPropertyId: false },
  seasons:           { table: 'seasons',          pk: 'season_id',   multiRow: true,  hasPropertyId: true },
  // Social module (spec-social-media-module · 2026-07-25): per-channel output
  // guardrails + weekly content programs. Both property-scoped (Namkhan forced
  // by /api/settings/upsert while the editor is single-property).
  social_rules:      { table: 'social_channel_rules', pk: 'id',      multiRow: true,  hasPropertyId: true },
  social_programs:   { table: 'social_programs',  pk: 'id',          multiRow: true,  hasPropertyId: true },
  // Financial & legal identity — new sections 2026-08-04
  banking:           { table: 'property_banking', pk: 'property_id', multiRow: false, hasPropertyId: true, schema: 'content' },
  // property.licenses, NOT content.property_licenses — fn_license_upsert (the live
  // LicensesPanel write path) targets property.licenses, so the editor must agree with it.
  // Both are empty today; the Banking page still READS content.property_licenses via
  // v_property_licenses, which is a separate read/write split flagged to PBS 2026-09-09.
  licenses:          { table: 'licenses',  pk: 'id',          multiRow: true,  hasPropertyId: true, schema: 'property' },
  // Settings → Data → "Add email feed". The client has posted this section since
  // 2026-08-04 but it was never registered here, so every save 400'd with
  // "Unknown section" — the feature has never once written a row.
  data_integration_email: { table: 'data_integrations', pk: 'slug', multiRow: true, hasPropertyId: true, schema: 'property' },
};

// ── Section registry ────────────────────────────────────────────────────────
// PBS 2026-09-09: both legacy settings pages read marketing.v_settings_sections_live
// to build their section list and sidebar. That view was DROPPED, so /settings
// rendered "No sections registered." and the section editor had an empty rail —
// silently, because a PostgREST error just yields no rows. SECTION_TO_TABLE is the
// code's own source of truth for what sections exist; derive the list from it and
// the two pages can never drift from the write path again.

export const SECTION_LABELS: Record<string, string> = {
  property_identity: 'Identity',
  location_climate:  'Location & Climate',
  brand:             'Brand',
  contacts:          'Contacts',
  social:            'Social Accounts',
  rooms:             'Room Content',
  booking_policies:  'Booking Policies',
  certifications:    'Certifications',
  facilities:        'Facilities',
  activities:        'Activities',
  meeting_rooms:     'Meeting Rooms',
  meeting_packages:  'Meeting Packages',
  retreats:          'Retreat Programs',
  retreat_pricing:   'Retreat Pricing',
  seasons:           'Seasons',
  social_rules:      'Social Guardrails',
  social_programs:   'Social Programs',
  banking:           'Banking',
  licenses:          'Licenses',
  data_integration_email: 'Data · Email Feeds',
};

export interface SettingsSectionSummary {
  section_code: string;
  display_name: string;
  description: string;
  source_table: string;
  /** Target table is absent from the live DB — the section cannot be edited. */
  missing: boolean;
}

/** Every registered section, in declaration order, with its live/dead status. */
export function listSettingsSections(): SettingsSectionSummary[] {
  return Object.entries(SECTION_TO_TABLE).map(([code, cfg]) => ({
    section_code: code,
    display_name: SECTION_LABELS[code] ?? code.replace(/_/g, ' '),
    description: cfg.missing
      ? `Disconnected — ${cfg.schema ?? 'marketing'}.${cfg.table} no longer exists.`
      : `${cfg.schema ?? 'marketing'}.${cfg.table}`,
    source_table: `${cfg.schema ?? 'marketing'}.${cfg.table}`,
    missing: cfg.missing === true,
  }));
}

// Field whitelists existed because property_identity / location_climate / brand all
// shared marketing.property_profile. Since 2026-09-09 each has its own table
// (property.identity / property.location / property.brand), so no whitelist is needed
// — every editable column of the table belongs to that section. Kept as an empty map
// rather than deleted: SectionEditor still consults it, and a future shared table
// will need it again.
export const SECTION_FIELD_WHITELIST: Record<string, string[]> = {};

// Postgres enum values used by FieldRenderer for input_type='enum'.
// Hardcoded because v_settings_field_schema does not expose enum allowed
// values — keep in sync with marketing.contact_kind / marketing.contact_purpose.
export const ENUM_VALUES: Record<string, string[]> = {
  contact_kind: ['phone', 'mobile', 'whatsapp', 'email', 'line', 'wechat', 'telegram', 'fax'],
  contact_purpose: [
    'reservations', 'front_desk', 'gm', 'owner', 'marketing', 'billing',
    'press', 'hr', 'emergency', 'spa', 'restaurant', 'activities', 'transport', 'general',
  ],
};

// LOREM IPSUM detection — recursive (handles nested jsonb / arrays).
export function countPlaceholders(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') {
    return value.startsWith('[LOREM IPSUM') ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce<number>((acc, v) => acc + countPlaceholders(v), 0);
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .reduce<number>((acc, v) => acc + countPlaceholders(v), 0);
  }
  return 0;
}

export function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('[LOREM IPSUM');
}
