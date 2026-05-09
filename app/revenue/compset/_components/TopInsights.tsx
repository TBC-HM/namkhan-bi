// app/revenue/compset/_components/TopInsights.tsx
//
// Top insights · multi-line rate trend across Namkhan + 5 comp properties.
// Mirrors the MyHotelHouse "My top insights" pattern PBS attached
// (Screenshot 2026-05-09) but in the Namkhan brand palette.
//
// Server component, no JS. Pure SVG so we follow the design rule: charts
// are server-rendered SVG, no chart library.
//
// Tabs Performance · Rates rendered as static markup. "Rates" is active;
// "Performance" is shown muted with a hover title flagging it as awaiting
// OCC / RevPAR data — once those views land, this tab can be wired live.

import type { PropertySummaryRow, CompetitorRateMatrixRow } from './types';

interface Props {
  propertyRows: PropertySummaryRow[];          // current selected-set rows incl. Namkhan
  rateMatrix: CompetitorRateMatrixRow[];        // raw matrix (full set)
  namkhanCompId: string;
}

// Namkhan brand palette (resolved hex — SVG attrs cannot read CSS vars).
// Update both here and styles/globals.css if the brand shifts.
const PALETTE = {
  namkhan:   '#1a2e21', // --moss
  comp1:     '#a8854a', // --brass
  comp2:     '#c4a06b', // --brass-soft
  comp3:     '#2b4936', // --moss-mid
  comp4:     '#6b9379', // --moss-glow / --st-good
  comp5:     '#7d7565', // --ink-mute
  axis:      '#b3a888', // --ink-faint
  grid:      '#d8cca8', // --line-soft
  ink:       '#1c1815', // --ink
  inkSoft:   '#4a443c', // --ink-soft
  inkMute:   '#7d7565', // --ink-mute
  paperWarm: '#f4ecd8', // --paper-warm
};

const COMP_COLORS = [
  PALETTE.comp1,
  PALETTE.comp2,
  PALETTE.comp3,
  PALETTE.comp4,
  PALETTE.comp5,
];

interface Series {
  comp_id: string;
  label: string;
  color: string;
  width: number;
  isSelf: boolean;
  // stay_date → latest rate_usd (most recent shop_date wins)
  byDate: Map<string, number>;
}

export default function TopInsights({ propertyRows, rateMatrix, namkhanCompId }: Props) {
  // ---- Pick series: Namkhan first, then up to 5 comps ranked by obs_count_30d ----
  const namkhan =
    propertyRows.find((p) => p.comp_id === namkhanCompId) ??
    propertyRows.find((p) => p.is_self) ??
    null;

  const comps = propertyRows
    .filter((p) => p.comp_id !== (namkhan?.comp_id ?? namkhanCompId) && !p.is_self)
    .sort((a, b) => (b.obs_count_30d ?? 0) - (a.obs_count_30d ?? 0))
    .slice(0, 5);

  // ---- Build per-series stay_date → latest rate_usd map (last 30 stay-dates) ----
  // Keep the most recent shop_date per (comp_id, stay_date).
  const latestByKey = new Map<string, { shop: string; rate: number }>();
  for (const r of rateMatrix) {
    if (r.rate_usd == null || !r.stay_date) continue;
    const key = `${r.comp_id}|${r.stay_date}`;
    const prev = latestByKey.get(key);
    const shop = r.shop_date ?? '';
    if (!prev || shop > prev.shop) {
      latestByKey.set(key, { shop, rate: Number(r.rate_usd) });
    }
  }

  // Distinct stay-dates with at least one rate; sorted ascending; keep last 30.
  const allDates = Array.from(
    new Set(
      rateMatrix
        .filter((r) => r.rate_usd != null && r.stay_date)
        .map((r) => r.stay_date),
    ),
  ).sort();
  const dates = allDates.slice(-30);

  if (dates.length === 0 || !namkhan) {
    return <Empty />;
  }

  const buildSeries = (
    comp_id: string,
    label: string,
    color: string,
    width: number,
    isSelf: boolean,
  ): Series => {
    const byDate = new Map<string, number>();
    for (const d of dates) {
      const v = latestByKey.get(`${comp_id}|${d}`);
      if (v) byDate.set(d, v.rate);
    }
    return { comp_id, label, color, width, isSelf, byDate };
  };

  const seriesList: Series[] = [
    buildSeries(namkhan.comp_id, namkhan.property_name, PALETTE.namkhan, 2.4, true),
    ...comps.map((c, i) =>
      buildSeries(c.comp_id, c.property_name, COMP_COLORS[i % COMP_COLORS.length], 1.6, false),
    ),
  ];

  // ---- Y axis range across all series ----
  const allRates: number[] = [];
  for (const s of seriesList) for (const v of s.byDate.values()) allRates.push(v);
  const minRaw = Math.min(...allRates);
  const maxRaw = Math.max(...allRates);
  // Pad 8% headroom; round to $5.
  const pad = Math.max(5, (maxRaw - minRaw) * 0.08);
  const yMin = Math.max(0, Math.floor((minRaw - pad) / 5) * 5);
  const yMax = Math.ceil((maxRaw + pad) / 5) * 5;
  const yRange = Math.max(1, yMax - yMin);

  // ---- Layout ----
  const W = 1100;
  const H = 320;
  const padL = 48;
  const padR = 24;
  const padT = 16;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xAt = (i: number) => padL + (dates.length === 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - ((v - yMin) / yRange) * innerH;

  // Y ticks: 5 evenly spaced.
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) yTicks.push(yMin + (yRange * i) / 4);

  // X ticks: 6 spread points (or fewer if dates < 6).
  const xTickIdx: number[] = [];
  const tickCount = Math.min(6, dates.length);
  for (let i = 0; i < tickCount; i++) {
    xTickIdx.push(Math.round((i / Math.max(1, tickCount - 1)) * (dates.length - 1)));
  }

  return (
    <div>
      {/* Header strip · tabs + hide-OTB note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              color: 'var(--ink-mute)',
            }}
          >
            View
          </span>
          <span
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 'var(--t-sm)',
              color: 'var(--ink-faint)',
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid var(--paper-deep)',
              cursor: 'not-allowed',
            }}
            title="Performance tab awaiting OCC + RevPAR view wiring"
          >
            Performance
          </span>
          <span
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 'var(--t-sm)',
              color: 'var(--paper-warm)',
              background: 'var(--brass)',
              padding: '4px 10px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Rates
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-mute)' }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
            }}
          >
            {dates[0]} → {dates[dates.length - 1]} · {dates.length}d
          </span>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid var(--paper-deep)',
              color: 'var(--ink-soft)',
            }}
            title="OTB hide toggle awaiting client-side wiring"
          >
            Hide OTB
          </span>
        </div>
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 320, display: 'block' }}
      >
        {/* Y grid + labels */}
        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              x1={padL}
              y1={yAt(t)}
              x2={W - padR}
              y2={yAt(t)}
              stroke={PALETTE.grid}
              strokeDasharray="2 3"
              strokeWidth={0.6}
            />
            <text
              x={padL - 6}
              y={yAt(t) + 3}
              textAnchor="end"
              style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: PALETTE.inkMute }}
            >
              ${Math.round(t)}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={padL}
          y1={padT + innerH}
          x2={W - padR}
          y2={padT + innerH}
          stroke={PALETTE.axis}
          strokeWidth={0.8}
        />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke={PALETTE.axis} strokeWidth={0.8} />

        {/* X labels */}
        {xTickIdx.map((idx, i) => (
          <text
            key={`x-${i}`}
            x={xAt(idx)}
            y={H - 14}
            textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: PALETTE.inkMute }}
          >
            {dates[idx]}
          </text>
        ))}

        {/* Series lines */}
        {seriesList.map((s) => {
          const segs: string[] = [];
          let cmd: 'M' | 'L' = 'M';
          dates.forEach((d, i) => {
            const v = s.byDate.get(d);
            if (v == null) {
              cmd = 'M'; // break the path on missing data
              return;
            }
            segs.push(`${cmd}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
            cmd = 'L';
          });
          return (
            <path
              key={`line-${s.comp_id}`}
              d={segs.join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={s.isSelf ? 1 : 0.95}
            >
              <title>
                {`${s.label}${s.isSelf ? ' · Namkhan' : ''} · ${s.byDate.size}/${dates.length} stay-dates · v_compset_competitor_rate_matrix`}
              </title>
            </path>
          );
        })}

        {/* Series dots — small accent on Namkhan + ends */}
        {seriesList.map((s) =>
          dates.map((d, i) => {
            const v = s.byDate.get(d);
            if (v == null) return null;
            const showAlways = s.isSelf;
            const showEnd = i === 0 || i === dates.length - 1;
            if (!showAlways && !showEnd) return null;
            return (
              <circle
                key={`dot-${s.comp_id}-${i}`}
                cx={xAt(i)}
                cy={yAt(v)}
                r={s.isSelf ? 2.4 : 2}
                fill={s.color}
              >
                <title>{`${s.label} · ${d} · $${v.toFixed(0)}`}</title>
              </circle>
            );
          }),
        )}
      </svg>

      {/* Legend */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 16px',
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
        }}
      >
        {seriesList.map((s) => (
          <span key={`leg-${s.comp_id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 0,
                borderTop: `${s.isSelf ? 3 : 2}px solid ${s.color}`,
              }}
            />
            <span style={{ color: s.isSelf ? 'var(--brass)' : 'var(--ink-soft)', fontWeight: s.isSelf ? 600 : 400 }}>
              {s.isSelf ? '★ ' : ''}
              {s.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div
      style={{
        height: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-faint)',
        fontStyle: 'italic',
        background: 'var(--paper-warm)',
        border: '1px dashed var(--paper-deep)',
        borderRadius: 8,
      }}
    >
      compset_rates · 0 rows in window · run the agent
    </div>
  );
}
