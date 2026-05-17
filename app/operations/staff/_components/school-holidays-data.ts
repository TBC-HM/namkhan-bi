// School-holiday RANGES by source country/region.
// Used by the Holidays tab to overlay demand-side school-break periods so PBS
// can see when guest-origin markets are simultaneously on break (= demand peaks).
//
// Sources (cross-checked Dec 2024 / Jan 2025 — verify yearly via national
// education ministries / state school calendars):
//   DE  · Bavaria + NRW (the two largest German Länder by guest origin)
//   ES  · Balearic Islands (own school calendar, Govern de les Illes Balears)
//   SE  · National (Skolverket-recommended, vast majority of municipalities)
//   UK  · England (DfE term-times; Scotland differs but England covers ~85%)
//   US  · Federal-ish (typical K-12 public; mid-Aug → mid-Jun pattern)
//   INT · International schools' 6-week summer model (mid-Jun → end-Aug)
//
// Each entry = a single closed break (inclusive). Day-by-day rendering walks
// from start_date to end_date and adds each day to the overlay.

// PBS 2026-05-16: Asian source markets added for Namkhan (Laos). Existing
// EU sources kept for Donna (Spain). `sourcePaletteForProperty()` returns
// the per-property dropdown.
export type SchoolSource =
  | 'de' | 'es' | 'se' | 'uk' | 'us' | 'int'
  | 'th' | 'cn' | 'jp' | 'kr' | 'vn' | 'sg' | 'au';

export interface SchoolBreak {
  source: SchoolSource;
  label: string;          // "Easter break", "Autumn half-term", etc.
  start_date: string;     // YYYY-MM-DD (inclusive)
  end_date: string;       // YYYY-MM-DD (inclusive)
  verified: boolean;      // false = best-guess, needs annual confirmation
  notes?: string;
}

export const SOURCE_META: Record<SchoolSource, { label: string; flag: string; color: string; region: string }> = {
  // EU + global source markets (Donna palette)
  de:  { label: 'German',        flag: '🇩🇪', color: '#d4a866', region: 'Bavaria + NRW (largest Länder)' },
  es:  { label: 'Spanish',       flag: '🇪🇸', color: '#c97b6a', region: 'Balearic Islands' },
  se:  { label: 'Swedish',       flag: '🇸🇪', color: '#5dade2', region: 'National (Skolverket)' },
  uk:  { label: 'UK',            flag: '🇬🇧', color: '#5a3e85', region: 'England (DfE)' },
  us:  { label: 'US',            flag: '🇺🇸', color: '#a8754a', region: 'Federal-ish K-12' },
  int: { label: 'International', flag: '🌐', color: '#6b9379', region: '6-week summer schools' },
  // Asia-Pacific source markets (Namkhan palette · added 2026-05-16)
  th:  { label: 'Thailand',      flag: '🇹🇭', color: '#e5b25e', region: 'MoE national term calendar' },
  cn:  { label: 'China',         flag: '🇨🇳', color: '#c95755', region: 'National Day + Spring Festival peaks' },
  jp:  { label: 'Japan',         flag: '🇯🇵', color: '#d68aa2', region: 'MEXT national term calendar' },
  kr:  { label: 'Korea',         flag: '🇰🇷', color: '#4f7fb7', region: 'National K-12 (winter + summer)' },
  vn:  { label: 'Vietnam',       flag: '🇻🇳', color: '#a8854a', region: 'National MoET + Tết' },
  sg:  { label: 'Singapore',     flag: '🇸🇬', color: '#6b9379', region: 'MoE 4-term system' },
  au:  { label: 'Australia',     flag: '🇦🇺', color: '#7c93b8', region: 'National 4-term (NSW/VIC)' },
};

// PBS 2026-05-16: per-property source-market palette. Namkhan = Asia-Pacific
// inbound markets (cross-checked with Cloudbeds source_country mix). Donna =
// EU markets. The 'int' bucket is shown for both as the catch-all overlay.
export const SOURCE_PALETTE_NAMKHAN: SchoolSource[] = ['th', 'cn', 'jp', 'kr', 'vn', 'sg', 'au', 'int'];
export const SOURCE_PALETTE_DONNA:   SchoolSource[] = ['de', 'es', 'se', 'uk', 'us', 'int'];

export function sourcePaletteForProperty(propertyId: number): SchoolSource[] {
  if (propertyId === 1000001) return SOURCE_PALETTE_DONNA;
  return SOURCE_PALETTE_NAMKHAN;
}

export const SCHOOL_BREAKS: SchoolBreak[] = [
  // ======================================================================
  // GERMANY · Bavaria (BY) + North Rhine-Westphalia (NRW) consolidated.
  // Source: kmk.org annual school-holiday tables.
  // ======================================================================
  // 2025
  { source: 'de', label: 'Winter / Carnival',    start_date: '2025-03-03', end_date: '2025-03-07', verified: true, notes: 'NRW Rosenmontag week' },
  { source: 'de', label: 'Easter break',         start_date: '2025-04-14', end_date: '2025-04-25', verified: true },
  { source: 'de', label: 'Whitsun (Pfingsten)',  start_date: '2025-06-10', end_date: '2025-06-20', verified: true, notes: 'Bavaria' },
  { source: 'de', label: 'Summer (BY)',          start_date: '2025-07-31', end_date: '2025-09-15', verified: true, notes: 'Bavaria' },
  { source: 'de', label: 'Summer (NRW)',         start_date: '2025-07-14', end_date: '2025-08-26', verified: true, notes: 'NRW' },
  { source: 'de', label: 'Autumn break',         start_date: '2025-10-13', end_date: '2025-10-25', verified: true },
  { source: 'de', label: 'Christmas',            start_date: '2025-12-22', end_date: '2026-01-05', verified: true },
  // 2026
  { source: 'de', label: 'Winter / Carnival',    start_date: '2026-02-16', end_date: '2026-02-20', verified: false, notes: 'NRW Rosenmontag week — verify' },
  { source: 'de', label: 'Easter break',         start_date: '2026-03-30', end_date: '2026-04-10', verified: false },
  { source: 'de', label: 'Whitsun (Pfingsten)',  start_date: '2026-05-26', end_date: '2026-06-05', verified: false, notes: 'Bavaria' },
  { source: 'de', label: 'Summer (BY)',          start_date: '2026-08-03', end_date: '2026-09-14', verified: false, notes: 'Bavaria' },
  { source: 'de', label: 'Summer (NRW)',         start_date: '2026-06-29', end_date: '2026-08-11', verified: false, notes: 'NRW' },
  { source: 'de', label: 'Autumn break',         start_date: '2026-10-12', end_date: '2026-10-24', verified: false },
  { source: 'de', label: 'Christmas',            start_date: '2026-12-23', end_date: '2027-01-06', verified: false },

  // ======================================================================
  // SPAIN · Balearic Islands (Conselleria d'Educació)
  // ======================================================================
  // 2025
  { source: 'es', label: 'Easter (Setmana Santa)', start_date: '2025-04-12', end_date: '2025-04-21', verified: true },
  { source: 'es', label: 'Summer',                 start_date: '2025-06-22', end_date: '2025-09-09', verified: true, notes: 'Cierre largo de verano' },
  { source: 'es', label: 'Carnaval',               start_date: '2025-03-03', end_date: '2025-03-04', verified: true },
  { source: 'es', label: 'Navidad',                start_date: '2025-12-22', end_date: '2026-01-07', verified: true },
  // 2026
  { source: 'es', label: 'Carnaval',               start_date: '2026-02-16', end_date: '2026-02-17', verified: false },
  { source: 'es', label: 'Easter (Setmana Santa)', start_date: '2026-03-28', end_date: '2026-04-06', verified: false },
  { source: 'es', label: 'Summer',                 start_date: '2026-06-22', end_date: '2026-09-09', verified: false },
  { source: 'es', label: 'Navidad',                start_date: '2026-12-22', end_date: '2027-01-07', verified: false },

  // ======================================================================
  // SWEDEN · National (Skolverket recommendation, ~all kommuner follow)
  // ======================================================================
  // 2025
  { source: 'se', label: 'Sportlov (week 8/9)',    start_date: '2025-02-17', end_date: '2025-03-02', verified: true, notes: 'Varies week 7-12 by region' },
  { source: 'se', label: 'Påsklov',                start_date: '2025-04-14', end_date: '2025-04-22', verified: true },
  { source: 'se', label: 'Summer',                 start_date: '2025-06-15', end_date: '2025-08-18', verified: true },
  { source: 'se', label: 'Höstlov (week 44)',      start_date: '2025-10-27', end_date: '2025-10-31', verified: true },
  { source: 'se', label: 'Jullov',                 start_date: '2025-12-22', end_date: '2026-01-07', verified: true },
  // 2026
  { source: 'se', label: 'Sportlov',               start_date: '2026-02-16', end_date: '2026-03-01', verified: false },
  { source: 'se', label: 'Påsklov',                start_date: '2026-03-30', end_date: '2026-04-06', verified: false },
  { source: 'se', label: 'Summer',                 start_date: '2026-06-15', end_date: '2026-08-18', verified: false },
  { source: 'se', label: 'Höstlov',                start_date: '2026-10-26', end_date: '2026-10-30', verified: false },
  { source: 'se', label: 'Jullov',                 start_date: '2026-12-22', end_date: '2027-01-08', verified: false },

  // ======================================================================
  // UK · England (DfE 6-half-term-pattern)
  // ======================================================================
  // 2025
  { source: 'uk', label: 'Spring half-term',       start_date: '2025-02-17', end_date: '2025-02-21', verified: true },
  { source: 'uk', label: 'Easter break',           start_date: '2025-04-07', end_date: '2025-04-21', verified: true },
  { source: 'uk', label: 'May half-term',          start_date: '2025-05-26', end_date: '2025-05-30', verified: true },
  { source: 'uk', label: 'Summer',                 start_date: '2025-07-23', end_date: '2025-09-02', verified: true },
  { source: 'uk', label: 'Autumn half-term',       start_date: '2025-10-27', end_date: '2025-10-31', verified: true },
  { source: 'uk', label: 'Christmas',              start_date: '2025-12-22', end_date: '2026-01-05', verified: true },
  // 2026
  { source: 'uk', label: 'Spring half-term',       start_date: '2026-02-16', end_date: '2026-02-20', verified: false },
  { source: 'uk', label: 'Easter break',           start_date: '2026-03-30', end_date: '2026-04-10', verified: false },
  { source: 'uk', label: 'May half-term',          start_date: '2026-05-25', end_date: '2026-05-29', verified: false },
  { source: 'uk', label: 'Summer',                 start_date: '2026-07-22', end_date: '2026-09-02', verified: false },
  { source: 'uk', label: 'Autumn half-term',       start_date: '2026-10-26', end_date: '2026-10-30', verified: false },
  { source: 'uk', label: 'Christmas',              start_date: '2026-12-21', end_date: '2027-01-04', verified: false },

  // ======================================================================
  // US · Federal-ish K-12 (typical public-school calendar)
  // ======================================================================
  // 2025
  { source: 'us', label: 'Presidents-Day week',    start_date: '2025-02-17', end_date: '2025-02-21', verified: true },
  { source: 'us', label: 'Spring break',           start_date: '2025-03-24', end_date: '2025-03-28', verified: true, notes: 'Varies; most district-clustered' },
  { source: 'us', label: 'Memorial-Day weekend',   start_date: '2025-05-24', end_date: '2025-05-26', verified: true },
  { source: 'us', label: 'Summer',                 start_date: '2025-06-09', end_date: '2025-08-22', verified: true },
  { source: 'us', label: 'Thanksgiving',           start_date: '2025-11-26', end_date: '2025-11-30', verified: true },
  { source: 'us', label: 'Christmas / Hanukkah',   start_date: '2025-12-22', end_date: '2026-01-02', verified: true },
  // 2026
  { source: 'us', label: 'Presidents-Day week',    start_date: '2026-02-16', end_date: '2026-02-20', verified: false },
  { source: 'us', label: 'Spring break',           start_date: '2026-03-30', end_date: '2026-04-03', verified: false },
  { source: 'us', label: 'Memorial-Day weekend',   start_date: '2026-05-23', end_date: '2026-05-25', verified: false },
  { source: 'us', label: 'Summer',                 start_date: '2026-06-08', end_date: '2026-08-21', verified: false },
  { source: 'us', label: 'Thanksgiving',           start_date: '2026-11-25', end_date: '2026-11-29', verified: false },
  { source: 'us', label: 'Christmas',              start_date: '2026-12-21', end_date: '2027-01-01', verified: false },

  // ======================================================================
  // INTERNATIONAL · 6-week summer schools (ISCS / ECIS / IB pattern)
  // ======================================================================
  // 2025
  { source: 'int', label: 'Easter break',          start_date: '2025-04-07', end_date: '2025-04-21', verified: true },
  { source: 'int', label: 'Summer (6 weeks)',      start_date: '2025-06-30', end_date: '2025-08-22', verified: true },
  { source: 'int', label: 'Autumn break',          start_date: '2025-10-20', end_date: '2025-10-31', verified: true },
  { source: 'int', label: 'Winter',                start_date: '2025-12-19', end_date: '2026-01-05', verified: true },
  // 2026
  { source: 'int', label: 'Easter break',          start_date: '2026-03-30', end_date: '2026-04-10', verified: false },
  { source: 'int', label: 'Summer (6 weeks)',      start_date: '2026-06-29', end_date: '2026-08-21', verified: false },
  { source: 'int', label: 'Autumn break',          start_date: '2026-10-19', end_date: '2026-10-30', verified: false },
  { source: 'int', label: 'Winter',                start_date: '2026-12-21', end_date: '2027-01-04', verified: false },

  // ======================================================================
  // THAILAND · MoE national (typical 2-semester calendar). Closest source
  // market for Namkhan; Songkran + October mid-term are big inbound peaks.
  // ======================================================================
  // 2025
  { source: 'th', label: 'Songkran / summer',      start_date: '2025-03-15', end_date: '2025-05-15', verified: false, notes: 'Songkran public holiday Apr 13-15' },
  { source: 'th', label: 'Mid-term October',       start_date: '2025-10-11', end_date: '2025-10-19', verified: false },
  { source: 'th', label: 'Year-end / New Year',    start_date: '2025-12-20', end_date: '2026-01-04', verified: false },
  // 2026
  { source: 'th', label: 'Songkran / summer',      start_date: '2026-03-14', end_date: '2026-05-15', verified: false },
  { source: 'th', label: 'Mid-term October',       start_date: '2026-10-10', end_date: '2026-10-18', verified: false },
  { source: 'th', label: 'Year-end / New Year',    start_date: '2026-12-19', end_date: '2027-01-04', verified: false },

  // ======================================================================
  // CHINA · Spring Festival + Golden Week peaks (school + national leave
  // overlap drives massive outbound to SEA).
  // ======================================================================
  // 2025
  { source: 'cn', label: 'Spring Festival',        start_date: '2025-01-28', end_date: '2025-02-04', verified: false, notes: 'Chunyun · biggest outbound peak' },
  { source: 'cn', label: 'Qingming',               start_date: '2025-04-04', end_date: '2025-04-06', verified: false },
  { source: 'cn', label: 'Labour Day',             start_date: '2025-05-01', end_date: '2025-05-05', verified: false },
  { source: 'cn', label: 'Summer break',           start_date: '2025-07-01', end_date: '2025-08-31', verified: false },
  { source: 'cn', label: 'Golden Week',            start_date: '2025-10-01', end_date: '2025-10-08', verified: false, notes: 'National Day + Mid-Autumn' },
  { source: 'cn', label: 'Winter break',           start_date: '2026-01-15', end_date: '2026-02-22', verified: false },
  // 2026
  { source: 'cn', label: 'Spring Festival',        start_date: '2026-02-16', end_date: '2026-02-24', verified: false },
  { source: 'cn', label: 'Qingming',               start_date: '2026-04-04', end_date: '2026-04-06', verified: false },
  { source: 'cn', label: 'Labour Day',             start_date: '2026-05-01', end_date: '2026-05-05', verified: false },
  { source: 'cn', label: 'Summer break',           start_date: '2026-07-01', end_date: '2026-08-31', verified: false },
  { source: 'cn', label: 'Golden Week',            start_date: '2026-10-01', end_date: '2026-10-08', verified: false },

  // ======================================================================
  // JAPAN · MEXT 3-term system. Golden Week, summer Obon, year-end.
  // ======================================================================
  // 2025
  { source: 'jp', label: 'Spring break',           start_date: '2025-03-25', end_date: '2025-04-06', verified: false },
  { source: 'jp', label: 'Golden Week',            start_date: '2025-04-29', end_date: '2025-05-06', verified: false, notes: '4 consecutive public holidays' },
  { source: 'jp', label: 'Summer / Obon',          start_date: '2025-07-21', end_date: '2025-08-31', verified: false },
  { source: 'jp', label: 'Year-end',               start_date: '2025-12-25', end_date: '2026-01-07', verified: false },
  // 2026
  { source: 'jp', label: 'Spring break',           start_date: '2026-03-25', end_date: '2026-04-06', verified: false },
  { source: 'jp', label: 'Golden Week',            start_date: '2026-04-29', end_date: '2026-05-06', verified: false },
  { source: 'jp', label: 'Summer / Obon',          start_date: '2026-07-21', end_date: '2026-08-31', verified: false },
  { source: 'jp', label: 'Year-end',               start_date: '2026-12-25', end_date: '2027-01-07', verified: false },

  // ======================================================================
  // KOREA · National K-12. Big winter (Jan-Feb) + summer (Jul-Aug) breaks.
  // ======================================================================
  // 2025
  { source: 'kr', label: 'Winter break',           start_date: '2025-01-04', end_date: '2025-02-28', verified: false, notes: 'Includes Lunar New Year' },
  { source: 'kr', label: 'Spring break',           start_date: '2025-05-01', end_date: '2025-05-06', verified: false, notes: 'Children\'s Day cluster' },
  { source: 'kr', label: 'Summer break',           start_date: '2025-07-20', end_date: '2025-08-25', verified: false },
  { source: 'kr', label: 'Chuseok',                start_date: '2025-10-05', end_date: '2025-10-09', verified: false },
  { source: 'kr', label: 'Year-end',               start_date: '2025-12-22', end_date: '2026-01-04', verified: false },
  // 2026
  { source: 'kr', label: 'Winter break',           start_date: '2026-01-04', end_date: '2026-02-28', verified: false },
  { source: 'kr', label: 'Summer break',           start_date: '2026-07-20', end_date: '2026-08-25', verified: false },
  { source: 'kr', label: 'Chuseok',                start_date: '2026-09-24', end_date: '2026-09-28', verified: false },
  { source: 'kr', label: 'Year-end',               start_date: '2026-12-22', end_date: '2027-01-04', verified: false },

  // ======================================================================
  // VIETNAM · MoET national. Tết + summer are peak outbound.
  // ======================================================================
  // 2025
  { source: 'vn', label: 'Tết Nguyên Đán',         start_date: '2025-01-25', end_date: '2025-02-02', verified: false },
  { source: 'vn', label: 'Reunification + Labour', start_date: '2025-04-30', end_date: '2025-05-04', verified: false },
  { source: 'vn', label: 'Summer break',           start_date: '2025-06-01', end_date: '2025-08-31', verified: false },
  // 2026
  { source: 'vn', label: 'Tết Nguyên Đán',         start_date: '2026-02-14', end_date: '2026-02-22', verified: false },
  { source: 'vn', label: 'Reunification + Labour', start_date: '2026-04-30', end_date: '2026-05-04', verified: false },
  { source: 'vn', label: 'Summer break',           start_date: '2026-06-01', end_date: '2026-08-31', verified: false },

  // ======================================================================
  // SINGAPORE · MoE 4-term. Mid-year + end-of-year are peak outbound.
  // ======================================================================
  // 2025
  { source: 'sg', label: 'Term 1 break',           start_date: '2025-03-15', end_date: '2025-03-23', verified: false },
  { source: 'sg', label: 'Mid-year',               start_date: '2025-05-31', end_date: '2025-06-29', verified: false },
  { source: 'sg', label: 'Term 3 break',           start_date: '2025-09-06', end_date: '2025-09-14', verified: false },
  { source: 'sg', label: 'End-of-year',            start_date: '2025-11-22', end_date: '2026-01-02', verified: false },
  // 2026
  { source: 'sg', label: 'Term 1 break',           start_date: '2026-03-14', end_date: '2026-03-22', verified: false },
  { source: 'sg', label: 'Mid-year',               start_date: '2026-05-30', end_date: '2026-06-28', verified: false },
  { source: 'sg', label: 'Term 3 break',           start_date: '2026-09-05', end_date: '2026-09-13', verified: false },
  { source: 'sg', label: 'End-of-year',            start_date: '2026-11-21', end_date: '2027-01-02', verified: false },

  // ======================================================================
  // AUSTRALIA · NSW/VIC 4-term. Big LP market (esp. mature couples).
  // ======================================================================
  // 2025
  { source: 'au', label: 'Term 1 break',           start_date: '2025-04-12', end_date: '2025-04-27', verified: false, notes: 'Easter + Anzac' },
  { source: 'au', label: 'Term 2 break',           start_date: '2025-07-05', end_date: '2025-07-20', verified: false },
  { source: 'au', label: 'Term 3 break',           start_date: '2025-09-20', end_date: '2025-10-06', verified: false },
  { source: 'au', label: 'Summer break',           start_date: '2025-12-19', end_date: '2026-01-27', verified: false, notes: 'Summer is Dec-Jan in AU' },
  // 2026
  { source: 'au', label: 'Term 1 break',           start_date: '2026-04-04', end_date: '2026-04-19', verified: false },
  { source: 'au', label: 'Term 2 break',           start_date: '2026-07-04', end_date: '2026-07-19', verified: false },
  { source: 'au', label: 'Term 3 break',           start_date: '2026-09-19', end_date: '2026-10-04', verified: false },
  { source: 'au', label: 'Summer break',           start_date: '2026-12-19', end_date: '2027-01-27', verified: false },
];

// ─────────────────────────────────────────────────────────────────────────
// Helper: per-day source-overlap counts for a given year.
// Returns a Map<isoDate, Set<source>> so callers can derive count + tooltip.
// ─────────────────────────────────────────────────────────────────────────

export function buildDailyOverlap(year: number, enabledSources: Set<SchoolSource>): Map<string, Set<SchoolSource>> {
  const out = new Map<string, Set<SchoolSource>>();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd   = new Date(Date.UTC(year, 11, 31));

  for (const br of SCHOOL_BREAKS) {
    if (!enabledSources.has(br.source)) continue;
    const s = new Date(br.start_date + 'T00:00:00Z');
    const e = new Date(br.end_date   + 'T00:00:00Z');
    const lo = s < yearStart ? yearStart : s;
    const hi = e > yearEnd   ? yearEnd   : e;
    if (lo > hi) continue;
    for (let d = new Date(lo); d <= hi; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      let set = out.get(iso);
      if (!set) { set = new Set(); out.set(iso, set); }
      set.add(br.source);
    }
  }
  return out;
}

// 4-tier density palette (peach/brass family). Index 0 = no overlap.
export const DENSITY_PALETTE = [
  'transparent',
  'rgba(247, 172, 103, 0.22)',  // 1 country  · light peach
  'rgba(247, 172, 103, 0.45)',  // 2          · medium peach
  'rgba(247, 172, 103, 0.70)',  // 3          · darker
  'rgba(220, 110, 40,  0.92)',  // 4+         · deep terracotta
] as const;

export function densityColor(count: number): string {
  if (count <= 0) return DENSITY_PALETTE[0];
  if (count >= 4) return DENSITY_PALETTE[4];
  return DENSITY_PALETTE[count];
}
