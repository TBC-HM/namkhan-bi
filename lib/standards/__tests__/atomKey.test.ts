import { atomKeyFor } from '../atomKey';

describe('atomKeyFor', () => {
  it('is stable for the same department and requirement', () => {
    expect(atomKeyFor('housekeeping', 'The bed was turned down.'))
      .toBe(atomKeyFor('housekeeping', 'The bed was turned down.'));
  });

  it('ignores case, punctuation and whitespace so near-duplicates merge', () => {
    expect(atomKeyFor('housekeeping', 'The bed was turned down.'))
      .toBe(atomKeyFor('housekeeping', '  the   bed was turned down  '));
  });

  it('does NOT merge the same requirement across different departments', () => {
    // "Refills were proactively offered" is a real requirement in BOTH breakfast
    // and bar service. They are separate SOPs owned by the same department here,
    // but the key must still be department-scoped so a future split is possible.
    expect(atomKeyFor('roots_service', 'Refills of beverages were proactively offered.'))
      .not.toBe(atomKeyFor('front_office', 'Refills of beverages were proactively offered.'));
  });

  it('does not merge genuinely different requirements', () => {
    expect(atomKeyFor('housekeeping', 'The bed was turned down.'))
      .not.toBe(atomKeyFor('housekeeping', 'Curtains or blinds were drawn.'));
  });

  it('produces a key short enough to index and free of whitespace', () => {
    const k = atomKeyFor('housekeeping', 'x'.repeat(500));
    expect(k.length).toBeLessThanOrEqual(120);
    expect(k).not.toMatch(/\s/);
  });
});
