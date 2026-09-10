import { deptForSection, categoryForSection, deptForProseHint } from '../deptMap';

describe('deptForSection', () => {
  it.each([
    ['Telephone Enquiry',        'front_office'],
    ['Check in',                 'front_office'],
    ['Rooming',                  'front_office'],
    ['Check out',                'front_office'],
    ['Concierge',                'front_office'],
    ['Bedroom',                  'housekeeping'],
    ['Bathroom',                 'housekeeping'],
    ['Stayover Service',         'housekeeping'],
    ['Turndown Service',         'housekeeping'],
    ['Breakfast Service',        'roots_service'],
    ['Bar / Lounge Service',     'roots_service'],
    ['In Room Dining - Delivery','roots_service'],
    ['Full Service Dining',      'roots_service'],
    ['Spa - Treatment',          'spa'],
    ['Public Areas',             'maintenance'],
    ['SLH Brand',                'gm'],
    ['Loyalty',                  'gm'],
  ])('maps %s to %s', (section, dept) => {
    expect(deptForSection(section).dept_code).toBe(dept);
  });

  it('gives the pool deck shared ownership per ADR-314', () => {
    // Housekeeping owns deck cleanliness and furniture; F&B owns service on the deck.
    // A single owner would leave the service half of the 79.3% unassigned.
    const d = deptForSection('Pool / Beach - Facilities');
    expect(d.dept_code).toBe('housekeeping');
    expect(d.dept_code_2).toBe('roots_service');
  });

  it('never returns grounds for the pool deck', () => {
    // grounds was the original incorrect attribution, corrected by PBS 2026-09-10.
    expect(deptForSection('Pool / Beach').dept_code).not.toBe('grounds');
  });

  it('falls back to admin_general for an unknown section instead of throwing', () => {
    expect(deptForSection('Some Future SLH Section').dept_code).toBe('admin_general');
  });

  it('files "In Room Dining - Telephone Ordering" under roots_service, not front_office', () => {
    // Regression for the real misfile: /telephone/ used to outrank dining because
    // front_office was checked before the dining rule (15 rows misfiled).
    const d = deptForSection('In Room Dining - Telephone Ordering');
    expect(d.dept_code).toBe('roots_service');
    expect(d.dept_code).not.toBe('front_office');
  });

  it('files "Spa - Arrival" under spa, not front_office', () => {
    // Regression: /arrival/ used to outrank spa (7 rows misfiled).
    const d = deptForSection('Spa - Arrival');
    expect(d.dept_code).toBe('spa');
    expect(d.dept_code).not.toBe('front_office');
  });

  it('files "Spa - Departure" under spa, not front_office', () => {
    // Regression: /departure/ used to outrank spa (4 rows misfiled).
    const d = deptForSection('Spa - Departure');
    expect(d.dept_code).toBe('spa');
    expect(d.dept_code).not.toBe('front_office');
  });

  it('still files plain "Breakfast Service" under roots_service (regression guard)', () => {
    const d = deptForSection('Breakfast Service');
    expect(d.dept_code).toBe('roots_service');
  });

  it('still reaches front_office for "Check out" (proves the front_office rule is still reachable)', () => {
    const d = deptForSection('Check out');
    expect(d.dept_code).toBe('front_office');
  });

  it('only ever returns live dept codes', () => {
    const LIVE = new Set(['front_office','housekeeping','kitchen','roots_service','maintenance',
      'grounds','spa','activities','boat','security','finance','gm','hr','purchasing',
      'sales_marketing','admin_general']);
    for (const s of ['Bedroom','Loyalty','Spa - Facility','Pool / Beach','Nonsense']) {
      const d = deptForSection(s);
      expect(LIVE.has(d.dept_code)).toBe(true);
      if (d.dept_code_2) expect(LIVE.has(d.dept_code_2)).toBe(true);
    }
  });
});

describe('categoryForSection', () => {
  it('classifies a Survey subsection as product', () => {
    expect(categoryForSection('Bedroom Survey')).toBe('product');
  });
  it('classifies an attended subsection as service', () => {
    expect(categoryForSection('Breakfast Service')).toBe('service');
  });
  it('classifies sustainability separately', () => {
    expect(categoryForSection('Sustainability')).toBe('sustainability');
  });
  it('classifies SLH Brand as brand', () => {
    expect(categoryForSection('SLH Brand')).toBe('brand');
  });
});

describe('deptForProseHint — back of house', () => {
  it.each([
    ['food safety, HACCP, cold chain',            'kitchen'],
    ['kitchen hygiene and pest control',          'kitchen'],
    ['landscaping, irrigation, pool plant',       'grounds'],
    ['energy consumption and metering',           'maintenance'],
    ['water consumption and wastewater',          'maintenance'],
    ['chemical storage and handling',             'maintenance'],
    ['fire safety systems and drills',            'security'],
    ['staff welfare, wages, working hours',       'hr'],
    ['child protection policy',                   'hr'],
    ['training and competency records',           'hr'],
    ['supplier selection and local sourcing',     'purchasing'],
    ['waste segregation and recycling',           'grounds'],
    ['community engagement and donations',        'gm'],
    ['guest communication of sustainability',     'gm'],
  ])('maps %s to %s', (hint, dept) => {
    expect(deptForProseHint(hint, '').dept_code).toBe(dept);
  });

  it('falls back to admin_general only when genuinely unmappable', () => {
    expect(deptForProseHint('miscellaneous administrative matters', '').dept_code).toBe('admin_general');
  });

  it('uses the section text when the hint is null', () => {
    expect(deptForProseHint(null, 'Kitchen waste and food storage temperatures').dept_code).toBe('kitchen');
  });

  it('only ever returns live dept codes', () => {
    const LIVE = new Set(['front_office','housekeeping','kitchen','roots_service','maintenance',
      'grounds','spa','activities','boat','security','finance','gm','hr','purchasing',
      'sales_marketing','admin_general']);
    for (const h of ['HACCP','energy','child protection','nonsense xyz', null]) {
      expect(LIVE.has(deptForProseHint(h, '').dept_code)).toBe(true);
    }
  });

  // Reviewer-found gap (Critical finding): these five plausible real phrasings
  // used to misfile four of five into admin_general, and deptForProseHint never
  // returned housekeeping at all. Regression-guard each one explicitly.
  it('maps "occupational health and safety" to a real department, not admin_general', () => {
    expect(deptForProseHint('occupational health and safety', '').dept_code).not.toBe('admin_general');
  });

  it('maps "energy efficiency of equipment" to maintenance', () => {
    expect(deptForProseHint('energy efficiency of equipment', '').dept_code).toBe('maintenance');
  });

  it('maps "local employment" to hr', () => {
    expect(deptForProseHint('local employment', '').dept_code).toBe('hr');
  });

  it('maps "guest amenities refill" to housekeeping', () => {
    expect(deptForProseHint('guest amenities refill', '').dept_code).toBe('housekeeping');
  });

  it('deptForProseHint CAN return housekeeping (it used to never return it)', () => {
    const results = [
      deptForProseHint('fresh linen and towels', ''),
      deptForProseHint('laundry turnaround for guest rooms', ''),
      deptForProseHint('housekeeping cleaning product storage', ''),
    ].map((d) => d.dept_code);
    expect(results).toContain('housekeeping');
  });

  // One phrasing per department in the stem-mapping table (task brief), covering
  // every one of the ten previously-starved departments plus the two SLH already
  // reaches, to prove every stem group actually routes where the table says.
  it.each([
    ['HACCP audit and cold chain monitoring',        'kitchen'],
    ['fresh linen, towels and laundry turnaround',    'housekeeping'],
    ['energy efficiency of equipment',                'maintenance'],
    ['landscaping, irrigation and biodiversity',      'grounds'],
    ['fire safety drills and evacuation routes',      'security'],
    ['occupational health and safety',                'hr'],
    ['supplier procurement and local sourcing',       'purchasing'],
    ['community stakeholder engagement',              'gm'],
    ['restaurant beverage and dining menu',           'roots_service'],
    ['spa wellness treatment room',                   'spa'],
  ])('maps %s to %s', (hint, dept) => {
    expect(deptForProseHint(hint, '').dept_code).toBe(dept);
  });
});
