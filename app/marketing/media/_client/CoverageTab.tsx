// app/marketing/media/_client/CoverageTab.tsx
// PBS 2026-07-13 · Task B — "Coverage matrix" sub-tab for PhotoHub.
// Live photo counts per (category × usage_tier) sourced from
// public.v_media_coverage_matrix. 4 sections stacked: Room types, Facilities,
// Activities, Property areas.
// PBS 2026-07-14 · dynamic + clickable — every cell with n>0 opens a modal
// listing the matching photos as thumbnails, filtered by (scope × tier).
// Zero cells are muted #8B7355 and non-interactive. Totals also clickable
// (single-dimension filter). Data source: page.tsx uses dynamic='force-dynamic'
// + revalidate=0, so rows are fresh on every mount / tab switch.
'use client';

import { useMemo, useState, type CSSProperties } from 'react';

// Data contract from public.v_media_coverage_matrix
export interface CoverageRow {
  scope_label: string;
  scope_type: 'room_type' | 'facility' | 'activity' | 'area' | string;
  scope_key: string;
  property_id: number | null;
  primary_tier: string | null;
  n: number | string | null;
}

// Matches the shape passed from PhotoHub (subset of v_marketing_media_page rows)
interface MediaRowLite {
  asset_id: string;
  asset_type?: string | null;
  original_filename?: string | null;
  seo_target_filename?: string | null;
  public_url?: string | null;
  primary_tier?: string | null;
  property_area?: string | null;
  room_type_id?: number | null;
  mime_type?: string | null;
  master_path?: string | null;
}

interface Props {
  rows: CoverageRow[];
  mediaPage?: MediaRowLite[];
}

// Design tokens (Namkhan palette per claude_md v3.24 §0.55)
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const MUTED  = '#8B7355';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER_BG   = '#FDF7E6';
const FOREST_BG  = '#E4F1E0';

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

interface CellStyleT { background: string; color: string; fontWeight: number; }
function cellStyle(n: number): CellStyleT {
  if (n === 0)  return { background: AMBER_BG,  color: MUTED,  fontWeight: 500 };
  if (n <= 2)   return { background: CREAM,     color: INK,    fontWeight: 500 };
  return          { background: FOREST_BG, color: FOREST, fontWeight: 700 };
}

interface Section {
  key: string;
  label: string;
  hint: string;
  labels: string[];
  keys: Record<string, string>;
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
  const keys: Record<string, string> = {};
  for (const r of rows) {
    if (r.scope_type === scopeType) {
      labelSet.add(r.scope_label);
      if (r.scope_key) keys[r.scope_label] = r.scope_key;
    }
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

  return { key: scopeType, label, hint, labels, keys, matrix, rowTotals, colTotals, grandTotal: grand };
}

function isVideoRow(r: MediaRowLite): boolean {
  if ((r?.asset_type ?? '').toLowerCase() === 'video') return true;
  const mt = (r?.mime_type ?? '').toLowerCase();
  if (mt.startsWith('video/')) return true;
  const p = (r?.public_url ?? r?.master_path ?? '').toLowerCase();
  return /\.(mp4|mov|webm|m4v)(\?|$)/.test(p);
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function filterMedia(
  mediaPage: MediaRowLite[],
  scopeType: string,
  scopeLabel: string,
  scopeKey: string | undefined,
  tier: string | null,
): MediaRowLite[] {
  const target = normalize(scopeLabel);
  return mediaPage.filter(r => {
    if (isVideoRow(r)) return false;
    if (tier != null && (r.primary_tier ?? '') !== tier) return false;
    if (tier == null && !r.primary_tier) return false;
    if (scopeType === 'room_type') {
      const idMatch = scopeKey != null && r.room_type_id != null && String(r.room_type_id) === String(scopeKey);
      const areaMatch = normalize(r.property_area) === target;
      return idMatch || areaMatch;
    }
    return normalize(r.property_area) === target;
  });
}

function filterMediaRow(
  mediaPage: MediaRowLite[],
  scopeType: string,
  scopeLabel: string,
  scopeKey: string | undefined,
): MediaRowLite[] {
  const target = normalize(scopeLabel);
  return mediaPage.filter(r => {
    if (isVideoRow(r)) return false;
    if (!r.primary_tier) return false;
    if (scopeType === 'room_type') {
      const idMatch = scopeKey != null && r.room_type_id != null && String(r.room_type_id) === String(scopeKey);
      const areaMatch = normalize(r.property_area) === target;
      return idMatch || areaMatch;
    }
    return normalize(r.property_area) === target;
  });
}

function filterMediaCol(
  mediaPage: MediaRowLite[],
  section: Section,
  tier: string,
): MediaRowLite[] {
  const targets = new Set(section.labels.map(l => normalize(l)));
  const keys = new Set(section.labels.map(l => section.keys[l]).filter(Boolean));
  return mediaPage.filter(r => {
    if (isVideoRow(r)) return false;
    if ((r.primary_tier ?? '') !== tier) return false;
    if (section.key === 'room_type') {
      const idMatch = r.room_type_id != null && keys.has(String(r.room_type_id));
      const areaMatch = targets.has(normalize(r.property_area));
      return idMatch || areaMatch;
    }
    return targets.has(normalize(r.property_area));
  });
}

interface DrillState {
  title: string;
  items: MediaRowLite[];
}

export default function CoverageTab({ rows, mediaPage = [] }: Props) {
  const [drill, setDrill] = useState<DrillState | null>(null);

  const sections = useMemo(
    () => SECTIONS.map(s => buildSection(s.key, rows)),
    [rows],
  );

  const totalPhotos = useMemo(
    () => sections.reduce((acc, s) => acc + s.grandTotal, 0),
    [sections],
  );

  function openCell(section: Section, label: string, tier: string, n: number) {
    if (n <= 0) return;
    const items = filterMedia(mediaPage, section.key, label, section.keys[label], tier);
    setDrill({
      title: `${label} × ${TIER_LABELS[tier] ?? tier} — ${items.length} photo${items.length === 1 ? '' : 's'}`,
      items,
    });
  }

  function openRow(section: Section, label: string, total: number) {
    if (total <= 0) return;
    const items = filterMediaRow(mediaPage, section.key, label, section.keys[label]);
    setDrill({
      title: `${label} — all tiers — ${items.length} photo${items.length === 1 ? '' : 's'}`,
      items,
    });
  }

  function openCol(section: Section, tier: string, total: number) {
    if (total <= 0) return;
    const items = filterMediaCol(mediaPage, section, tier);
    setDrill({
      title: `${section.label} — ${TIER_LABELS[tier] ?? tier} — ${items.length} photo${items.length === 1 ? '' : 's'}`,
      items,
    });
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: INK, fontWeight: 600 }}>
          Live photo coverage &mdash; rows are categories, columns are usage tiers. 0 = gap, 3+ = solid coverage. Click any non-zero cell to see the matching photos.
        </div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>
          Photos considered: <strong>{totalPhotos.toLocaleString()}</strong> &nbsp;&middot;&nbsp;
          Source view: <code style={{ background: CREAM, padding: '1px 4px', borderRadius: 3 }}>public.v_media_coverage_matrix</code>
          &nbsp;&middot;&nbsp; fresh on every mount
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        marginBottom: 16, padding: '8px 12px',
        background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
        fontSize: 11, color: INK_M, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: INK }}>Key:</span>
        <LegendChip bg={AMBER_BG}  fg={MUTED}  label="0 — gap (not clickable)" />
        <LegendChip bg={CREAM}     fg={INK}    label="1-2 — thin (click to open)" />
        <LegendChip bg={FOREST_BG} fg={FOREST} label="3+ — solid (click to open)" />
      </div>

      {sections.map(sec => (
        <SectionTable
          key={sec.key}
          section={sec}
          onCellClick={openCell}
          onRowClick={openRow}
          onColClick={openCol}
        />
      ))}

      {drill && (
        <DrillModal
          title={drill.title}
          items={drill.items}
          onClose={() => setDrill(null)}
        />
      )}
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

function SectionTable({
  section,
  onCellClick,
  onRowClick,
  onColClick,
}: {
  section: Section;
  onCellClick: (section: Section, label: string, tier: string, n: number) => void;
  onRowClick:  (section: Section, label: string, total: number) => void;
  onColClick:  (section: Section, tier: string, total: number) => void;
}) {
  return (
    <div style={{
      marginBottom: 24, background: WHITE,
      border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden',
    }}>
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
                    return (
                      <CellDrill
                        key={t}
                        n={n}
                        onClick={() => onCellClick(section, lbl, t, n)}
                      />
                    );
                  })}
                  <TotalCellDrill
                    n={rowTotal}
                    onClick={() => onRowClick(section, lbl, rowTotal)}
                  />
                </tr>
              );
            })}
            {section.labels.length > 0 && (
              <tr>
                <td style={footCellLeft}>Total</td>
                {TIERS.map(t => {
                  const cn = section.colTotals[t];
                  return (
                    <FootCellDrill
                      key={t}
                      n={cn}
                      onClick={() => onColClick(section, t, cn)}
                    />
                  );
                })}
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

function CellDrill({ n, onClick }: { n: number; onClick: () => void }) {
  const st = cellStyle(n);
  const clickable = n > 0;
  return (
    <td style={{
      ...bodyCell,
      background: st.background,
      color: st.color,
      fontWeight: st.fontWeight,
      padding: 0,
    }}>
      {clickable ? (
        <button
          type="button"
          onClick={onClick}
          className="cov-cell-btn"
          style={{
            display: 'block', width: '100%', height: '100%',
            padding: '6px 10px',
            background: 'transparent', border: 'none',
            color: st.color, fontWeight: st.fontWeight,
            fontSize: 11, textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {n.toLocaleString()}
        </button>
      ) : (
        <span style={{
          display: 'block', padding: '6px 10px',
          color: MUTED, cursor: 'default',
        }}>{n.toLocaleString()}</span>
      )}
    </td>
  );
}

function TotalCellDrill({ n, onClick }: { n: number; onClick: () => void }) {
  const clickable = n > 0;
  return (
    <td style={{
      ...bodyCellTotal,
      color: clickable ? INK : MUTED,
      fontWeight: 700,
      padding: 0,
    }}>
      {clickable ? (
        <button
          type="button"
          onClick={onClick}
          className="cov-cell-btn"
          style={{
            display: 'block', width: '100%', height: '100%',
            padding: '6px 10px',
            background: 'transparent', border: 'none',
            color: INK, fontWeight: 700,
            fontSize: 11, textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {n.toLocaleString()}
        </button>
      ) : (
        <span style={{
          display: 'block', padding: '6px 10px',
          color: MUTED, cursor: 'default',
        }}>{n.toLocaleString()}</span>
      )}
    </td>
  );
}

function FootCellDrill({ n, onClick }: { n: number; onClick: () => void }) {
  const clickable = n > 0;
  return (
    <td style={{
      ...footCell,
      color: clickable ? INK : MUTED,
      padding: 0,
    }}>
      {clickable ? (
        <button
          type="button"
          onClick={onClick}
          className="cov-cell-btn"
          style={{
            display: 'block', width: '100%', height: '100%',
            padding: '8px 10px',
            background: 'transparent', border: 'none',
            color: INK, fontWeight: 700,
            fontSize: 11, textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {n.toLocaleString()}
        </button>
      ) : (
        <span style={{
          display: 'block', padding: '8px 10px',
          color: MUTED, cursor: 'default',
        }}>{n.toLocaleString()}</span>
      )}
    </td>
  );
}

function DrillModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: MediaRowLite[];
  onClose: () => void;
}) {
  function displayName(r: MediaRowLite): string {
    const seo = (r.seo_target_filename ?? '').trim();
    if (seo) return seo;
    return (r.original_filename ?? '').trim() || r.asset_id.slice(0, 8);
  }
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(27, 27, 27, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6,
          width: '100%', maxWidth: 1120, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid ' + HAIR,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: WHITE,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: INK, letterSpacing: '0.02em' }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '4px 12px', fontSize: 11, letterSpacing: '0.06em',
              textTransform: 'uppercase', border: '1px solid ' + HAIR,
              background: WHITE, color: INK, borderRadius: 3, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
            }}
          >Close</button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1, background: WHITE }}>
          {items.length === 0 ? (
            <div style={{
              padding: 32, textAlign: 'center', fontSize: 12, color: INK_M,
            }}>
              No photos match this filter. The coverage view may include rows
              not currently loaded in the mediaPage window.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
            }}>
              {items.map(r => (
                <div
                  key={r.asset_id}
                  style={{
                    background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
                    overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '4 / 3', background: CREAM,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {r.public_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.public_url}
                        alt={r.original_filename ?? r.asset_id}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ fontSize: 10, color: INK_M }}>no preview</div>
                    )}
                  </div>
                  <div
                    title={r.original_filename ?? ''}
                    style={{
                      padding: '6px 8px', fontSize: 10, color: INK,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      borderTop: '1px solid ' + HAIR,
                    }}
                  >
                    {displayName(r)}
                  </div>
                  <div style={{
                    padding: '2px 8px 6px', fontSize: 9, color: INK_M,
                    display: 'flex', justifyContent: 'space-between', gap: 4,
                  }}>
                    <span>{r.property_area ?? '—'}</span>
                    <span>{r.primary_tier?.replace('tier_', '') ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .cov-cell-btn:hover { text-decoration: underline; }
        .cov-cell-btn:focus-visible { outline: 2px solid ${FOREST}; outline-offset: -2px; }
      `}</style>
    </div>
  );
}

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
