// app/revenue/compset/_components/property-detail/RatePlansLiveTable.tsx
//
// Per-rate-plan rows from the BDC parser v2 (deployed in EF v6, 2026-05-04).
// Source: public.v_compset_rate_plans_latest (latest shop_date per cell).
// Rendered inside DeepView under "RATE PLANS — LATEST SHOP".

'use client';

import { EMPTY, fmtIsoDate, fmtTableUsd } from '@/lib/format';
import StatusPill from '@/components/ui/StatusPill';
import type { RatePlanLiveRow } from '../types';

interface Props {
  rows: RatePlanLiveRow[];
}

const wrapStyle: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 4,
  overflow: 'hidden',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
  borderBottom: '1px solid var(--paper-deep)',
  fontWeight: 600,
  background: 'var(--paper-deep)',
};

const thRightStyle: React.CSSProperties = { ...thStyle, textAlign: 'right' };

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 'var(--t-sm)',
  color: 'var(--ink)',
  borderBottom: '1px solid var(--paper-deep)',
  verticalAlign: 'top',
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

function MealPill({ meal }: { meal: string | null }) {
  if (!meal) return <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>;
  const label = ({
    room_only: 'Room only',
    breakfast: 'B&B',
    half_board: 'Half board',
    full_board: 'Full board',
    all_inclusive: 'All-inclusive',
  } as Record<string, string>)[meal] ?? meal;
  return (
    <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)' }}>
      {label.toUpperCase()}
    </span>
  );
}

export default function RatePlansLiveTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div style={{ ...wrapStyle, padding: '20px', textAlign: 'center' }}>
        <div style={{ color: 'var(--ink-mute)' }}>No rate plans captured yet for this property.</div>
        <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)', marginTop: 4 }}>
          BDC parser v2 (deployed 2026-05-04) extracts plans on every scrape.
          Press <strong>RUN NOW (BDC)</strong> at the top of the page.
        </div>
      </div>
    );
  }

  // Group by stay_date — within each stay sort by room_type then rate ascending
  // so the same room's rate plans appear together (no mish-mash).
  const byStay = new Map<string, RatePlanLiveRow[]>();
  for (const r of rows) {
    if (!byStay.has(r.stay_date)) byStay.set(r.stay_date, []);
    byStay.get(r.stay_date)!.push(r);
  }
  for (const arr of byStay.values()) {
    arr.sort((a, b) => {
      const aRoom = (a.raw_room_type || 'zzz').toLowerCase();
      const bRoom = (b.raw_room_type || 'zzz').toLowerCase();
      if (aRoom !== bRoom) return aRoom.localeCompare(bRoom);
      // Same room → sort by rate ascending (cheapest first)
      const aRate = a.rate_usd ?? 999999;
      const bRate = b.rate_usd ?? 999999;
      return aRate - bRate;
    });
  }
  const stays = Array.from(byStay.keys()).sort();

  return (
    <div style={wrapStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>STAY DATE</th>
              <th style={thStyle}>ROOM TYPE</th>
              <th style={thStyle}>MEAL</th>
              <th style={thStyle}>POLICY</th>
              <th style={thStyle}>PROMO</th>
              <th style={thRightStyle}>RATE</th>
              <th style={thRightStyle}>STRIKETHROUGH</th>
              <th style={thRightStyle}>DISCOUNT</th>
            </tr>
          </thead>
          <tbody>
            {stays.flatMap((stay) => {
              const arr = byStay.get(stay)!;
              return arr.map((r, i) => {
                // For visual grouping: stay date shows on first row of each stay
                const showStay = i === 0;
                // Room name shows only when it changes (else show ·)
                const prevRoom = i > 0 ? arr[i - 1].raw_room_type : null;
                const showRoom = i === 0 || prevRoom !== r.raw_room_type;
                // Add a visible top-border between room groups (not between same-room rows)
                const groupBorder = i > 0 && showRoom
                  ? { borderTop: '1px solid var(--paper-deep)' }
                  : {};
                const refundTone =
                  r.is_refundable === true ? 'active' :
                  r.is_refundable === false ? 'expired' :
                  'inactive';
                const refundLabel =
                  r.is_refundable === true ? 'REFUNDABLE' :
                  r.is_refundable === false ? 'NON-REFUND' :
                  'UNKNOWN';
                return (
                  <tr key={r.plan_id} style={groupBorder}>
                    <td style={tdStyle}>
                      {showStay ? (
                        <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>
                          {fmtIsoDate(stay)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>·</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {showRoom ? (
                        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.raw_room_type ?? EMPTY}</span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>·</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <MealPill meal={r.meal_plan} />
                    </td>
                    <td style={tdStyle}>
                      <StatusPill tone={refundTone}>{refundLabel}</StatusPill>
                      {r.cancellation_deadline_days != null && (
                        <div style={{ color: 'var(--ink-mute)', fontSize: 'var(--t-xs)', marginTop: 2 }}>
                          {r.cancellation_deadline_days}d before stay
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {r.promo_label ? (
                        <span style={{ color: 'var(--brass)', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', letterSpacing: 'var(--ls-loose)' }}>
                          {r.promo_label.toUpperCase()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>
                      )}
                    </td>
                    <td style={{ ...tdRightStyle, fontWeight: 600 }}>
                      {fmtTableUsd(r.rate_usd)}
                    </td>
                    <td style={tdRightStyle}>
                      {r.strikethrough_rate_usd != null ? (
                        <span style={{ color: 'var(--ink-mute)', textDecoration: 'line-through' }}>
                          {fmtTableUsd(r.strikethrough_rate_usd)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>
                      )}
                    </td>
                    <td style={tdRightStyle}>
                      {r.discount_pct != null ? (
                        <span style={{ color: 'var(--moss)', fontWeight: 600 }}>
                          −{r.discount_pct}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>{EMPTY}</span>
                      )}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: '8px 12px',
          background: 'var(--paper-deep)',
          color: 'var(--ink-mute)',
          fontSize: 'var(--t-xs)',
          fontFamily: 'var(--mono)',
          letterSpacing: 'var(--ls-loose)',
          borderTop: '1px solid var(--paper-deep)',
        }}
      >
        Source: BDC parser v2 · Latest shop per stay date · Refundable / non-refundable / breakfast detected from policy text.
      </div>
    </div>
  );
}
