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
//  · `missing: true` marks a target that NO LONGER EXISTS in the database
//    (marketing.property_profile / property_contact / booking_policies /
//    property_banking / property_licenses were dropped). Saves against these
//    used to surface a raw Postgres 42P01; they now fail with a clear message.
//    The /h/[pid]/settings pages READ property.* — these five sections have no
//    working editor and need an owner decision (retire vs repoint).
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
    schema?: 'marketing' | 'property';
    /** Target table is absent from the live DB — reject the write loudly. */
    missing?: boolean;
  }
> = {
  property_identity: { table: 'property_profile', pk: 'property_id', multiRow: false, hasPropertyId: true, missing: true },
  location_climate:  { table: 'property_profile', pk: 'property_id', multiRow: false, hasPropertyId: true, missing: true },
  brand:             { table: 'property_profile', pk: 'property_id', multiRow: false, hasPropertyId: true, missing: true },
  contacts:          { table: 'property_contact', pk: 'contact_id',  multiRow: true,  hasPropertyId: true, missing: true },
  social:            { table: 'social_accounts',  pk: 'id',          multiRow: true,  hasPropertyId: true },
  rooms:             { table: 'room_type_content',pk: 'room_type_id',multiRow: true,  hasPropertyId: true },
  booking_policies:  { table: 'booking_policies', pk: 'property_id', multiRow: false, hasPropertyId: true, missing: true },
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
  banking:           { table: 'property_banking', pk: 'property_id', multiRow: false, hasPropertyId: true, missing: true },
  licenses:          { table: 'property_licenses', pk: 'license_id', multiRow: true,  hasPropertyId: true, missing: true },
  // Settings → Data → "Add email feed". The client has posted this section since
  // 2026-08-04 but it was never registered here, so every save 400'd with
  // "Unknown section" — the feature has never once written a row.
  data_integration_email: { table: 'data_integrations', pk: 'slug', multiRow: true, hasPropertyId: true, schema: 'property' },
};

// Field whitelists for sections that share a physical table (property_profile).
// Other sections render every editable field from their table.
export const SECTION_FIELD_WHITELIST: Record<string, string[]> = {
  property_identity: [
    'legal_name', 'trading_name', 'star_rating', 'category', 'brand_taglines',
    'short_description', 'long_description', 'unique_selling_points',
    'affiliations', 'tax_id', 'vat_registered', 'business_license_no',
  ],
  location_climate: [
    'street_line_1', 'street_line_2', 'village', 'district', 'city', 'province',
    'country', 'postal_code', 'latitude', 'longitude', 'google_plus_code',
    'google_maps_url', 'timezone',
    'airport_distance_km', 'airport_drive_time_min', 'train_distance_km',
    'train_drive_time_min', 'bus_drive_time_min',
    'climate_temp_min_c', 'climate_temp_max_c', 'climate_rainy_months',
    'climate_summary', 'shuttle_available', 'shuttle_description',
    'check_in_time', 'check_out_time', 'primary_language', 'languages_spoken',
    'website_url', 'booking_engine_url',
  ],
  brand: [
    'logo_url', 'hero_image_url', 'brand_color_hex', 'brand_palette',
    'brand_typography', 'brand_logo_variants', 'brand_assets_url',
  ],
};

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
