// app/marketing/media/_client/CoverageTab.tsx
// PBS 2026-07-13 · Task B — "Coverage matrix" sub-tab for PhotoHub.
// Live photo counts per (category × usage_tier) sourced from
// public.v_media_coverage_matrix. 4 sections stacked: Room types, Facilities,
// Activities, Property areas. Rows are categories, columns are the 6 usage
// tiers + a Total, styled with amber/cream/forest bands per PBS spec.
// Pure read-only — pre-fetched on the server and handed down as `rows`.
'use client';

import { useMemo, type CSSProperties } from 'react';

// Data contract from public.v_media_coverage_matrix
export interface CoverageRow {
  scope_label: string;
  scope_type: 'room_type' | 'facility' | 'activity' | 'area' | string;
  scope_key: string;
  property_id: number | null;
  primary_tier: string | null;
  n: number | string | null;
}

interface Props {
  rows: CoverageRow[];
}

// Design tokens (Namkhan palette per claude_md v3.24 §0.55)
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER_BG   = '#FDF7E6';
const AMBER_INK  = '#8B6914';
const FOREST_BG  = '#E4F1E0';

// Canonical usage_tier order (marketing.usage_tier enum)
const TIERS: readonly string[] = [
  'tier_ota_profile',
  'tier_website_hero',
  'tier_social_pool',
  'tier_internal',
  'tier_archive',
  'tier_logos',
];

const TIER_LABELS: Record<string, string> = {
  tier_ota_profile:  'OTA profile',
  tier_website_hero: 'Website hero',
  tier_social_pool:  'Social pool',
  tier_internal:     'Internal',
  tier_archive:      'Archive',
  tier_logos:        'Logos',
};

const SECTIONS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'room_type', label: 'Room types',     hint: 'One row per PMS room type. Matches via room_type_id or property_area (case-insensitive).' },
  { key: 'facility',  label: 'Facilities',     hint: 'One row per active facility. Matches when property_area equals the facility name.' },
  { key: 'activity',  label: 'Activities',     hint: 'One row per active activity. Matches when property_area equals the activity name.' },
  { key: 'area',      label: 'Property areas', hint: 'Remaining distinct property_area values not covered by rooms / facilities / activities.' },
];

interface CellStyle {
  background: string;
  color: string;
  fontWeight: number;
}
function cellStyle(n: number): CellStyle {
  if (n === 0)  return { background: AMBER_BG,  color: AMBER_INK, fontWeight: 500 };
  if (n <= 2)   return { background: CREAM,     color: INK,       fontWeight: 500 };
  return          { background: FOREST_BG, color: FOREST,    fontWeight: 700 };
}

interface Section {
  key: string;
  label: string;
  hint: string;
  labels: string[];
  matrix: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  grandTotal: number;
}

function buildSection(scopeType: string, rows: CoverageRow[]): Section {
  const meta = SECTIONS.find(s => s.key === scopeType);
  const label = meta?.label ?? scopeType;
  const hint  = meta?.hint  ?? '';

  const labelSet = new Set<string>();
  for (const r of rows) {
    if (r.scope_type === scopeType) labelSet.add(r.scope_label);
  }
  const labels = Array.from(labelSet).sort((a, b) => a.localeCompare(b));

  const matrix: Record<string, Record<string, number>> = {};
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  for (const t of TIERS) colTotals[t] = 0;
  for (const l of labels) {
    matrix[l] = {};
    for (const t of TIERS) matrix[l][t] = 0;
    rowTotals[l] = 0;
  }

  let grand = 0;
  for (const r of rows) {
    if (r.scope_type !== scopeType) continue;
    const lbl = r.scope_label;
    const tier = r.primary_tier;
    const n = typeof r.n === 'string' ? Number(r.n) : (r.n ?? 0);
    if (!Number.isFinite(n) || n <= 0) continue;
    if (!tier || !TIERS.includes(tier)) continue;
    matrix[lbl][tier] += n;
    rowTotals[lbl] += n;
    colTotals[tier] += n;
    grand += n;
  }

  return { key: scopeType, label, hint, labels, matrix, rowTotals, colTotals, grandTotal: grand };
}

export default function CoverageTab({ rows }: Props) {
  const sections = useMemo(
    () => SECTIONS.map(s => buildSection(s.key, rows)),
    [rows],
  );

  const totalPhotos = useMemo(
    () => sections.reduce((acc, s) => acc + s.grandTotal, 0),
    [sections],
  );

  return (
    <div>
      {/* Header line */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: INK, fontWeight: 600 }}>
          Live photo coverage &mdash; rows are categories, columns are usage tiers. 0 = gap, 3+ = solid coverage.
        </div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>
          Photos considered: <strong>{totalPhotos.toLocaleString()}</strong> &nbsp;&middot;&nbsp;
          Source view: <code style={{ background: CREAM, padding: '1px 4px', borderRadius: 3 }}>public.v_media_coverage_matrix</code>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        marginBottom: 16, padding: '8px 12px',
        background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
        fontSize: 11, color: INK_M, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: INK }}>Key:</span>
        <LegendChip bg={AMBER_BG}  fg={AMBER_INK} label="0 — gap" />
        <LegendChip bg={CREAM}     fg={INK}       label="1–2 — thin" />
        <LegendChip bg={FOREST_BG} fg={FOREST}    label="3+ — solid" />
      </div>

      {/* One table per section, stacked */}
      {sections.map(sec => (
        <SectionTable key={sec.key} section={sec} />
      ))}
    </div>
  );
}

function LegendChip({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span style={{
      background: bg, color: fg, padding: '2px 8px', borderRadius: 3,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
    }}>{label}</span>
  );
}

function SectionTable({ section }: { section: Section }) {
  return (
    <div style={{
      marginBottom: 24, background: WHITE,
      border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden',
    }}>
      {/* Section header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid ' + HAIR,
        background: WHITE,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: FOREST, fontWeight: 700,
        }}>{section.label}</div>
        <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>
          {section.hint} &nbsp;&middot;&nbsp; {section.labels.length} row{section.labels.length === 1 ? '' : 's'} &nbsp;&middot;&nbsp; {section.grandTotal.toLocaleString()} photos
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 11, background: WHITE,
        }}>
          <thead style={{ position: 'sticky', top: 0, background: WHITE, zIndex: 1 }}>
            <tr>
              <th style={hdrCellLeft}>Category</th>
              {TIERS.map(t => (
                <th key={t} style={hdrCell}>{TIER_LABELS[t]}</th>
              ))}
              <th style={hdrCellTotal}>Total</th>
            </tr>
          </thead>
          <tbody>
            {section.labels.length === 0 && (
              <tr>
                <td colSpan={TIERS.length + 2} style={{
                  padding: 16, textAlign: 'center', color: INK_M,
                  borderTop: '1px solid ' + HAIR,
                }}>
                  No rows in this section yet.
                </td>
              </tr>
            )}
            {section.labels.map(lbl => {
              const rowTotal = section.rowTotals[lbl];
              return (
                <tr key={lbl}>
                  <td style={bodyCellLeft}>{lbl}</td>
                  {TIERS.map(t => {
                    const n = section.matrix[lbl][t];
                    const st = cellStyle(n);
                    return (
                      <td key={t} style={{ ...bodyCell, background: st.background, color: st.color, fontWeight: st.fontWeight }}>
                        {n.toLocaleString()}
                      </td>
                    );
                  })}
                  <td style={{ ...bodyCellTotal, color: rowTotal === 0 ? AMBER_INK : INK, fontWeight: 700 }}>
                    {rowTotal.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {/* Column totals */}
            {section.labels.length > 0 && (
              <tr>
                <td style={footCellLeft}>Total</td>
                {TIERS.map(t => (
                  <td key={t} style={{ ...footCell, color: section.colTotals[t] === 0 ? AMBER_INK : INK }}>
                    {section.colTotals[t].toLocaleString()}
                  </td>
                ))}
                <td style={{ ...footCell, color: FOREST, fontWeight: 700 }}>
                  {section.grandTotal.toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- shared cell styles ---
const hdrCellBase: CSSProperties = {
  padding: '8px 10px', fontSize: 10, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: INK_M, fontWeight: 600,
  borderBottom: '1px solid ' + HAIR, textAlign: 'right',
  whiteSpace: 'nowrap', background: WHITE,
};
const hdrCellLeft: CSSProperties = { ...hdrCellBase, textAlign: 'left' };
const hdrCell: CSSProperties = { ...hdrCellBase };
const hdrCellTotal: CSSProperties = { ...hdrCellBase, borderLeft: '1px solid ' + HAIR, color: INK };

const bodyCellBase: CSSProperties = {
  padding: '6px 10px', borderTop: '1px solid ' + HAIR,
  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
};
const bodyCellLeft: CSSProperties = {
  ...bodyCellBase, textAlign: 'left', color: INK, fontWeight: 500,
};
const bodyCell: CSSProperties = { ...bodyCellBase };
const bodyCellTotal: CSSProperties = {
  ...bodyCellBase, borderLeft: '1px solid ' + HAIR, background: WHITE,
};

const footCellBase: CSSProperties = {
  padding: '8px 10px', borderTop: '2px solid ' + HAIR,
  textAlign: 'right', fontVariantNumeric: 'tabular-nums',
  fontSize: 11, fontWeight: 700, background: WHITE,
};
const footCellLeft: CSSProperties = {
  ...footCellBase, textAlign: 'left', color: INK,
  fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
};
const footCell: CSSProperties = { ...footCellBase, color: INK };
