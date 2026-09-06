// lib/cb-report-table.ts
// Flattens a Cloudbeds stock-report snapshot into columns + rows.
//
// PBS 2026-09-06: the CSV download produced a header line and nothing else for 13 of the
// 35 reports — including every headline revenue one (74 Daily Revenue, 96 Pace, 101
// Occupancy by Room Type, 102 YOY, 110 Rooms Sold/ADR/RevPAR). Both the download and the
// preview route had independently assumed `records` is column-oriented
// (`records[columnName] = [v1, v2, ...]`). That is only true for one of the three shapes
// Cloudbeds actually returns.
//
//   1. LIST     headers: ["user", "is_void", ...]                 (array of strings)
//               records: { "user": ["System", ...], ... }         column-oriented
//
//   2. GROUPED  headers: [["occupancy","aggregated"], ...]        (array of arrays)
//               records: { "06-08": { "occupancy": { "aggregated": 23.3 } } }
//               i.e. records[...rowKeys][...headerPath] = scalar
//
//   3. EMPTY    headers: []  records: {}                          nothing came back
//
// Shape 2 nests by row key first, so indexing it by column name yields undefined, the
// row count computes as 0, and the export silently loses every row. Row-nesting depth
// varies with the report's `group_rows` (1 for report 96, 2 for report 74), and header
// depth varies with `periods` (2 normally, 3 for YOY reports) — so both are measured
// rather than assumed.
//
// Shared by app/api/admin/reports/download and .../preview so the CSV and the on-screen
// preview can never disagree about what a snapshot contains.

export type SnapshotShape = 'list' | 'grouped' | 'empty';

export interface FlatTable {
  columns: string[];
  rows: string[][];
  shape: SnapshotShape;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Nesting depth of plain objects along the first branch: {a:{b:1}} -> 2. */
function objectDepth(v: unknown): number {
  let depth = 0;
  let cur: unknown = v;
  while (isPlainObject(cur)) {
    const keys = Object.keys(cur);
    if (keys.length === 0) break;
    depth += 1;
    cur = cur[keys[0]];
  }
  return depth;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

/**
 * Postgres `jsonb` does not preserve object key order — it sorts keys by length then
 * bytewise — so Cloudbeds' original row order is already lost by the time a snapshot is
 * read back ("Jan, Feb, Mar" comes back "Apr, Aug, Dec"). CB's ordered `index` array is
 * not stored on the public view, so rows are re-sorted here instead: month names in
 * calendar order, anything else naturally. Deterministic either way.
 */
function compareRowKeys(a: string[], b: string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? '', y = b[i] ?? '';
    if (x === y) continue;
    const mx = MONTHS.indexOf(x.trim().slice(0, 3).toLowerCase());
    const my = MONTHS.indexOf(y.trim().slice(0, 3).toLowerCase());
    if (mx !== -1 && my !== -1) return mx - my;
    return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
  }
  return 0;
}

export function flattenSnapshot(rawHeaders: unknown, rawRecords: unknown): FlatTable {
  const headers = Array.isArray(rawHeaders) ? rawHeaders : [];
  const records = isPlainObject(rawRecords) ? rawRecords : {};

  const labelled = headers.map((h) => (Array.isArray(h) ? h.map(String).join(' · ') : String(h)));

  if (headers.length === 0 || Object.keys(records).length === 0) {
    return { columns: labelled, rows: [], shape: 'empty' };
  }

  // ── Shape 1: list ─────────────────────────────────────────────────────────
  if (!Array.isArray(headers[0])) {
    const columns = headers.map((h) => String(h));
    let rowCount = 0;
    for (const c of columns) {
      const col = records[c];
      if (Array.isArray(col)) rowCount = Math.max(rowCount, col.length);
    }
    const rows: string[][] = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push(columns.map((c) => {
        const col = records[c];
        return Array.isArray(col) ? cell(col[i]) : '';
      }));
    }
    return { columns, rows, shape: 'list' };
  }

  // ── Shape 2: grouped ──────────────────────────────────────────────────────
  const headerPaths = headers.map((h) => (Array.isArray(h) ? h.map(String) : [String(h)]));
  const headerDepth = headerPaths.reduce((m, p) => Math.max(m, p.length), 1);
  const rowDepth = Math.max(1, objectDepth(records) - headerDepth);

  const rowKeys: string[][] = [];
  const walk = (node: unknown, path: string[]) => {
    if (path.length === rowDepth) { rowKeys.push(path); return; }
    if (!isPlainObject(node)) return;
    for (const k of Object.keys(node)) walk(node[k], [...path, k]);
  };
  walk(records, []);
  rowKeys.sort(compareRowKeys);

  // CB's group_rows carry real column names, but they live in the raw payload which the
  // public snapshot view does not expose — hence positional labels.
  const groupCols = rowDepth === 1
    ? ['Group']
    : Array.from({ length: rowDepth }, (_, i) => `Group ${i + 1}`);

  const rows = rowKeys.map((rk) => {
    const values = headerPaths.map((hp) => {
      let cur: unknown = records;
      for (const key of [...rk, ...hp]) {
        if (!isPlainObject(cur)) return '';
        cur = cur[key];
      }
      return cell(cur);
    });
    return [...rk, ...values];
  });

  return { columns: [...groupCols, ...labelled], rows, shape: 'grouped' };
}
