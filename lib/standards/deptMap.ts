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
