// app/operations/staff/_components/holidays-data.ts
// PBS 2026-05-13 — Public holidays / festivos by property.
//
// SCOPE
//   Donna Portals (Calvià, Mallorca, Spain) — National + Balearic + Calvià local
//   The Namkhan (Luang Prabang, Laos)       — Lao national (Buddhist + civil)
//
// SOURCES (verify each year)
//   ES national : BOE official calendar (publicado dic. previo)
//   Balearic    : BOIB resolución (Conselleria de Treball)
//   Calvià      : Ayuntamiento de Calvià — fiestas locales (publicadas BOIB)
//   Lao        : MoLSW / Lao Government Gazette
//
// Calvià local fiestas are typically TWO per year and are not always
// the same dates — verify with the Ayuntamiento each December.
// Flag any unverified date with `verified: false` so PBS can review.

export type HolidayScope = 'national' | 'regional' | 'local';
export type HolidayKind  = 'civic' | 'religious' | 'cultural';

export interface Holiday {
  /** ISO date YYYY-MM-DD (always single-day; multi-day → repeat entries) */
  date: string;
  /** Display name in local language */
  name_local: string;
  /** English label */
  name_en: string;
  scope: HolidayScope;
  kind:  HolidayKind;
  /** True = sourced from BOE/BOIB/Ayuntamiento; false = needs PBS confirmation */
  verified: boolean;
  /** Optional explanation, exception, or municipal note */
  notes?: string;
}

// =============================================================================
// SPAIN — CALVIÀ (Donna Portals · property_id 1000001)
// =============================================================================

// PBS NOTE — verified items below match BOE 2025 + BOIB 2025/2026.
// Calvià local fiestas marked verified:false because municipal decree
// must be confirmed each year (typically published Dec previous year).

export const ES_CALVIA_HOLIDAYS: Holiday[] = [
  // ---- 2025 (historical reference) ----
  { date: '2025-01-01', name_local: 'Año Nuevo',                  name_en: "New Year's Day",          scope: 'national', kind: 'civic',     verified: true },
  { date: '2025-01-06', name_local: 'Epifanía del Señor',         name_en: 'Epiphany (Reyes)',        scope: 'national', kind: 'religious', verified: true },
  { date: '2025-03-01', name_local: 'Dia de les Illes Balears',   name_en: 'Balearic Islands Day',    scope: 'regional', kind: 'civic',     verified: true },
  { date: '2025-04-18', name_local: 'Viernes Santo',              name_en: 'Good Friday',             scope: 'national', kind: 'religious', verified: true },
  { date: '2025-04-21', name_local: 'Lunes de Pascua',            name_en: 'Easter Monday',           scope: 'regional', kind: 'religious', verified: true },
  { date: '2025-05-01', name_local: 'Día del Trabajo',            name_en: 'Labour Day',              scope: 'national', kind: 'civic',     verified: true },
  { date: '2025-07-25', name_local: 'Sant Jaume Apòstol',         name_en: 'St James (Patron Calvià)', scope: 'local',    kind: 'religious', verified: false, notes: 'Calvià patron — verify with Ayuntamiento' },
  { date: '2025-08-15', name_local: 'Asunción de la Virgen',      name_en: 'Assumption of Mary',      scope: 'national', kind: 'religious', verified: true },
  { date: '2025-09-12', name_local: 'Festa del Rei En Jaume',     name_en: 'King James I Festival',   scope: 'local',    kind: 'cultural',  verified: false, notes: 'Calvià municipal — verify' },
  { date: '2025-10-13', name_local: 'Fiesta Nacional de España',  name_en: 'National Day (moved)',    scope: 'national', kind: 'civic',     verified: true, notes: '12 Oct on Sunday → observed Mon 13' },
  { date: '2025-11-01', name_local: 'Todos los Santos',           name_en: "All Saints' Day",         scope: 'national', kind: 'religious', verified: true },
  { date: '2025-12-06', name_local: 'Día de la Constitución',     name_en: 'Constitution Day',        scope: 'national', kind: 'civic',     verified: true },
  { date: '2025-12-08', name_local: 'Inmaculada Concepción',      name_en: 'Immaculate Conception',   scope: 'national', kind: 'religious', verified: true },
  { date: '2025-12-25', name_local: 'Navidad',                    name_en: 'Christmas Day',           scope: 'national', kind: 'religious', verified: true },

  // ---- 2026 ----
  { date: '2026-01-01', name_local: 'Año Nuevo',                  name_en: "New Year's Day",          scope: 'national', kind: 'civic',     verified: true },
  { date: '2026-01-06', name_local: 'Epifanía del Señor',         name_en: 'Epiphany (Reyes)',        scope: 'national', kind: 'religious', verified: true },
  { date: '2026-03-02', name_local: 'Dia de les Illes Balears',   name_en: 'Balearic Islands Day',    scope: 'regional', kind: 'civic',     verified: true, notes: '1 Mar 2026 = Sunday → observed Mon 2' },
  { date: '2026-04-03', name_local: 'Viernes Santo',              name_en: 'Good Friday',             scope: 'national', kind: 'religious', verified: true },
  { date: '2026-04-06', name_local: 'Lunes de Pascua',            name_en: 'Easter Monday',           scope: 'regional', kind: 'religious', verified: true },
  { date: '2026-05-01', name_local: 'Día del Trabajo',            name_en: 'Labour Day',              scope: 'national', kind: 'civic',     verified: true },
  { date: '2026-07-25', name_local: 'Sant Jaume Apòstol',         name_en: 'St James (Patron Calvià)', scope: 'local',    kind: 'religious', verified: false, notes: 'Calvià patron — verify with Ayuntamiento' },
  { date: '2026-08-15', name_local: 'Asunción de la Virgen',      name_en: 'Assumption of Mary',      scope: 'national', kind: 'religious', verified: true },
  { date: '2026-09-12', name_local: 'Festa del Rei En Jaume',     name_en: 'King James I Festival',   scope: 'local',    kind: 'cultural',  verified: false, notes: 'Calvià municipal — verify with Ayuntamiento' },
  { date: '2026-10-12', name_local: 'Fiesta Nacional de España',  name_en: 'National Day',            scope: 'national', kind: 'civic',     verified: true },
  { date: '2026-11-02', name_local: 'Todos los Santos (lunes)',   name_en: "All Saints' (observed)",  scope: 'national', kind: 'religious', verified: true, notes: '1 Nov on Sunday → observed Mon 2' },
  { date: '2026-12-07', name_local: 'Constitución (lunes)',       name_en: 'Constitution (observed)', scope: 'national', kind: 'civic',     verified: true, notes: '6 Dec on Sunday → observed Mon 7' },
  { date: '2026-12-08', name_local: 'Inmaculada Concepción',      name_en: 'Immaculate Conception',   scope: 'national', kind: 'religious', verified: true },
  { date: '2026-12-25', name_local: 'Navidad',                    name_en: 'Christmas Day',           scope: 'national', kind: 'religious', verified: true },
];

// =============================================================================
// LAO PDR — LUANG PRABANG (The Namkhan · property_id 260955)
// =============================================================================
// Verify each year via Ministry of Labour & Social Welfare (MoLSW) circular.
// Buddhist holidays follow the lunar calendar — dates shift year to year.

export const LA_NAMKHAN_HOLIDAYS: Holiday[] = [
  // ---- 2025 ----
  { date: '2025-01-01', name_local: 'ປີໃໝ່ສາກົນ',            name_en: 'International New Year',   scope: 'national', kind: 'civic',     verified: true },
  { date: '2025-03-08', name_local: 'ວັນແມ່ຍິງສາກົນ',          name_en: "International Women's Day", scope: 'national', kind: 'civic',    verified: true },
  { date: '2025-04-14', name_local: 'ປີໃໝ່ລາວ (ມື້ທີ 1)',     name_en: 'Lao New Year — day 1',     scope: 'national', kind: 'cultural',  verified: true },
  { date: '2025-04-15', name_local: 'ປີໃໝ່ລາວ (ມື້ທີ 2)',     name_en: 'Lao New Year — day 2',     scope: 'national', kind: 'cultural',  verified: true },
  { date: '2025-04-16', name_local: 'ປີໃໝ່ລາວ (ມື້ທີ 3)',     name_en: 'Lao New Year — day 3',     scope: 'national', kind: 'cultural',  verified: true },
  { date: '2025-05-01', name_local: 'ວັນກຳມະກອນສາກົນ',       name_en: 'Labour Day',               scope: 'national', kind: 'civic',     verified: true },
  { date: '2025-10-07', name_local: 'ບຸນອອກພັນສາ',           name_en: 'Boun Awk Phansa',          scope: 'national', kind: 'religious', verified: false, notes: 'Lunar — verify MoLSW circular' },
  { date: '2025-12-02', name_local: 'ວັນຊາດລາວ',             name_en: 'Lao National Day',         scope: 'national', kind: 'civic',     verified: true },

  // ---- 2026 ----
  { date: '2026-01-01', name_local: 'ປີໃໝ່ສາກົນ',            name_en: 'International New Year',   scope: 'national', kind: 'civic',     verified: true },
  { date: '2026-03-08', name_local: 'ວັນແມ່ຍິງສາກົນ',          name_en: "International Women's Day", scope: 'national', kind: 'civic',    verified: true },
  { date: '2026-04-14', name_local: 'ປີໃໝ່ລາວ (ມື້ທີ 1)',     name_en: 'Lao New Year — day 1',     scope: 'national', kind: 'cultural',  verified: true },
  { date: '2026-04-15', name_local: 'ປີໃໝ່ລາວ (ມື້ທີ 2)',     name_en: 'Lao New Year — day 2',     scope: 'national', kind: 'cultural',  verified: true },
  { date: '2026-04-16', name_local: 'ປີໃໝ່ລາວ (ມື້ທີ 3)',     name_en: 'Lao New Year — day 3',     scope: 'national', kind: 'cultural',  verified: true },
  { date: '2026-05-01', name_local: 'ວັນກຳມະກອນສາກົນ',       name_en: 'Labour Day',               scope: 'national', kind: 'civic',     verified: true },
  { date: '2026-10-26', name_local: 'ບຸນອອກພັນສາ',           name_en: 'Boun Awk Phansa',          scope: 'national', kind: 'religious', verified: false, notes: 'Lunar — verify MoLSW circular' },
  { date: '2026-12-02', name_local: 'ວັນຊາດລາວ',             name_en: 'Lao National Day',         scope: 'national', kind: 'civic',     verified: true },
];

// =============================================================================
// Property dispatcher
// =============================================================================

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID   = 1000001;

export function holidaysForProperty(propertyId: number): {
  rows: Holiday[];
  countryName: string;
  regionName: string | null;
  countryCode: string;
  flag: string;
} {
  if (propertyId === DONNA_PROPERTY_ID) {
    return {
      rows: ES_CALVIA_HOLIDAYS,
      countryName: 'Spain',
      regionName: 'Calvià · Balearic Islands',
      countryCode: 'ES',
      flag: '🇪🇸',
    };
  }
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return {
      rows: LA_NAMKHAN_HOLIDAYS,
      countryName: 'Laos',
      regionName: 'Luang Prabang',
      countryCode: 'LA',
      flag: '🇱🇦',
    };
  }
  return { rows: [], countryName: '', regionName: null, countryCode: '', flag: '' };
}
