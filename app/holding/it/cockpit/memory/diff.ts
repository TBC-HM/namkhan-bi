// app/holding/it/cockpit/memory/diff.ts
// Minimal in-house line diff (brief module-doc-architecture-memory-v1 §0.R R2:
// DEPENDENCY LAW — no diff npm package; ~100 LOC LCS with prefix/suffix trim
// and a unique-line (patience-style) fallback for very large documents).

export type DiffOp = { type: 'same' | 'add' | 'del'; line: string };

const DP_CELL_CAP = 4_000_000; // max n*m for the exact LCS DP

function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  // DP table of LCS lengths (n+1 x m+1) using a flat Int32Array.
  const w = m + 1;
  const dp = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] =
        a[i] === b[j]
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', line: a[i] });
      i++; j++;
    } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
      out.push({ type: 'del', line: a[i] });
      i++;
    } else {
      out.push({ type: 'add', line: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', line: a[i++] });
  while (j < m) out.push({ type: 'add', line: b[j++] });
  return out;
}

// Patience-style fallback: anchor on lines unique in both sides, recurse
// between anchors. Keeps memory bounded for multi-thousand-line docs.
function bigDiff(a: string[], b: string[], depth: number): DiffOp[] {
  if (a.length === 0 && b.length === 0) return [];
  if (a.length * b.length <= DP_CELL_CAP || depth > 12) {
    if (a.length * b.length <= DP_CELL_CAP) return lcsDiff(a, b);
    // give up on minimality: plain replace block
    return [
      ...a.map((line): DiffOp => ({ type: 'del', line })),
      ...b.map((line): DiffOp => ({ type: 'add', line })),
    ];
  }
  const countA = new Map<string, number>();
  const countB = new Map<string, number>();
  for (const l of a) countA.set(l, (countA.get(l) ?? 0) + 1);
  for (const l of b) countB.set(l, (countB.get(l) ?? 0) + 1);
  const posB = new Map<string, number>();
  b.forEach((l, idx) => { if (countB.get(l) === 1) posB.set(l, idx); });
  // longest increasing run of unique-common anchors
  const anchors: Array<{ ai: number; bi: number }> = [];
  let lastB = -1;
  for (let ai = 0; ai < a.length; ai++) {
    const l = a[ai];
    if (countA.get(l) === 1 && posB.has(l)) {
      const bi = posB.get(l)!;
      if (bi > lastB) { anchors.push({ ai, bi }); lastB = bi; }
    }
  }
  if (anchors.length === 0) return bigDiff(a, b, 13); // forces plain replace
  const out: DiffOp[] = [];
  let pa = 0;
  let pb = 0;
  for (const { ai, bi } of anchors) {
    out.push(...bigDiff(a.slice(pa, ai), b.slice(pb, bi), depth + 1));
    out.push({ type: 'same', line: a[ai] });
    pa = ai + 1;
    pb = bi + 1;
  }
  out.push(...bigDiff(a.slice(pa), b.slice(pb), depth + 1));
  return out;
}

export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  // trim common prefix
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  // trim common suffix
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const head: DiffOp[] = a.slice(0, start).map((line) => ({ type: 'same', line }));
  const tail: DiffOp[] = a.slice(endA).map((line) => ({ type: 'same', line }));
  const mid = bigDiff(a.slice(start, endA), b.slice(start, endB), 0);
  return [...head, ...mid, ...tail];
}

export function diffStats(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const o of ops) {
    if (o.type === 'add') added++;
    else if (o.type === 'del') removed++;
  }
  return { added, removed };
}
