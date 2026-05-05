// app/revenue/compset/_components/ScrapeDatesPreview.tsx
// 4×2 grid of dates the next agent run will shop. Uses public.compset_pick_scrape_dates.

import { fmtIsoDate, EMPTY } from '@/lib/format';
import type { ScrapeDateRow } from './types';

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDayOfWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return DOW_NAMES[d.getUTCDay()];
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
  return `${day} ${month}`;
}

function scoreTone(score: number): string {
  if (score >= 70) return 'var(--moss)';
  if (score >= 50) return 'var(--brass)';
  return 'var(--ink-mute)';
}

interface Props {
  dates: ScrapeDateRow[];
  mode?: string;
  horizonDays: number;
  minScore: number;
}

export default function ScrapeDatesPreview({
  dates,
  mode = 'daily_lean',
  horizonDays,
  minScore,
}: Props) {
  return (
    <div
      style={{
        background: 'var(--paper-warm)',
        border: '1px solid var(--paper-deep)',
        borderRadius: 8,
        padding: '22px 24px',
        marginTop: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'var(--t-xl)',
              fontWeight: 500,
            }}
          >
            Next run will shop these dates
          </div>
          <div
            style={{
              color: 'var(--ink-mute)',
              fontSize: 'var(--t-sm)',
              marginTop: 4,
            }}
          >
            {dates.length === 1
              ? '1 stay date picked by smart picker'
              : `${dates.length} stay dates picked by smart picker`}
          </div>
        </div>
        <div
          style={{
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-xs)',
            fontFamily: 'var(--mono)',
            textAlign: 'right',
            lineHeight: 1.7,
            letterSpacing: 'var(--ls-loose)',
          }}
        >
          MODE: {mode.toUpperCase()}
          <br />
          HORIZON: {horizonDays}D · FLOOR: {minScore}
        </div>
      </div>

      {dates.length === 0 ? (
        <div
          style={{
            padding: '20px 16px',
            border: '1px dashed var(--paper-deep)',
            borderRadius: 4,
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-sm)',
          }}
        >
          No dates above floor. Lower the floor or seed events to see picks.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
          }}
        >
          {dates.map((d) => {
            const score = Number(d.total_score);
            const borderColor = scoreTone(score);
            return (
              <div
                key={d.stay_date}
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--paper-deep)',
                  borderLeft: `3px solid ${borderColor}`,
                  padding: '12px 14px',
                  borderRadius: 4,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-base)',
                      fontWeight: 600,
                    }}
                  >
                    {fmtDayOfWeek(d.stay_date)} {fmtShortDate(d.stay_date)}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 'var(--t-xs)',
                      color: borderColor,
                      fontWeight: 600,
                    }}
                  >
                    {score}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  {(d.events ?? []).map((ev) => (
                    <span
                      key={ev}
                      style={{
                        display: 'inline-block',
                        padding: '1px 6px',
                        background: 'var(--paper-warm)',
                        color: 'var(--brass)',
                        borderRadius: 2,
                        fontSize: 'var(--t-xs)',
                        marginRight: 4,
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {ev}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: 'var(--ink-faint)',
                    fontSize: 'var(--t-xs)',
                    fontFamily: 'var(--mono)',
                    letterSpacing: 'var(--ls-loose)',
                    textTransform: 'uppercase',
                  }}
                >
                  PICKER · {fmtIsoDate(d.stay_date) ?? EMPTY}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
