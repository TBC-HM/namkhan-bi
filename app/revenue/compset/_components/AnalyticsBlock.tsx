// app/revenue/compset/_components/AnalyticsBlock.tsx
// Bottom-of-page analytics: data maturity banner + rate-plan landscape table +
// plan-gap cards + promo-behavior strip. All rows come from views — no hardcoded
// prose, only the PATTERN→ICON dict.

import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import RatePlanLandscapeTable from './RatePlanLandscapeTable';
import {
  MATURITY_STAGE_TONE,
  PROMO_PATTERN_COLORS,
  PROMO_PATTERN_ICONS,
} from './types';
import type {
  DataMaturityRow,
  PromoBehaviorRow,
  PromoTileRow,
  RatePlanGapRow,
  RatePlanLandscapeRow,
} from './types';

interface Props {
  maturity: DataMaturityRow | null;
  landscape: RatePlanLandscapeRow[];
  gaps: RatePlanGapRow[];
  promo: PromoBehaviorRow[];
  tiles?: PromoTileRow[];
}

export default function AnalyticsBlock({
  maturity,
  landscape,
  gaps,
  promo,
  tiles,
}: Props) {
  return (
    <section style={{ marginTop: 32 }}>
      {/* Section header */}
      <div
        style={{
          paddingTop: 24,
          borderTop: '2px solid var(--brass-soft)',
          marginBottom: 14,
        }}
      >
        <div className="t-eyebrow">PAGE-WIDE ANALYTICS</div>
        <h2
          style={{
            margin: '8px 0 4px',
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'var(--t-2xl)',
            letterSpacing: 'var(--ls-tight)',
          }}
        >
          Comp set <em style={{ color: 'var(--brass)' }}>analytics</em>
        </h2>
        <div
          style={{
            color: 'var(--ink-soft)',
            fontSize: 'var(--t-sm)',
            marginTop: 2,
          }}
        >
          Cross-property views. Charts populate as scrape data accumulates.
        </div>
      </div>

      {/* Maturity banner */}
      <MaturityBanner maturity={maturity} />

      {/* TILES — promo + latest price per comp (TOP per user request 2026-05-04) */}
      <div
        style={{
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
          padding: '20px 22px',
          marginTop: 18,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div className="t-eyebrow">COMP TILES — LATEST PRICE × PROMO</div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              fontWeight: 500,
              marginTop: 6,
            }}
          >
            One tile per hotel
          </div>
          <div
            style={{
              color: 'var(--ink-soft)',
              fontSize: 'var(--t-sm)',
              marginTop: 2,
            }}
          >
            Latest BDC rate · room scraped · promo frequency · discount pattern.
          </div>
        </div>
        <PromoTilesGrid tiles={tiles ?? []} />
      </div>

      {/* Rate plan landscape */}
      <div
        style={{
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
          padding: '20px 22px',
          marginTop: 18,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div className="t-eyebrow">RATE PLAN LANDSCAPE</div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              fontWeight: 500,
              marginTop: 6,
            }}
          >
            Which plans does the comp set offer
          </div>
          <div
            style={{
              color: 'var(--ink-soft)',
              fontSize: 'var(--t-sm)',
              marginTop: 2,
            }}
          >
            Where Namkhan is competitive vs. has gaps.
          </div>
        </div>
        <RatePlanLandscapeTable rows={landscape} />
      </div>

      {/* Plan gaps */}
      <div
        style={{
          background: 'var(--paper-warm)',
          border: '1px solid var(--paper-deep)',
          borderRadius: 8,
          padding: '20px 22px',
          marginTop: 18,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div className="t-eyebrow">RATE PLAN GAPS</div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              fontWeight: 500,
              marginTop: 6,
            }}
          >
            Easy wins, ranked
          </div>
          <div
            style={{
              color: 'var(--ink-soft)',
              fontSize: 'var(--t-sm)',
              marginTop: 2,
            }}
          >
            Plan types ≥1 comp offers that you don't.
          </div>
        </div>
        <PlanGapCards gaps={gaps} />
      </div>
    </section>
  );
}

// Tile per hotel: latest BDC price + promo frequency + pattern
function PromoTilesGrid({ tiles }: { tiles: PromoTileRow[] }) {
  if (tiles.length === 0) {
    return (
      <div style={emptyStyle}>
        No tiles yet — agent has not scraped any comp.
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}
    >
      {tiles.map((t) => {
        const icon = PROMO_PATTERN_ICONS[t.pattern ?? ''] ?? '·';
        const color = PROMO_PATTERN_COLORS[t.pattern ?? ''] ?? 'var(--ink-mute)';
        const freq = t.promo_frequency_pct != null ? Number(t.promo_frequency_pct) : 0;
        return (
          <div
            key={t.comp_id}
            style={{
              background: t.is_self ? 'var(--brass-soft)' : 'var(--paper)',
              border: '1px solid var(--paper-deep)',
              borderLeft: `3px solid ${color}`,
              borderRadius: 4,
              padding: '14px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color, fontSize: 'var(--t-base)', lineHeight: 1 }}>{icon}</span>
              <span style={{ fontWeight: 600, fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
                {t.is_self ? '★ ' : ''}{t.property_name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
              <span
                style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 'var(--t-2xl)',
                  fontWeight: 500,
                  color: 'var(--ink)',
                }}
              >
                {fmtTableUsd(t.latest_rate_usd)}
              </span>
              <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)' }}>
                last shop {t.last_shop_date ? fmtIsoDate(t.last_shop_date) : EMPTY}
              </span>
            </div>
            {t.latest_room && (
              <div
                style={{
                  marginTop: 4,
                  color: 'var(--ink-mute)',
                  fontSize: 'var(--t-xs)',
                  fontFamily: 'var(--mono)',
                  letterSpacing: 'var(--ls-loose)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={t.latest_room}
              >
                {t.latest_room.toUpperCase()}
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                letterSpacing: 'var(--ls-loose)',
                textTransform: 'uppercase',
              }}
            >
              {t.pattern_label ?? 'No data'}
            </div>
            <div
              style={{
                marginTop: 8,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 6,
                fontSize: 'var(--t-xs)',
                fontFamily: 'var(--mono)',
              }}
            >
              <div>
                <div style={{ color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase' }}>FREQ</div>
                <div style={{ fontSize: 'var(--t-base)', fontWeight: 600, color: freq >= 50 ? 'var(--st-bad)' : freq >= 20 ? 'var(--brass)' : 'var(--ink)' }}>
                  {freq.toFixed(0)}%
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-mute)', letterSpacing: 'var(--ls-loose)', textTransform: 'uppercase' }}>AVG DISC</div>
                <div style={{ fontSize: 'var(--t-base)', fontWeight: 600 }}>
                  {t.avg_discount_pct != null ? `${Number(t.avg_discount_pct).toFixed(1)}%` : EMPTY}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MaturityBanner({ maturity }: { maturity: DataMaturityRow | null }) {
  if (!maturity) {
    return (
      <div style={bannerStyle}>
        <StatusPill tone="inactive">UNKNOWN</StatusPill>
        <span>Maturity view not yet readable.</span>
      </div>
    );
  }
  const meta = MATURITY_STAGE_TONE[maturity.maturity_stage] ?? {
    tone: 'inactive' as const,
    label: maturity.maturity_stage.toUpperCase(),
  };
  return (
    <div style={bannerStyle}>
      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      <span style={{ flex: 1 }}>{maturity.status_message}</span>
      <span
        style={{
          color: 'var(--ink-mute)',
          fontSize: 'var(--t-xs)',
          fontFamily: 'var(--mono)',
          letterSpacing: 'var(--ls-loose)',
          textTransform: 'uppercase',
        }}
      >
        {maturity.total_observations} obs · {maturity.distinct_shop_days} days
      </span>
    </div>
  );
}

function PlanGapCards({ gaps }: { gaps: RatePlanGapRow[] }) {
  if (gaps.length === 0) {
    return (
      <div style={emptyStyle}>
        No gaps detected — agent has not run yet, or every comp plan is also
        offered by Namkhan.
      </div>
    );
  }
  // Already sorted by easy_win_score DESC at query time.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}
    >
      {gaps.map((g, i) => {
        const isWin = i < 3;
        const easyScore = g.easy_win_score != null ? Number(g.easy_win_score) : null;
        return (
          <div
            key={g.taxonomy_code}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--paper-deep)',
              borderLeft: isWin
                ? '3px solid var(--brass)'
                : '1px solid var(--paper-deep)',
              borderRadius: 4,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--t-md)' }}>
                  {g.plan_name}
                </div>
                {g.category && (
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      color: 'var(--ink-mute)',
                      letterSpacing: 'var(--ls-loose)',
                      textTransform: 'uppercase',
                      marginTop: 2,
                    }}
                  >
                    {g.category}
                  </div>
                )}
              </div>
              {isWin && <StatusPill tone="pending">EASY WIN</StatusPill>}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-soft)',
                fontFamily: 'var(--mono)',
              }}
            >
              <div>
                <div
                  style={{
                    color: 'var(--ink-mute)',
                    letterSpacing: 'var(--ls-loose)',
                    textTransform: 'uppercase',
                  }}
                >
                  COVERAGE
                </div>
                <div style={{ fontSize: 'var(--t-base)', fontWeight: 600 }}>
                  {g.comp_coverage_pct != null
                    ? `${Number(g.comp_coverage_pct).toFixed(0)}%`
                    : EMPTY}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: 'var(--ink-mute)',
                    letterSpacing: 'var(--ls-loose)',
                    textTransform: 'uppercase',
                  }}
                >
                  AVG DISC
                </div>
                <div style={{ fontSize: 'var(--t-base)', fontWeight: 600 }}>
                  {g.avg_discount != null
                    ? `${Number(g.avg_discount).toFixed(1)}%`
                    : EMPTY}
                </div>
              </div>
            </div>
            {easyScore != null && (
              <div
                style={{
                  marginTop: 10,
                  height: 4,
                  background: 'var(--paper-deep)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, easyScore)}%`,
                    background: 'var(--brass)',
                  }}
                />
              </div>
            )}
            {g.comps_offering_list && g.comps_offering_list.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 'var(--t-xs)',
                  color: 'var(--ink-mute)',
                }}
              >
                {g.comps_offering_list.slice(0, 3).join(' · ')}
                {g.comps_offering_list.length > 3 &&
                  ` · +${g.comps_offering_list.length - 3} more`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PromoBehaviorStrip({ promo }: { promo: PromoBehaviorRow[] }) {
  const filtered = promo.filter((p) => p.pattern !== 'no_data');
  if (filtered.length === 0) {
    return (
      <div style={emptyStyle}>
        No promo behavior detected yet — agent has not run, or no comps are
        promoting.
      </div>
    );
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 10,
      }}
    >
      {filtered.map((p) => {
        const icon = PROMO_PATTERN_ICONS[p.pattern] ?? '·';
        const color = PROMO_PATTERN_COLORS[p.pattern] ?? 'var(--ink-mute)';
        return (
          <div
            key={p.comp_id}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--paper-deep)',
              borderLeft: `3px solid ${color}`,
              borderRadius: 4,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span style={{ color, fontSize: 'var(--t-lg)', lineHeight: 1 }}>
                {icon}
              </span>
              <span style={{ fontWeight: 600, fontSize: 'var(--t-md)' }}>
                {p.is_self ? '★ ' : ''}
                {p.property_name}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                letterSpacing: 'var(--ls-loose)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {p.pattern_label}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontSize: 'var(--t-xs)',
                fontFamily: 'var(--mono)',
                color: 'var(--ink-soft)',
              }}
            >
              <div>
                <div
                  style={{
                    color: 'var(--ink-mute)',
                    letterSpacing: 'var(--ls-loose)',
                    textTransform: 'uppercase',
                  }}
                >
                  FREQ
                </div>
                <div style={{ fontSize: 'var(--t-base)', fontWeight: 600 }}>
                  {p.promo_frequency_pct != null
                    ? `${Number(p.promo_frequency_pct).toFixed(0)}%`
                    : EMPTY}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: 'var(--ink-mute)',
                    letterSpacing: 'var(--ls-loose)',
                    textTransform: 'uppercase',
                  }}
                >
                  AVG DISC
                </div>
                <div style={{ fontSize: 'var(--t-base)', fontWeight: 600 }}>
                  {p.avg_discount_pct != null
                    ? `${Number(p.avg_discount_pct).toFixed(1)}%`
                    : EMPTY}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const bannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderLeft: '3px solid var(--brass)',
  borderRadius: 4,
  fontSize: 'var(--t-sm)',
  color: 'var(--ink-soft)',
  flexWrap: 'wrap',
};

const emptyStyle: React.CSSProperties = {
  padding: '20px 16px',
  border: '1px dashed var(--paper-deep)',
  borderRadius: 4,
  textAlign: 'center',
  color: 'var(--ink-mute)',
  fontSize: 'var(--t-sm)',
};

// Suppress unused: fmtTableUsd kept available for downstream tweaks
void fmtTableUsd;
