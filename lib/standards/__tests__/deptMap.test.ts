import { deptForSection, categoryForSection } from '../deptMap';

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
