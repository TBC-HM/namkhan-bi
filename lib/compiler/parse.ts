// lib/compiler/parse.ts
// Regex-based prompt parser for the retreat compiler MVP.
// Extracts: duration_nights, theme, tier, season, pax, lunar_required.
//
// Examples that should parse:
//   "5 day mindfulness retreat — lux only — green season — 8 pax"
//   "3 night detox — mid tier — high season — 4 guests"
//   "7 day river tales — lux — full moon — 6 pax"

export interface ParsedSpec {
  duration_nights: number;
  theme: 'mindfulness' | 'river-tales' | 'retreat-life' | 'detox' | 'general';
  tier: ('budget' | 'mid' | 'lux')[];
  season: ('high' | 'shoulder' | 'green' | 'festive' | 'all')[];
  pax: number;
  lunar_required: boolean;
  warnings: string[];
  // Offer config — set by the operator after the prompt parses.
  // Defaults injected on first build if not yet supplied.
  offer?: {
    window_from: string;       // YYYY-MM-DD
    window_to: string;         // YYYY-MM-DD
    room_type_ids: number[];   // Cloudbeds room_type_id (one variant per room)
    rate_plan_id: number;      // Cloudbeds rate_id (default = Non Refundable)
  };
}

const THEME_KEYWORDS: Record<ParsedSpec['theme'], string[]> = {
  mindfulness:   ['mindful', 'meditation', 'meditate', 'wellness', 'silent'],
  'river-tales': ['river tales', 'river-tales', 'storytelling', 'folklore', 'cruise'],
  'retreat-life':['retreat life', 'retreat-life', 'long stay', 'long-stay', 'sabbatical'],
  detox:         ['detox', 'cleanse', 'restore', 'reset', 'plant-based', 'plant based'],
  general:       [],
};

const TIER_KEYWORDS: Record<'budget' | 'mid' | 'lux', string[]> = {
  budget: ['budget', 'essential', 'basic'],
  mid:    ['mid', 'signature', 'standard', 'classic'],
  lux:    ['lux', 'luxury', 'premium', 'curated'],
};

const SEASON_KEYWORDS: Record<'high' | 'shoulder' | 'green' | 'festive', string[]> = {
  high:     ['high', 'peak', 'dry'],
  shoulder: ['shoulder', 'mild'],
  green:    ['green', 'low', 'monsoon', 'wet'],
  festive:  ['festive', 'festival', 'christmas', 'new year', 'pi mai'],
};

export function parsePrompt(prompt: string): ParsedSpec {
  const p = prompt.toLowerCase();
  const warnings: string[] = [];

  // ---- duration ----
  const durMatch = p.match(/(\d+)\s*(?:night|day)/);
  let duration_nights = durMatch ? parseInt(durMatch[1], 10) : 4;
  if (durMatch && /day/.test(durMatch[0]) && !/night/.test(durMatch[0])) {
    duration_nights = Math.max(1, duration_nights - 1);
  }
  if (duration_nights < 1 || duration_nights > 21) {
    warnings.push(`duration ${duration_nights} clamped to 1..21`);
    duration_nights = Math.min(Math.max(duration_nights, 1), 21);
  }

  // ---- theme ----
  let theme: ParsedSpec['theme'] = 'general';
  for (const t of Object.keys(THEME_KEYWORDS) as ParsedSpec['theme'][]) {
    if (THEME_KEYWORDS[t].some(k => p.includes(k))) { theme = t; break; }
  }

  // ---- tier ----
  const tier: ParsedSpec['tier'] = [];
  for (const t of Object.keys(TIER_KEYWORDS) as ('budget'|'mid'|'lux')[]) {
    if (TIER_KEYWORDS[t].some(k => p.includes(k))) tier.push(t);
  }
  if (tier.length === 0) tier.push('mid', 'lux');

  // ---- season ----
  const season: ParsedSpec['season'] = [];
  for (const s of Object.keys(SEASON_KEYWORDS) as ('high'|'shoulder'|'green'|'festive')[]) {
    if (SEASON_KEYWORDS[s].some(k => p.includes(k))) season.push(s);
  }
  if (season.length === 0) season.push('all');

  // ---- pax ----
  const paxMatch = p.match(/(\d+)\s*(?:pax|guest|people|person)/);
  let pax = paxMatch ? parseInt(paxMatch[1], 10) : 4;
  if (pax < 1 || pax > 20) {
    warnings.push(`pax ${pax} clamped to 1..20`);
    pax = Math.min(Math.max(pax, 1), 20);
  }

  // ---- lunar ----
  const lunar_required = /full moon|lunar|new moon|moon ceremony/.test(p)
    || theme === 'mindfulness'
    || theme === 'retreat-life';

  return { duration_nights, theme, tier, season, pax, lunar_required, warnings };
}
