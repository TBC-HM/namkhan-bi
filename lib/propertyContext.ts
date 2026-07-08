// lib/propertyContext.ts
// PBS 2026-07-08: Hardcoded property facts fed into the SOP generator so the
// LLM has ground truth about rooms / facilities / spa / activities / seasons /
// location instead of inventing them.
//
// Kept in TS (not a DB table) because these facts are physical ground truth
// and change once a year at most — a table would drift out of sync with reality
// faster than the code itself does. When something material changes (new
// facility, new season classification), edit this file and redeploy.

export interface PropertyContext {
  property_id: number;
  name: string;
  location: string;
  short_pitch: string;
  rooms: {
    total_rooms: number;
    total_keys: number;
    types: string[];   // human-readable room type list
  };
  facilities: string[];
  spa_services: string[];
  activities: string[];
  seasons: string[];         // one line per season with month range
  operating_currency: string;
  base_currency: string;
  pms: string;
  cluster_member: string | null;
}

const NAMKHAN: PropertyContext = {
  property_id: 260955,
  name: 'Namkhan',
  location: 'Luang Prabang, Laos — peninsula between the Nam Khan and Mekong rivers.',
  short_pitch: '24-room boutique river-lodge with Retreat Programmes, riverside dining, wellness, and cultural excursions. Small Luxury Hotels member.',
  rooms: {
    total_rooms: 24,
    total_keys: 30,
    types: [
      'Art Suite (signature suite, 1 key)',
      'River Suite (river-view suites)',
      'Garden Suite (garden-view suites)',
      'Deluxe Room (standard category)',
      'Retreat Room (allocated during Retreat Programme weeks)',
    ],
  },
  facilities: [
    'Restaurant (Lao–French menu, indoor and riverside terrace)',
    'Bar with wine list, cocktails, and local rice-spirit selection',
    'Spa and wellness suite',
    'Activities studio (retreat classes, cooking, briefings)',
    'Boat (private river excursions on the Nam Khan / Mekong)',
    'Retail boutique (Lao textiles, silverware, curated goods)',
    'Landscaped riverside gardens and lawn',
    'Riverside deck (yoga / breakfast / sundowner)',
    'Reception and library lounge',
    'Tuk-tuk fleet for guest transfers to old town',
  ],
  spa_services: [
    'Traditional Lao massage (60 / 90 min)',
    'Deep-tissue massage',
    'Aromatherapy massage',
    'Hot-stone treatment',
    'Foot reflexology',
    'Facial ritual (Lao herbal)',
    'Body scrub and wrap',
    'Retreat wellness rituals (bundled with Retreat Programme)',
    'Couples treatment room',
  ],
  activities: [
    'Guided Mekong / Nam Khan boat trip (half-day and sunset)',
    'Mountain-bike ride through nearby villages',
    'Kayak descent on the Nam Khan',
    'Cooking class (Lao cuisine, market visit)',
    'Almsgiving ceremony briefing at dawn',
    'Kuang Si waterfall day excursion',
    'Guided old-town heritage walk',
    'Retreat Programme (multi-day yoga / wellness / cultural)',
    'Elephant sanctuary visit (external partner)',
    'Weaving and craft workshop (external partner)',
  ],
  seasons: [
    'Dry / cool season (Nov–Feb): peak international arrivals, cool nights, low river.',
    'Hot dry season (Mar–May): highest daytime temperatures, dust, forest fires in region, lowest river level.',
    'Green / monsoon season (Jun–Oct): daily rain, high humidity, high river with strong current — some boat trips restricted.',
  ],
  operating_currency: 'LAK (Laotian kip)',
  base_currency: 'USD (all guest-facing pricing)',
  pms: 'Cloudbeds',
  cluster_member: 'Small Luxury Hotels of the World (SLH)',
};

const DONNA: PropertyContext = {
  property_id: 1000001,
  name: 'Donna Portals',
  location: 'Panama City, Panama.',
  short_pitch: 'Boutique apart-hotel with self-contained apartment units and full hotel services.',
  rooms: {
    total_rooms: 22,
    total_keys: 22,
    types: [
      'Studio apartment',
      'One-bedroom apartment',
      'Two-bedroom apartment',
    ],
  },
  facilities: [
    'Reception and 24h guest line',
    'Breakfast dining area',
    'Rooftop terrace',
    'Coworking / lounge area',
    'Small gym',
    'Laundry service',
  ],
  spa_services: [],
  activities: [
    'City-tour partner referrals',
    'Canal excursion partner referrals',
    'Airport transfer',
  ],
  seasons: [
    'Dry season (Dec–Apr): high demand, low rainfall, corporate + leisure mix.',
    'Green / wet season (May–Nov): daily afternoon rain, softer demand, higher long-stay share.',
  ],
  operating_currency: 'USD',
  base_currency: 'USD / EUR quoted',
  pms: 'Mews',
  cluster_member: null,
};

export function getPropertyContext(propertyId: number): PropertyContext {
  if (propertyId === 1000001) return DONNA;
  return NAMKHAN;   // default to Namkhan for the naked /operations path
}

/**
 * Render a compact, LLM-friendly plain-text block for the property so the
 * generate route can prepend it to the system prompt without ballooning tokens.
 */
export function renderPropertyContextForLLM(ctx: PropertyContext): string {
  const lines: string[] = [];
  lines.push(`PROPERTY CONTEXT — ${ctx.name} (id ${ctx.property_id})`);
  lines.push(`Location: ${ctx.location}`);
  lines.push(`Positioning: ${ctx.short_pitch}`);
  lines.push(`PMS: ${ctx.pms}. Operating currency: ${ctx.operating_currency}. Guest-facing currency: ${ctx.base_currency}.`);
  if (ctx.cluster_member) lines.push(`Cluster: ${ctx.cluster_member}.`);
  lines.push('');
  lines.push(`Rooms: ${ctx.rooms.total_rooms} rooms / ${ctx.rooms.total_keys} keys. Categories:`);
  for (const t of ctx.rooms.types) lines.push(`  - ${t}`);
  lines.push('');
  lines.push('Facilities on property:');
  for (const f of ctx.facilities) lines.push(`  - ${f}`);
  if (ctx.spa_services.length > 0) {
    lines.push('');
    lines.push('Spa services offered:');
    for (const s of ctx.spa_services) lines.push(`  - ${s}`);
  }
  if (ctx.activities.length > 0) {
    lines.push('');
    lines.push('Activities and excursions:');
    for (const a of ctx.activities) lines.push(`  - ${a}`);
  }
  lines.push('');
  lines.push('Seasons (ground truth for planning, staffing, and outdoor SOPs):');
  for (const s of ctx.seasons) lines.push(`  - ${s}`);
  lines.push('');
  lines.push('Only reference facilities, room types, spa services, and activities that appear above. Never invent facilities the property does not have.');
  return lines.join('\n');
}
