// lib/settings.ts
// Types + section→table mapping for the Property Settings editor.
// Reads happen server-side via getSupabaseAdmin() in the page; writes go
// through POST /api/settings/upsert and /api/settings/delete (service-role).
//
// IMPORTANT: marketing schema RLS only allows authenticated owner/gm/
// marketing_lead. The app currently uses mock auth (no JWT), so service-role
// is the only path for both reads and writes on these tables.

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

// section_code → physical table info
export const SECTION_TO_TABLE: Record<
  string,
  { table: string; pk: string; multiRow: boolean; hasPropertyId: boolean }
> = {
  property_identity: { table: 'property_profile', pk: 'property_id', multiRow: false, hasPropertyId: true },
  location_climate:  { table: 'property_profile', pk: 'property_id', multiRow: false, hasPropertyId: true },
  brand:             { table: 'property_profile', pk: 'property_id', multiRow: false, hasPropertyId: true },
  contacts:          { table: 'property_contact', pk: 'contact_id',  multiRow: true,  hasPropertyId: true },
  social:            { table: 'social_accounts',  pk: 'id',          multiRow: true,  hasPropertyId: false },
  rooms:             { table: 'room_type_content',pk: 'room_type_id',multiRow: true,  hasPropertyId: false },
  booking_policies:  { table: 'booking_policies', pk: 'property_id', multiRow: false, hasPropertyId: true },
  certifications:    { table: 'certifications',   pk: 'cert_id',     multiRow: true,  hasPropertyId: true },
  facilities:        { table: 'facilities',       pk: 'facility_id', multiRow: true,  hasPropertyId: true },
  activities:        { table: 'activities_catalog', pk: 'activity_id', multiRow: true, hasPropertyId: true },
  meeting_rooms:     { table: 'meeting_rooms',    pk: 'meeting_room_id', multiRow: true, hasPropertyId: true },
  meeting_packages:  { table: 'meeting_packages', pk: 'package_id',  multiRow: true,  hasPropertyId: true },
  retreats:          { table: 'retreat_programs', pk: 'retreat_id',  multiRow: true,  hasPropertyId: true },
  retreat_pricing:   { table: 'retreat_pricing',  pk: 'pricing_id',  multiRow: true,  hasPropertyId: true },
  seasons:           { table: 'seasons',          pk: 'season_id',   multiRow: true,  hasPropertyId: true },
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
