// lib/studio/xlsxBuild.ts
// Spreadsheet Studio — shared stamped-xlsx builder (brief module-spreadsheet-studio-v1).
// Used by the interactive export route AND the scheduled-exports cron so both
// paths produce byte-identical workbook structure: TBC header, Data sheet,
// Source Log sheet, footer stamp (source view · generated-at · data-as-of, A3).

import * as XLSX from 'xlsx';
import { shapeRows, columnOrder } from '@/lib/studio/engine';
import type { StudioRow, StudioTemplateDefinition } from '@/lib/studio/types';

export interface StudioWorkbookMeta {
  title: string;
  propertyId: number | null;
}

export interface StudioWorkbookResult {
  buf: Buffer;
  generatedAt: string;
  dataAsOf: string;
  sourceView: string;
  rowCount: number;
  safeName: string;
}

export function propertyLabelFor(propertyId: number | null): string {
  return propertyId === 260955 ? 'The Namkhan' : propertyId === 1000001 ? 'Donna Portals' : 'Holding';
}

export function findDataAsOf(rows: StudioRow[]): string | null {
  // Best-effort freshness: max value of common date/timestamp columns.
  const candidates = ['updated_at', 'data_timestamp', 'night_date', 'stay_date', 'date', 'month', 'day'];
  let best: string | null = null;
  for (const row of rows) {
    for (const c of candidates) {
      const v = row[c];
      if (typeof v === 'string' && v.length >= 7) {
        if (best === null || v > best) best = v;
      }
    }
  }
  return best;
}

export function buildStudioWorkbook(
  def: StudioTemplateDefinition,
  rawRows: StudioRow[],
  meta: StudioWorkbookMeta,
): StudioWorkbookResult {
  const rows = shapeRows(rawRows, def);
  const cols = columnOrder(rows);
  const generatedAt = new Date().toISOString();
  const dataAsOf = findDataAsOf(rawRows) ?? generatedAt;
  const sourceView = `${def.schema}.${def.view}`;
  const propertyLabel = propertyLabelFor(meta.propertyId);

  // ── data sheet: TBC header block + column headers + rows + footer stamp
  const aoa: unknown[][] = [
    ['The Beyond Circle — Spreadsheet Studio'],
    [meta.title, propertyLabel],
    [],
    cols,
    ...rows.map((r) => cols.map((c) => (r[c] === undefined ? null : (r[c] as unknown)))),
    [],
    ['Source view', sourceView],
    ['Generated at', generatedAt],
    ['Data as of', dataAsOf],
    ['Rows', rows.length],
    ['Canon note', 'Values are platform-computed from gold views (read-only). Reproduce by opening the named source view.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => ({ wch: Math.min(Math.max(c.length + 2, 12), 40) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');

  // ── source log sheet (workbook standards §9.7)
  const logSheet = XLSX.utils.aoa_to_sheet([
    ['Field', 'Value'],
    ['Title', meta.title],
    ['Property', propertyLabel],
    ['Source view', sourceView],
    ['Columns', def.columns.length ? def.columns.join(', ') : 'all'],
    ['Filters', JSON.stringify(def.filters)],
    ['Group by', def.groupBy.join(', ') || '—'],
    ['Aggregations', def.aggregations.map((a) => `${a.fn}(${a.col})`).join(', ') || '—'],
    ['Computed columns', def.computed.map((c) => `${c.name} = ${c.expr}`).join('; ') || '—'],
    ['Generated at', generatedAt],
    ['Data as of', dataAsOf],
  ]);
  logSheet['!cols'] = [{ wch: 20 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, logSheet, 'Source Log');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const safeName =
    meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'studio-export';

  return { buf, generatedAt, dataAsOf, sourceView, rowCount: rows.length, safeName };
}
