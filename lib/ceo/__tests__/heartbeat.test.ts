// lib/ceo/__tests__/heartbeat.test.ts
// PBS 2026-08-26 · CEO heartbeat scoring. The component is presentational;
// everything that could be silently wrong lives here — index maths, the
// weighted composite with missing components, and the forward fill ratio.

import {
  performanceIndex,
  compositeScore,
  fillPct,
  deltaFromIndex,
  toComparison,
  SCORE_WEIGHTS,
} from '../heartbeat';

describe('performanceIndex', () => {
  it('returns 100 when this year matches last year', () => {
    expect(performanceIndex(500, 500)).toBe(100);
  });

  it('indexes Namkhan RevPAR against SDLY', () => {
    // 69.57 / 42.40 = 1.6408 -> 164
    expect(performanceIndex(69.57, 42.40)).toBe(164);
  });

  it('indexes Donna RevPAR against SDLY', () => {
    // 308.56 / 261.26 = 1.1810 -> 118
    expect(performanceIndex(308.56, 261.26)).toBe(118);
  });

  it('returns a sub-100 index when behind last year', () => {
    expect(performanceIndex(80, 100)).toBe(80);
  });

  it('returns null when there is no last-year baseline', () => {
    // A zero or absent denominator must not become Infinity or 0 — both would
    // read as a real score. Null keeps the slot dormant.
    expect(performanceIndex(500, 0)).toBeNull();
    expect(performanceIndex(500, null)).toBeNull();
    expect(performanceIndex(500, undefined)).toBeNull();
    expect(performanceIndex(500, -10)).toBeNull();
  });

  it('returns null when this year is absent', () => {
    expect(performanceIndex(null, 100)).toBeNull();
  });

  it('handles a genuine zero this year as index 0, not null', () => {
    // Sold nothing is a real result, not missing data.
    expect(performanceIndex(0, 100)).toBe(0);
  });
});

describe('compositeScore', () => {
  it('weights RevPAR 60 / total revenue 40 — the Namkhan case', () => {
    // 164*0.6 + 152*0.4 = 98.4 + 60.8 = 159.2 -> 159
    expect(compositeScore([
      { index: 164, weight: SCORE_WEIGHTS.revpar },
      { index: 152, weight: SCORE_WEIGHTS.totalRevenue },
    ])).toBe(159);
  });

  it('returns the Donna composite when both components agree', () => {
    expect(compositeScore([
      { index: 118, weight: 0.6 },
      { index: 118, weight: 0.4 },
    ])).toBe(118);
  });

  it('renormalises the weights when a component is missing', () => {
    // Only RevPAR available -> the score IS the RevPAR index, not 164*0.6.
    expect(compositeScore([
      { index: 164, weight: 0.6 },
      { index: null, weight: 0.4 },
    ])).toBe(164);
  });

  it('renormalises correctly across three uneven components', () => {
    // 120*0.5 + 80*0.2 = 60 + 16 = 76 over weight 0.7 -> 108.57 -> 109
    expect(compositeScore([
      { index: 120, weight: 0.5 },
      { index: 80,  weight: 0.2 },
      { index: null, weight: 0.3 },
    ])).toBe(109);
  });

  it('returns null when every component is missing', () => {
    expect(compositeScore([
      { index: null, weight: 0.6 },
      { index: null, weight: 0.4 },
    ])).toBeNull();
  });

  it('returns null for an empty component list', () => {
    expect(compositeScore([])).toBeNull();
  });

  it('ignores components with zero weight rather than dividing by zero', () => {
    expect(compositeScore([
      { index: 150, weight: 1 },
      { index: 50,  weight: 0 },
    ])).toBe(150);
  });
});

describe('fillPct', () => {
  it('reports how much of last year is already on the books', () => {
    // Namkhan September: 84 room nights against 152 final last year
    expect(fillPct(84, 152)).toBe(55);
    // Donna September: 1129 against 1387
    expect(fillPct(1129, 1387)).toBe(81);
  });

  it('returns null when last year has no baseline', () => {
    expect(fillPct(84, 0)).toBeNull();
    expect(fillPct(84, null)).toBeNull();
  });

  it('can exceed 100 when this year is already ahead of last year total', () => {
    expect(fillPct(200, 100)).toBe(200);
  });
});

describe('deltaFromIndex', () => {
  it('converts an index into a signed percentage movement', () => {
    expect(deltaFromIndex(164)).toEqual({ value: 64, direction: 'up' });
    expect(deltaFromIndex(80)).toEqual({ value: -20, direction: 'down' });
  });

  it('treats a near-par index as flat', () => {
    // Within half a point either way is noise, matching CeoEntry's pctDelta.
    expect(deltaFromIndex(100).direction).toBe('flat');
    expect(deltaFromIndex(100.4).direction).toBe('flat');
  });

  it('returns null for a missing index', () => {
    expect(deltaFromIndex(null)).toBeNull();
  });
});

describe('toComparison', () => {
  it('builds a live comparison line from an index', () => {
    expect(toComparison('vs SDLY', 164)).toEqual({
      label: 'vs SDLY', value: 64, format: 'percent', direction: 'up',
      isGoodWhenUp: true, status: 'live',
    });
  });

  it('builds a dormant line when the index is missing', () => {
    // status 'pending' makes KpiTile render an italic dash and keep the row —
    // this is the "leave blank, light up on upload" behaviour (design_system §3.1).
    expect(toComparison('vs Budget', null)).toEqual({
      label: 'vs Budget', value: 0, format: 'percent',
      isGoodWhenUp: true, status: 'pending',
    });
  });
});
