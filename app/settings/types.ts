// /settings — canonical type definitions
// Source views (when live): marketing.v_settings_sections_live, marketing.v_settings_field_schema
// Fallback: static manifest below if views not yet populated

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'array'
  | 'select'
  | 'email'
  | 'phone'
  | 'url'
  | 'time'
  | 'color';

export interface SettingsField {
  field_key: string;
  label: string;
  type: FieldType;
  required: boolean;
  editable: boolean;
  hint?: string;
  options?: string[]; // for select fields
  placeholder?: string;
}

export interface SettingsSection {
  section_code: string;
  display_name: string;
  description: string;
  pillar: string;           // identity | contacts | brand | sustainability | operations | distribution
  icon: string;             // emoji icon
  last_updated_at: string | null;
  source_view: string;      // marketing.v_* or marketing.property_profile etc.
  field_count: number;
  is_locked: boolean;       // some sections locked to owner-role only
}

export type FreshnessTone = 'green' | 'brass' | 'terracotta';

export function getFreshnessTone(lastUpdatedAt: string | null): FreshnessTone {
  if (!lastUpdatedAt) return 'terracotta';
  const days = Math.floor(
    (Date.now() - new Date(lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 30) return 'green';
  if (days <= 90) return 'brass';
  return 'terracotta';
}

export function getFreshnessLabel(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) return 'Never updated';
  const days = Math.floor(
    (Date.now() - new Date(lastUpdatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 30) return `Updated ${days}d ago`;
  if (days <= 90) return `Updated ${days}d ago`;
  return `Updated ${days}d ago — needs review`;
}

// ─── Static 15-section manifest (used until v_settings_sections_live is live) ──
// TODO: replace with fetch from marketing.v_settings_sections_live when view is confirmed
export const SETTINGS_SECTIONS_MANIFEST: SettingsSection[] = [
  {
    section_code: 'identity',
    display_name: 'Property Identity',
    description: 'Trading name, legal name, star rating, category, brand taglines, USPs',
    pillar: 'identity',
    icon: '🏨',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 8,
    is_locked: false,
  },
  {
    section_code: 'description',
    display_name: 'Descriptions',
    description: 'Short + long property description used across channels, booking engine, OTAs',
    pillar: 'identity',
    icon: '📝',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 3,
    is_locked: false,
  },
  {
    section_code: 'location',
    display_name: 'Location & Address',
    description: 'Physical address, GPS coordinates, city, district, country',
    pillar: 'identity',
    icon: '📍',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 6,
    is_locked: false,
  },
  {
    section_code: 'contacts',
    display_name: 'Contacts',
    description: 'All contact channels: reservations, billing, owner, GM, emergency',
    pillar: 'contacts',
    icon: '📞',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 10,
    is_locked: false,
  },
  {
    section_code: 'brand',
    display_name: 'Brand & Visual Identity',
    description: 'Brand colors, palette roles, fonts, logo references',
    pillar: 'brand',
    icon: '🎨',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 7,
    is_locked: true,
  },
  {
    section_code: 'social',
    display_name: 'Social Media',
    description: 'All social handles and platform URLs: Instagram, Facebook, LinkedIn, TikTok',
    pillar: 'brand',
    icon: '📱',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 5,
    is_locked: false,
  },
  {
    section_code: 'facilities',
    display_name: 'Facilities & Amenities',
    description: 'Room types, pools, spa, dining, activities — structured list',
    pillar: 'operations',
    icon: '🏊',
    last_updated_at: null,
    source_view: 'marketing.v_property_capacity',
    field_count: 12,
    is_locked: false,
  },
  {
    section_code: 'capacity',
    display_name: 'Capacity & Room Config',
    description: 'Total rooms, room categories, max occupancy, bed configurations',
    pillar: 'operations',
    icon: '🛏️',
    last_updated_at: null,
    source_view: 'marketing.v_property_capacity',
    field_count: 6,
    is_locked: false,
  },
  {
    section_code: 'check_in_out',
    display_name: 'Check-in / Check-out',
    description: 'Standard times, early check-in rules, late check-out rules, policies',
    pillar: 'operations',
    icon: '⏰',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 4,
    is_locked: false,
  },
  {
    section_code: 'sustainability',
    display_name: 'Sustainability & Certifications',
    description: 'Active certifications (ASEAN Green Hotel, SLH, Plastic-Free Laos), expiry dates',
    pillar: 'sustainability',
    icon: '🌿',
    last_updated_at: null,
    source_view: 'marketing.v_property_certifications',
    field_count: 6,
    is_locked: false,
  },
  {
    section_code: 'affiliations',
    display_name: 'Affiliations & Memberships',
    description: 'SLH Considerate Collection, Hilton Honors, other distribution affiliations',
    pillar: 'distribution',
    icon: '🤝',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 4,
    is_locked: false,
  },
  {
    section_code: 'languages',
    display_name: 'Languages Spoken',
    description: 'Staff languages: English, Lao, French, Thai — used for OTA & booking engine config',
    pillar: 'operations',
    icon: '🌐',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 2,
    is_locked: false,
  },
  {
    section_code: 'distribution',
    display_name: 'Distribution & Booking',
    description: 'Booking engine URL, OTA connections, channel manager config',
    pillar: 'distribution',
    icon: '🔗',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 5,
    is_locked: true,
  },
  {
    section_code: 'usp',
    display_name: 'Unique Selling Points',
    description: 'Ordered list of USPs used in agent prompts, OTA listings, sales scripts',
    pillar: 'identity',
    icon: '⭐',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 3,
    is_locked: false,
  },
  {
    section_code: 'meta',
    display_name: 'System & Meta',
    description: 'Property ID, Cloudbeds property code, fiscal year start, default currency, timezone',
    pillar: 'operations',
    icon: '⚙️',
    last_updated_at: null,
    source_view: 'marketing.v_property_card',
    field_count: 5,
    is_locked: true,
  },
];

// Pillar ordering for display grouping
export const PILLAR_ORDER = ['identity', 'contacts', 'brand', 'sustainability', 'operations', 'distribution'];
export const PILLAR_LABELS: Record<string, string> = {
  identity: 'Identity',
  contacts: 'Contacts',
  brand: 'Brand',
  sustainability: 'Sustainability',
  operations: 'Operations',
  distribution: 'Distribution',
};
