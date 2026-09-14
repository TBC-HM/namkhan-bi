import { dischargeModeFor } from '../dischargeMode';

const slh = (text: string) => ({
  authority: 'SLH', sourceTitle: 'SLH Mystery Inspection 2026 - The Namkhan',
  category: 'service', text,
});

describe('SLH mystery inspection is always an observation', () => {
  it.each([
    'Your first impressions of the bathroom met expectations of a luxury experience.',
    'You were respectfully addressed by your name or title (sir/madam).',
    'Check/tab was presented and processed seamlessly.',
    'Welcome amenity was offered upon arrival (i.e. cold towel, beverage, local amenity).',
    'A towel and/or linen reuse program was implemented and followed by housekeeping staff.',
  ])('%s', (text) => {
    expect(dischargeModeFor(slh(text))).toBe('observation');
  });

  it('does NOT catch the SLH Minimum Standards Chart, which is not an inspection', () => {
    expect(dischargeModeFor({
      authority: 'SLH', sourceTitle: 'SLH Minimum Standards Chart',
      category: 'service', text: 'Rooms are serviced daily.',
    })).toBe('procedure');
  });
});

describe('sustainability-family authorities are evidence unless prohibitive', () => {
  const sus = (text: string, authority = 'GSTC') =>
    ({ authority, sourceTitle: 'GSTC Industry Criteria', category: 'sustainability', text });

  it.each([
    ['Land ownership and tenure rights are documented.', 'evidence'],
    ['Goals for reducing energy consumption are in place.', 'evidence'],
    ['Keep an up-to-date list of all legislation.', 'evidence'],
    ['Is your current Travelife certificate displayed?', 'evidence'],
  ])('%s -> %s', (text, mode) => {
    expect(dischargeModeFor(sus(text))).toBe(mode);
  });

  it('a prohibition is a rule even in a sustainability source', () => {
    expect(dischargeModeFor(sus('Shall not misuse the certificate or the certification logo.')))
      .toBe('rule');
  });
});

describe('procedure-shaped categories', () => {
  it.each([
    ['PM', 'Namkhan Preventive Maintenance Catalogue', 'compliance', 'AC filter clean (per room)'],
    ['Namkhan', 'Namkhan Service & Operations Standards', 'service_operations', 'Evening turndown service'],
    ['SLH', 'SLH Minimum Standards Chart', 'cleanliness', 'Bathroom surfaces disinfected daily'],
  ])('%s/%s -> procedure', (authority, sourceTitle, category, text) => {
    expect(dischargeModeFor({ authority, sourceTitle, category, text })).toBe('procedure');
  });
});

describe('house commercial standards split on prohibition', () => {
  const house = (text: string) => ({
    authority: 'Namkhan', sourceTitle: 'Namkhan House Operating Standards',
    category: 'commercial', text,
  });
  it('a prohibition is a rule', () => {
    expect(dischargeModeFor(house('The rate floor is Owner-only — the floor is never cut.')))
      .toBe('rule');
  });
  it('a cadence is a procedure', () => {
    expect(dischargeModeFor(house('Rate review runs weekly — Monday, 90 minutes maximum.')))
      .toBe('procedure');
  });
});

describe('unmatched defaults to procedure (asks the most, never silently excuses)', () => {
  it('falls through', () => {
    expect(dischargeModeFor({
      authority: 'Unknown', sourceTitle: 'Something new', category: null, text: 'A thing.',
    })).toBe('procedure');
  });
});
