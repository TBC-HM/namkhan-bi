// app/revenue/compset/_components/property-detail/DeepViewPanel.tsx
//
// Deep view of one selected competitor. v2 ordering (2026-05-04):
//   1. Header + back-to-set
//   2. Property + channel URLs (always populated)
//   3. SHOP SUMMARY  — what dates were shopped, when, what came back
//   4. RATE MATRIX   — the actual scrape results (the live data)
//   5. ROOM MAPPINGS / PLATFORM RANKINGS / RATE PLANS — labelled "Phase 2"
//      and only rendered if data exists. Otherwise hidden so the user doesn't
//      stare at four empty placeholder cards before reaching the real data.

'use client';

import PropertyDetailCard from './PropertyDetailCard';
import ChannelUrlsCard from './ChannelUrlsCard';
import RoomMappingsTable from './RoomMappingsTable';
import RankingsGrid from './RankingsGrid';
import RatePlansMatrixTable from './RatePlansMatrixTable';
import RatePlansLiveTable from './RatePlansLiveTable';
import RateMatrixCard from './RateMatrixCard';
import { fmtIsoDate, fmtTableUsd } from '@/lib/format';
import type { CompetitorDeepData, CompetitorRateMatrixRow } from '../types';

interface Props {
  propertyName: string;
  data: CompetitorDeepData;
  isSelf?: boolean;
  /** Namkhan's own rate matrix to overlay as a baseline (skipped when isSelf=true). */
  namkhanRateMatrix?: CompetitorRateMatrixRow[];
  namkhanLabel?: string;
  onClose: () => void;
}

const wrapStyle: React.CSSProperties = {
  marginTop: 18,
  padding: '24px 22px',
  background: 'var(--paper-deep)',
  border: '1px solid var(--paper-deep)',
  borderTop: '2px solid var(--brass)',
  borderRadius: '0 0 8px 8px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 20,
  flexWrap: 'wrap',
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  fontWeight: 600,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--serif)',
  fontStyle: 'italic',
  fontSize: 'var(--t-xl)',
  fontWeight: 500,
  marginTop: 4,
  color: 'var(--ink)',
};

const closeBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'var(--ink-soft)',
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  padding: '8px 14px',
  cursor: 'pointer',
};

const sectionEyebrowStyle: React.CSSProperties = {
  ...eyebrowStyle,
  display: 'block',
  marginBottom: 8,
};

const sectionWrapStyle: React.CSSProperties = {
  marginTop: 24,
};

const twoColGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 18,
};

const phase2BadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: 8,
  padding: '2px 6px',
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  fontWeight: 600,
};

const summaryCardStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  padding: '14px 18px',
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 16,
  alignItems: 'flex-start',
};

const summaryStatLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  marginBottom: 4,
  fontWeight: 600,
};

const summaryStatValueStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-md)',
  color: 'var(--ink)',
};

const datePillStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  background: 'var(--paper-deep)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  color: 'var(--ink)',
  marginRight: 6,
  marginBottom: 4,
};

interface ShopSummary {
  shopDates: string[];
  stayDates: string[];
  ratesCount: number;
  withPriceCount: number;
  channelsSeen: string[];
  cheapest: { rate: number; stay: string; channel: string } | null;
  mostExpensive: { rate: number; stay: string; channel: string } | null;
}

function summarise(rows: CompetitorRateMatrixRow[]): ShopSummary {
  const shopDates = new Set<string>();
  const stayDates = new Set<string>();
  const channels = new Set<string>();
  let withPrice = 0;
  let cheapest: ShopSummary['cheapest'] = null;
  let dearest: ShopSummary['mostExpensive'] = null;
  for (const r of rows) {
    if (r.shop_date) shopDates.add(r.shop_date);
    if (r.stay_date) stayDates.add(r.stay_date);
    if (r.channel) channels.add(r.channel.toLowerCase());
    const rate = r.rate_usd != null ? Number(r.rate_usd) : null;
    if (rate != null && !Number.isNaN(rate)) {
      withPrice++;
      if (cheapest == null || rate < cheapest.rate) {
        cheapest = { rate, stay: r.stay_date ?? '', channel: r.channel ?? '' };
      }
      if (dearest == null || rate > dearest.rate) {
        dearest = { rate, stay: r.stay_date ?? '', channel: r.channel ?? '' };
      }
    }
  }
  return {
    shopDates: Array.from(shopDates).sort().reverse(),
    stayDates: Array.from(stayDates).sort(),
    ratesCount: rows.length,
    withPriceCount: withPrice,
    channelsSeen: Array.from(channels).sort(),
    cheapest,
    mostExpensive: dearest,
  };
}

export default function DeepViewPanel({
  propertyName,
  data,
  isSelf = false,
  namkhanRateMatrix,
  namkhanLabel = 'The Namkhan',
  onClose,
}: Props) {
  const summary = summarise(data.rateMatrix);
  const hasRates = summary.ratesCount > 0;
  const hasMappings = data.roomMappings.length > 0;
  const hasRankings = data.rankings.length > 0;
  const hasPlanMix = data.ratePlanMix.length > 0;
  // (was hasAnyPhase2 — sections now hide cleanly when empty, no roadmap card)

  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>DEEP VIEW</div>
          <div style={titleStyle}>{propertyName}</div>
        </div>
        <button type="button" onClick={onClose} style={closeBtnStyle}>
          ← BACK TO SET
        </button>
      </div>

      {/* Section 1 — property + channel URLs (2-col) */}
      <div style={twoColGridStyle}>
        <PropertyDetailCard detail={data.detail} fallbackName={propertyName} />
        <ChannelUrlsCard detail={data.detail} />
      </div>

      {/* Section 2 — SHOP SUMMARY (NEW): exactly what the agent did + found */}
      <div style={sectionWrapStyle}>
        <span style={sectionEyebrowStyle}>SHOP SUMMARY</span>
        <div style={summaryCardStyle}>
          {!hasRates ? (
            <div style={{ color: 'var(--ink-mute)' }}>
              No rates scraped for this property yet. Press <strong>RUN NOW (BDC)</strong> at the top of the page.
            </div>
          ) : (
            <div style={summaryGridStyle}>
              <div>
                <div style={summaryStatLabelStyle}>Last Shopped</div>
                <div style={summaryStatValueStyle}>
                  {summary.shopDates[0] ? fmtIsoDate(summary.shopDates[0]) : '—'}
                </div>
              </div>
              <div>
                <div style={summaryStatLabelStyle}>Stays Scraped</div>
                <div style={summaryStatValueStyle}>{summary.stayDates.length}</div>
              </div>
              <div>
                <div style={summaryStatLabelStyle}>Rates with Price</div>
                <div style={summaryStatValueStyle}>
                  {summary.withPriceCount} / {summary.ratesCount}
                </div>
              </div>
              <div>
                <div style={summaryStatLabelStyle}>Channels</div>
                <div style={summaryStatValueStyle}>
                  {summary.channelsSeen.map((c) => c.toUpperCase()).join(' · ')}
                </div>
              </div>
              {summary.cheapest && (
                <div>
                  <div style={summaryStatLabelStyle}>Lowest</div>
                  <div style={summaryStatValueStyle}>
                    {fmtTableUsd(summary.cheapest.rate)}
                    <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', marginLeft: 6 }}>
                      {fmtIsoDate(summary.cheapest.stay)} · {summary.cheapest.channel.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              {summary.mostExpensive && (
                <div>
                  <div style={summaryStatLabelStyle}>Highest</div>
                  <div style={summaryStatValueStyle}>
                    {fmtTableUsd(summary.mostExpensive.rate)}
                    <span style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', marginLeft: 6 }}>
                      {fmtIsoDate(summary.mostExpensive.stay)} · {summary.mostExpensive.channel.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          {hasRates && summary.stayDates.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={summaryStatLabelStyle}>Stay Dates the Agent Looked At</div>
              <div style={{ marginTop: 4 }}>
                {summary.stayDates.map((d) => (
                  <span key={d} style={datePillStyle}>{fmtIsoDate(d)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3 — RATE MATRIX (the actual data, with Namkhan baseline overlay) */}
      <div style={sectionWrapStyle}>
        <span style={sectionEyebrowStyle}>
          RATE MATRIX (last 8 stay dates · Booking.com)
        </span>
        <RateMatrixCard
          rows={data.rateMatrix}
          baselineRows={isSelf ? undefined : namkhanRateMatrix}
          baselineLabel={namkhanLabel}
        />
      </div>

      {/* Section 3b — RATE PLANS LIVE (BDC parser v2, deployed 2026-05-04) */}
      <div style={sectionWrapStyle}>
        <span style={sectionEyebrowStyle}>
          RATE PLANS — LATEST SHOP (per room type / refundable / breakfast)
        </span>
        <RatePlansLiveTable rows={data.ratePlansLive} />
      </div>

      {/* Section 4 — Phase 2 sections, only shown if data exists */}
      {hasMappings && (
        <div style={sectionWrapStyle}>
          <span style={sectionEyebrowStyle}>
            ROOM MAPPINGS
            <span style={phase2BadgeStyle}>Coming with broader scrape</span>
          </span>
          <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 4, overflow: 'hidden' }}>
            <RoomMappingsTable rows={data.roomMappings} />
          </div>
        </div>
      )}

      {hasRankings && (
        <div style={sectionWrapStyle}>
          <span style={sectionEyebrowStyle}>
            PLATFORM RANKINGS
            <span style={phase2BadgeStyle}>Coming with broader scrape</span>
          </span>
          <RankingsGrid rows={data.rankings} />
        </div>
      )}

      {hasPlanMix && (
        <div style={sectionWrapStyle}>
          <span style={sectionEyebrowStyle}>
            RATE PLANS OFFERED
            <span style={phase2BadgeStyle}>Coming with broader scrape</span>
          </span>
          <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 4, overflow: 'hidden' }}>
            <RatePlansMatrixTable rows={data.ratePlanMix} />
          </div>
        </div>
      )}

    </div>
  );
}
