// lib/outlets/__tests__/departments.test.ts
// PBS 2026-08-26 · Per-department capture bands.
// One shared threshold across seven outlets is the trap here: F&B captures 68%
// and spa 15%, both healthy for what they are. Banding them identically would
// paint five of seven pages permanently red and train managers to ignore colour.

import { DEPARTMENTS, deptSpec, captureTone, type DeptKey } from '../departments';

describe('DEPARTMENTS', () => {
  it('covers every page in the department sub-strip', () => {
    expect(Object.keys(DEPARTMENTS).sort()).toEqual(
      ['activities', 'fb', 'other', 'retail', 'rooms', 'spa', 'transport'],
    );
  });

  it('gives every department a manager-facing verb rather than a metric name', () => {
    for (const d of Object.values(DEPARTMENTS)) {
      expect(d.verb.length).toBeGreaterThan(0);
      expect(d.verb).not.toMatch(/capture|kpi|usali/i);
    }
  });

  it('keeps each good threshold above its fair threshold', () => {
    for (const d of Object.values(DEPARTMENTS)) expect(d.good).toBeGreaterThan(d.fair);
  });

  it('falls back to Other for an unknown key rather than throwing', () => {
    expect(deptSpec('nonsense' as DeptKey).key).toBe('other');
  });
});

describe('captureTone', () => {
  it('bands F&B on hospitality norms', () => {
    expect(captureTone('fb', 80)).toBe('green');
    expect(captureTone('fb', 68)).toBe('amber');
    expect(captureTone('fb', 40)).toBe('red');
  });

  it('does not punish spa for being structurally low', () => {
    // 15% spa capture is normal. Under F&B's bands it would read red.
    expect(captureTone('spa', 15)).toBe('amber');
    expect(captureTone('spa', 30)).toBe('green');
    expect(captureTone('fb', 15)).toBe('red');
  });

  it('holds Rooms to a near-total standard', () => {
    // A reservation with no room revenue is a comp, a staff stay or an error.
    expect(captureTone('rooms', 90)).toBe('amber');
    expect(captureTone('rooms', 96)).toBe('green');
  });

  it('bands retail lowest of all — a shop sale is rare', () => {
    expect(captureTone('retail', 10)).toBe('amber');
    expect(captureTone('retail', 4)).toBe('red');
  });

  it('greys out a missing percentage instead of calling it zero', () => {
    expect(captureTone('spa', null)).toBe('grey');
  });
});
