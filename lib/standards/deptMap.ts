// SLH section -> Namkhan department. Ordered longest-prefix-first so
// "In Room Dining - Delivery" is matched before "In Room Dining".
//
// Pool deck ownership is SHARED (ADR-314, PBS 2026-09-10): housekeeping owns
// deck cleanliness and furniture, F&B owns guest service on the deck. It was
// originally filed under grounds, which left the service half unassigned.

type Dept = { dept_code: string; dept_code_2: string | null };

// RULES must be ordered most-specific-first, NOT alphabetically or by department.
// SLH section names are hyphenated ("In Room Dining - Telephone Ordering",
// "Spa - Arrival", "Spa - Departure"), so a generic front_office rule
// (telephone|arrival|departure|...) will match words that appear in the second
// half of a dining/spa section name. Before this fix, front_office outranked
// spa and dining, which misfiled 26 of 338 real requirements:
//   "In Room Dining - Telephone Ordering" -> matched /telephone/ -> front_office (15 rows)
//   "Spa - Arrival"                       -> matched /arrival/   -> front_office (7 rows)
//   "Spa - Departure"                     -> matched /departure/ -> front_office (4 rows)
// Keeping pool/spa/dining/housekeeping ahead of front_office (and the broad
// public-areas/brand catch-alls last) ensures the specific department wins.
// The order is load-bearing — changing it breaks section routing.
const RULES: Array<[RegExp, Dept]> = [
  [/^pool|beach/i,                 { dept_code: 'housekeeping',  dept_code_2: 'roots_service' }],
  [/spa/i,                         { dept_code: 'spa',           dept_code_2: null }],
  [/breakfast|bar|lounge|in ?room dining|dining|restaurant/i,
                                   { dept_code: 'roots_service', dept_code_2: 'kitchen' }],
  [/bedroom|bathroom|stayover|turndown|housekeeping/i,
                                   { dept_code: 'housekeeping',  dept_code_2: null }],
  [/telephone|check ?in|check ?out|rooming|departure|arrival|request|concierge|booking/i,
                                   { dept_code: 'front_office',  dept_code_2: null }],
  [/public areas|fitness/i,        { dept_code: 'maintenance',   dept_code_2: 'housekeeping' }],
  [/slh brand|differentiator|loyalty|service recovery|sustainab/i,
                                   { dept_code: 'gm',            dept_code_2: null }],
];

export function deptForSection(section: string): Dept {
  const s = (section || '').trim();
  for (const [re, dept] of RULES) if (re.test(s)) return { ...dept };
  return { dept_code: 'admin_general', dept_code_2: null };
}

// ---------------------------------------------------------------------------
// Prose-source vocabulary -> Namkhan department.
//
// The SLH inspection above is a guest-journey audit: it never sees a kitchen,
// a linen store, a chemical store or a switchboard, so ten of the sixteen
// live departments (kitchen, housekeeping, grounds, maintenance, security,
// hr, purchasing, boat, activities, finance, sales_marketing) get zero (or
// near-zero) requirements from it alone. The four prose standards (GSTC,
// ASEAN Green Hotel, Travelife, ...) speak a back-of-house vocabulary
// instead, and this table is what routes that vocabulary onto the
// departments SLH cannot reach. Rules match on word STEMS (not exact
// phrases) against `${hint} ${sectionText}` lowercased, so realistic
// real-world phrasing ("occupational health and safety", "energy efficiency
// of equipment", "local employment", "guest amenities refill") lands on a
// real department instead of falling through to admin_general.
//
// PROSE_RULES must be ordered most-specific-first, same discipline as RULES
// above, for the same reason: Plan A's final review found the *original*
// SLH ordering had misfiled 26 real database rows because a broad
// front_office rule outranked the narrower spa/dining rules it happened to
// share substrings with. This table has two concrete instances of that same
// hazard, both resolved by ORDER (not by narrowing the stem list, since the
// brief requires the broad stems below):
//   1. "pool plant" (grounds — pool filtration/irrigation plant) vs bare
//      "plant" (maintenance — general plant/equipment). grounds is checked
//      BEFORE maintenance, so "landscaping, irrigation, pool plant" resolves
//      to grounds before maintenance's bare /plant/ ever gets a look.
//   2. "food safet(y)" (kitchen) vs the broader safety-adjacent vocabulary in
//      security ("fire safet") and hr ("occupational health"). kitchen is
//      checked first, ahead of security/hr, so any food-safety phrasing
//      lands on kitchen rather than a generic safety department.
// housekeeping is also deliberately checked early (right after kitchen) so
// its "cleaning product" stem is never shadowed by maintenance's broader
// bare "chemical" stem further down the list.
//
// 2026-09-10 widening (real-AI-output fix): a real atomiser run against a
// real standard showed 40% of hints falling through to admin_general — not
// because the vocabulary was missing, but because the model emits COMPOUND
// hints ("sustainability management", "engineering facilities") while the
// rules only matched narrower literals ("sustainability polic",
// "legal complian"). The fix is bare stems on maintenance/gm/front_office,
// which makes the ordering discipline even more load-bearing: every
// department-specific rule (kitchen through spa) MUST stay ahead of the
// broad gm and front_office rules, which are now the two LAST entries
// before the admin_general fallback. Three more hazards, resolved by ORDER:
//   3. bare "polic" (gm) vs "child protect(ion)" (hr): "child protection
//      policy" must stay hr. hr is checked long before gm, so it wins.
//   4. bare "complian"/"sustainab" (gm) vs "food safet" (kitchen): kitchen
//      is checked first (rule #1 in this table), so "food safety" can never
//      fall into gm even though neither of its words is safety-specific
//      vocabulary shared with gm's stems.
//   5. "guest relation"/"guest service" (front_office, new) vs "amenit"
//      (housekeeping): "guest amenities refill" must stay housekeeping.
//      housekeeping is checked long before front_office, so it wins — the
//      new front_office stems are narrow phrases ("guest relation", "guest
//      service", "front desk", ...), never a bare "guest", specifically so
//      they cannot shadow housekeeping's guest-facing stems.
// Do not reorder without re-checking every case below.
const PROSE_RULES: Array<[RegExp, Dept]> = [
  [/haccp|food safet|food hygien|food storage|pest control|cold chain|kitchen/i,
                                   { dept_code: 'kitchen',      dept_code_2: null }],
  [/guest room clean|housekeep|cleaning product|linen|towel|laundr|amenit/i,
                                   { dept_code: 'housekeeping', dept_code_2: null }],
  [/fire safet|fire drill|emergency|evacuat|first aid|security/i,
                                   { dept_code: 'security',     dept_code_2: null }],
  [/occupational health|staff welfare|wage|working hour|child protect|discriminat|harassment|competenc|labour|labor|training|employ/i,
                                   { dept_code: 'hr',           dept_code_2: null }],
  [/supplier|procure|purchas|local sourcing|supply chain/i,
                                   { dept_code: 'purchasing',   dept_code_2: null }],
  // "pool plant" MUST stay here, ahead of maintenance's bare /plant/ below —
  // see hazard #1 in the comment above.
  [/pool plant|landscap|irrigation|garden|waste segregat|recycl|compost|biodivers/i,
                                   { dept_code: 'grounds',      dept_code_2: null }],
  [/engineering|facilit|technical service|utilit|hvac|plumb|electric|energy|water consum|wastewater|effluent|chemical|boiler|equipment maint|air condition|refrigerant|plant/i,
                                   { dept_code: 'maintenance',  dept_code_2: null }],
  [/restaurant|beverage|menu|dining/i,
                                   { dept_code: 'roots_service',dept_code_2: null }],
  [/spa|wellness|treatment room/i,
                                   { dept_code: 'spa',          dept_code_2: null }],
  // Broad catch-alls. MUST be the last two entries before admin_general —
  // see hazards #3-#5 above for why every specific rule sits ahead of these.
  [/guest relation|guest service|reception|reservation|front desk|concierge/i,
                                   { dept_code: 'front_office', dept_code_2: null }],
  [/community|donation|stakeholder|governance|management system|reporting|monitoring|guest communication|sustainab|complian|polic/i,
                                   { dept_code: 'gm',           dept_code_2: null }],
];

export function deptForProseHint(hint: string | null, sectionText: string): Dept {
  const s = `${hint ?? ''} ${sectionText ?? ''}`.trim();
  for (const [re, dept] of PROSE_RULES) if (re.test(s)) return { ...dept };
  return { dept_code: 'admin_general', dept_code_2: null };
}

export function categoryForSection(section: string): string {
  const s = (section || '').toLowerCase();
  if (/sustainab/.test(s)) return 'sustainability';
  if (/slh brand|differentiator/.test(s)) return 'brand';
  // /survey/ must be checked BEFORE /clean/, because "Bedroom Survey" matches both.
  // Reordering these would cause "Bedroom Survey" to return 'cleanliness' instead of 'product'.
  if (/survey/.test(s)) return 'product';          // SLH "Survey" blocks score the physical product
  if (/clean|housekeep|bathroom|bedroom/.test(s)) return 'cleanliness';
  return 'service';
}
