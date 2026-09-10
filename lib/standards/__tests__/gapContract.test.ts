// The gap payload is consumed by the Quality dashboard, which renders a missing
// key as "—" and would hide a real coverage hole. Pin the shape.
export interface GapSummary {
  property_id: number;
  total_atoms: number;
  covered: number;
  uncovered: number;
  by_dept: Array<{ dept_code: string; total: number; covered: number; uncovered: number }>;
}

export function assertGapSummary(p: any): asserts p is GapSummary {
  for (const k of ['property_id', 'total_atoms', 'covered', 'uncovered']) {
    if (typeof p?.[k] !== 'number') throw new Error(`gap payload missing numeric ${k}`);
  }
  if (!Array.isArray(p.by_dept)) throw new Error('gap payload missing by_dept array');
  if (p.covered + p.uncovered !== p.total_atoms) {
    throw new Error(`gap payload does not balance: ${p.covered}+${p.uncovered} != ${p.total_atoms}`);
  }
}

describe('gap payload contract', () => {
  it('accepts a well-formed payload', () => {
    expect(() => assertGapSummary({
      property_id: 260955, total_atoms: 10, covered: 4, uncovered: 6,
      by_dept: [{ dept_code: 'housekeeping', total: 10, covered: 4, uncovered: 6 }],
    })).not.toThrow();
  });

  it('rejects a payload whose totals do not balance', () => {
    expect(() => assertGapSummary({
      property_id: 260955, total_atoms: 10, covered: 4, uncovered: 1, by_dept: [],
    })).toThrow(/does not balance/);
  });

  it('rejects a payload with no by_dept array', () => {
    expect(() => assertGapSummary({
      property_id: 260955, total_atoms: 0, covered: 0, uncovered: 0,
    })).toThrow(/by_dept/);
  });
});
