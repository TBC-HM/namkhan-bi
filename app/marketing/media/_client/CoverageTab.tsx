// app/marketing/media/_client/CoverageTab.tsx
// PBS 2026-07-30 · Merge OTA+Website into "Top Tier" · one flat table with section header rows.
'use client';

import { useMemo, useState, type CSSProperties } from 'react';

export interface CoverageRow {
  kind: string;
  sort_order: number;
  area_key: string;
  ref_id: string | null;
  scope_label: string;
  sort_key: string;
  primary_tier: string | null;
  n: number | string | null;
  property_id?: number | null;
  scope_type?: string | null;
  scope_key?: string | null;
}

export interface TaxRow {
  kind: string;
  area_key: string;
  name: string;
  photo_count: number | null;
  sort_key?: string | null;
}

interface Props {
  rows: CoverageRow[];
  mediaPage?: any[];
  areaTaxonomy?: TaxRow[];
}

const WHITE   = '#FFFFFF';
const HAIR    = '#E6DFCC';
const INK     = '#1B1B1B';
const INK_M   = '#5A5A5A';
const MUTED   = '#8B7355';
const FOREST  = '#084838';
const CREAM   = '#F5F0E1';
const AMBER_BG  = '#FDF7E6';
const FOREST_BG = '#E4F1E0';

// OTA + Website are the same — merged into top_tier
const TIERS = ['top_tier', 'tier_social_pool', 'tier_internal', 'tier_archive', 'tier_logos'] as const;
type Tier = typeof TIERS[number];

const TIER_LABELS: Record<string, string> = {
  top_tier:         'Top Tier',
  tier_social_pool: 'Social',
  tier_internal:    'Internal',
  tier_archive:     'Archive',
  tier_logos:       'Logos',
};

const KIND_LABEL: Record<string, string> = {
  rooms:         'Accommodation',
  facilities:    'Facilities',
  jungle_spa:    'Jungle Spa',
  fnb:           'F&B',
  activities:    'Activities',
  retreats:      'Retreats',
  transport:     'Transport',
  imekong:       'Imekong',
  certifications:'Certifications',
  destination:   'Destination',
};
const KIND_ORDER = ['rooms','facilities','jungle_spa','fnb','activities','retreats','transport','imekong','certifications','destination'];

function cellStyle(n: number): CSSProperties {
  if (n === 0) return { background: AMBER_BG,  color: MUTED,  fontWeight: 500 };
  if (n <= 2)  return { background: CREAM,     color: INK,    fontWeight: 500 };
  return         { background: FOREST_BG, color: FOREST, fontWeight: 700 };
}

interface AreaRow {
  kind: string;
  area_key: string;
  name: string;
  matrix: Record<Tier, number>;
  total: number;
}

interface DrillItem {
  asset_id: string;
  original_filename?: string | null;
  seo_target_filename?: string | null;
  preview_url?: string | null;
  public_url?: string | null;
  quality_index?: number | null;
}

export default function CoverageTab({ rows, mediaPage: _mp = [], areaTaxonomy = [] }: Props) {
  void _mp;
  const [drillTitle, setDrillTitle] = useState<string | null>(null);
  const [drillItems, setDrillItems] = useState<DrillItem[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  async function openCell(kind: string, areaKey: string, rawTier: string, name: string, n: number) {
    if (n <= 0) return;
    const apiTier = rawTier === 'top_tier' ? 'tier_ota_profile' : rawTier;
    setDrillTitle(name + ' x ' + (TIER_LABELS[rawTier] ?? rawTier) + ' - ' + n + ' photo' + (n === 1 ? '' : 's'));
    setDrillItems([]);
    setDrillError(null);
    setDrillLoading(true);
    try {
      const u = '/api/marketing/media/coverage-drill?kind=' + encodeURIComponent(kind) + '&area_key=' + encodeURIComponent(areaKey) + '&tier=' + encodeURIComponent(apiTier);
      const r = await fetch(u, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? ('HTTP ' + r.status));
      setDrillItems(j.items ?? []);
    } catch (e) {
      setDrillError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrillLoading(false);
    }
  }
  function closeDrill() { setDrillTitle(null); setDrillItems([]); setDrillError(null); }

  const flatRows = useMemo<AreaRow[]>(() => {
    const byKindArea = new Map<string, Map<string, { name: string; sort_key: string; matrix: Record<Tier, number> }>>();
    for (const r of rows) {
      const k = r.kind;
      if (!KIND_LABEL[k]) continue;
      if (!byKindArea.has(k)) byKindArea.set(k, new Map());
      const areaMap = byKindArea.get(k)!;
      if (!areaMap.has(r.area_key)) {
        areaMap.set(r.area_key, {
          name: r.scope_label,
          sort_key: r.sort_key ?? r.scope_label ?? '',
          matrix: Object.fromEntries(TIERS.map(t => [t, 0])) as Record<Tier, number>,
        });
      }
      const entry = areaMap.get(r.area_key)!;
      const tier = r.primary_tier;
      if (!tier) continue;
      if (tier === 'tier_ota_profile' || tier === 'tier_website_hero') {
        entry.matrix['top_tier'] = (entry.matrix['top_tier'] ?? 0) + Number(r.n ?? 0);
      } else if (TIERS.includes(tier as Tier)) {
        entry.matrix[tier as Tier] = (entry.matrix[tier as Tier] ?? 0) + Number(r.n ?? 0);
      }
    }
    const out: AreaRow[] = [];
    for (const k of KIND_ORDER) {
      const areaMap = byKindArea.get(k);
      if (!areaMap || areaMap.size === 0) continue;
      const kindRows = Array.from(areaMap.entries())
        .map(([area_key, v]) => ({
          kind: k, area_key, name: v.name, matrix: v.matrix,
          total: Object.values(v.matrix).reduce((s, n) => s + n, 0),
        }))
        .sort((a, b) => (areaMap.get(a.area_key)?.sort_key ?? '').localeCompare(areaMap.get(b.area_key)?.sort_key ?? ''));
      out.push(...kindRows);
    }
    return out;
  }, [rows]);

  const colTotals = useMemo(() => {
    const t = Object.fromEntries(TIERS.map(k => [k, 0])) as Record<Tier, number>;
    for (const r of flatRows) for (const k of TIERS) t[k] += r.matrix[k] ?? 0;
    return t;
  }, [flatRows]);
  const grandTotal = Object.values(colTotals).reduce((s, n) => s + n, 0);

  const attention = useMemo(() => {
    const uncat = areaTaxonomy.find(r => r.kind === 'uncategorized');
    const otherRows = areaTaxonomy.filter(r => r.kind === 'other');
    const uncount = uncat?.photo_count ?? 0;
    const otherTotal = otherRows.reduce((s, r) => s + (r.photo_count ?? 0), 0);
    return { uncat, otherRows, uncount, otherTotal, backlogTotal: uncount + otherTotal };
  }, [areaTaxonomy]);

  const groupedRows = useMemo(() => {
    const result: Array<{ isHeader: boolean; kind?: string; label?: string; count?: number; row?: AreaRow }> = [];
    let lastKind = '';
    for (const r of flatRows) {
      if (r.kind !== lastKind) {
        const cnt = flatRows.filter(x => x.kind === r.kind).reduce((s, x) => s + x.total, 0);
        result.push({ isHeader: true, kind: r.kind, label: KIND_LABEL[r.kind], count: cnt });
        lastKind = r.kind;
      }
      result.push({ isHeader: false, row: r });
    }
    return result;
  }, [flatRows]);

  const NCOLS = TIERS.length + 2;

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: INK, fontWeight: 600 }}>
          Live photo coverage · Top Tier = OTA + Website · 0 = gap · 3+ = solid
        </div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 4 }}>
          {grandTotal.toLocaleString()} photos placed
        </div>
      </div>

      {(attention.backlogTotal > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
          <a href="/marketing/media?tab=clarify" style={{
            background: '#FBE8E4', border: '1px solid #E7A69A', borderRadius: 6, padding: '12px 14px',
            textDecoration: 'none', color: '#8A2419',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>To clarify</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{attention.backlogTotal.toLocaleString()}</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>photos need area + tier</div>
          </a>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14,
        padding: '8px 12px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
        fontSize: 11, color: INK_M, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 600, color: INK }}>Key:</span>
        <Chip bg={AMBER_BG}  fg={MUTED}  label="0 — gap" />
        <Chip bg={CREAM}     fg={INK}    label="1-2 — thin" />
        <Chip bg={FOREST_BG} fg={FOREST} label="3+ — solid" />
      </div>

      {flatRows.length > 0 && (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: CREAM }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: INK_M, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid ' + HAIR }}>
                  Folder
                </th>
                {TIERS.map(t => (
                  <th key={t} style={{ padding: '8px 10px', textAlign: 'right', color: t === 'top_tier' ? INK : INK_M, fontWeight: t === 'top_tier' ? 700 : 600, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR }}>
                    {TIER_LABELS[t]}
                  </th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', color: INK, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderBottom: '1px solid ' + HAIR, borderLeft: '2px solid ' + HAIR }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((item, idx) => {
                if (item.isHeader) {
                  return (
                    <tr key={'hdr-' + item.kind} style={{ background: '#F7F3EA' }}>
                      <td colSpan={NCOLS} style={{
                        padding: '5px 10px',
                        borderTop: idx > 0 ? '2px solid ' + HAIR : undefined,
                        borderBottom: '1px solid ' + HAIR,
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: INK_M,
                      }}>
                        {item.label} · {(item.count ?? 0).toLocaleString()} photos
                      </td>
                    </tr>
                  );
                }
                const r = item.row!;
                return (
                  <tr key={r.area_key}>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid ' + HAIR, color: INK }}>
                      <a href={'/marketing/media?tab=library&area=' + encodeURIComponent(r.area_key)} style={{ color: INK, textDecoration: 'none', fontWeight: 500 }}>
                        {r.name}
                      </a>
                    </td>
                    {TIERS.map(t => {
                      const n = r.matrix[t] ?? 0;
                      const s = cellStyle(n);
                      return (
                        <td key={t} style={{ padding: '4px 10px', textAlign: 'right', borderBottom: '1px solid ' + HAIR, borderLeft: '1px solid ' + HAIR, fontVariantNumeric: 'tabular-nums', ...s }}>
                          {n > 0 ? (
                            <button type="button"
                              onClick={() => openCell(r.kind, r.area_key, t, r.name, n)}
                              style={{ all: 'unset', color: s.color, cursor: 'pointer', width: '100%', textAlign: 'right', display: 'block' }}
                            >{n}</button>
                          ) : '·'}
                        </td>
                      );
                    })}
                    <td style={{ padding: '4px 10px', textAlign: 'right', borderBottom: '1px solid ' + HAIR, borderLeft: '2px solid ' + HAIR, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: INK }}>
                      {r.total > 0 ? r.total : '·'}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: CREAM }}>
                <td style={{ padding: '6px 10px', color: INK, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 10, borderTop: '2px solid ' + HAIR }}>
                  Grand total
                </td>
                {TIERS.map(t => (
                  <td key={t} style={{ padding: '6px 10px', textAlign: 'right', borderLeft: '1px solid ' + HAIR, borderTop: '2px solid ' + HAIR, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: INK }}>
                    {colTotals[t] > 0 ? colTotals[t] : '·'}
                  </td>
                ))}
                <td style={{ padding: '6px 10px', textAlign: 'right', borderLeft: '2px solid ' + HAIR, borderTop: '2px solid ' + HAIR, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: FOREST }}>
                  {grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {drillTitle && (
        <div onClick={closeDrill} style={{
          position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(27,27,27,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6,
            width: '100%', maxWidth: 1120, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + HAIR,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: WHITE }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{drillTitle}</div>
              <button type="button" onClick={closeDrill} style={{
                padding: '4px 12px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                border: '1px solid ' + HAIR, background: WHITE, color: INK, borderRadius: 3,
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>Close</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1, background: WHITE }}>
              {drillLoading && <div style={{ padding: 32, textAlign: 'center', color: INK_M, fontSize: 12 }}>Loading…</div>}
              {drillError && !drillLoading && <div style={{ padding: 16, color: '#B23A2E', fontSize: 12 }}>Error: {drillError}</div>}
              {!drillLoading && !drillError && drillItems.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: INK_M, fontSize: 12 }}>No photos returned.</div>
              )}
              {!drillLoading && drillItems.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                  {drillItems.map(r => (
                    <div key={r.asset_id} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ width: '100%', aspectRatio: '4 / 3', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {(r.preview_url || r.public_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.preview_url || r.public_url || ''} alt={r.original_filename ?? r.asset_id}
                               style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        ) : <div style={{ fontSize: 10, color: INK_M }}>no preview</div>}
                      </div>
                      <div style={{ padding: '6px 8px', fontSize: 10, color: INK, borderTop: '1px solid ' + HAIR }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.seo_target_filename || r.original_filename || r.asset_id.slice(0, 8)}
                        </div>
                        {r.quality_index != null && <div style={{ color: INK_M, marginTop: 2 }}>QA {Math.round(Number(r.quality_index))}%</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 12, height: 12, background: bg, border: '1px solid ' + HAIR, borderRadius: 2 }} />
      <span style={{ color: fg }}>{label}</span>
    </span>
  );
}
