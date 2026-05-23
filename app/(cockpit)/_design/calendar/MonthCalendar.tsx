'use client';

// app/(cockpit)/_design/calendar/MonthCalendar.tsx
// 30-day calendar grid (5 weeks) where each cell shows the day number, an
// optional badge (events count or occ %), and a hover tooltip with details.
// Promoted from /revenue/pulse/_components on 2026-05-23 so /pricing + others can reuse.

import { useState } from 'react';

export interface CalendarDay {
  date: string;
  label?: string;
  tone?: 'green' | 'amber' | 'red' | 'brass' | 'ink';
  tooltip?: string;
}

interface Props {
  days: CalendarDay[];
  variant?: 'events' | 'occ';
}

export default function MonthCalendar({ days, variant = 'occ' }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  void variant;

  if (days.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
        No data for the next 30 days.
      </div>
    );
  }

  const toneColor = (t?: string) => {
    switch (t) {
      case 'green': return '#1F7A5B';
      case 'amber': return '#C4A06B';
      case 'red':   return '#C0584C';
      case 'brass': return 'var(--brass, #B8A878)';
      default:      return 'var(--ink, #1B1B1B)';
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
      gap: 4,
      padding: 8,
      fontVariantNumeric: 'tabular-nums',
      position: 'relative',
    }}>
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((wd) => (
        <div key={wd} style={{ fontSize: 9, color: 'var(--ink-soft, #5A5A5A)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>{wd}</div>
      ))}
      {(() => {
        const first = new Date(days[0].date + 'T00:00:00Z');
        const dow = (first.getUTCDay() + 6) % 7;
        return Array.from({ length: dow }).map((_, i) => <div key={'pad' + i} />);
      })()}
      {days.map((d, i) => {
        const dayNum = new Date(d.date + 'T00:00:00Z').getUTCDate();
        const hasBadge = Boolean(d.label);
        const isHover = hoverIdx === i;
        return (
          <div key={d.date}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{
              position: 'relative',
              border: `1px solid ${isHover ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)'}`,
              borderRadius: 4,
              padding: '6px 4px',
              minHeight: 44,
              background: hasBadge ? 'rgba(184, 168, 120, 0.06)' : 'var(--paper, #FFFFFF)',
              fontSize: 10,
              color: 'var(--ink, #1B1B1B)',
              cursor: hasBadge ? 'help' : 'default',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', alignSelf: 'flex-start' }}>{dayNum}</span>
            {hasBadge && (
              <span style={{ fontSize: 11, fontWeight: 600, color: toneColor(d.tone) }}>{d.label}</span>
            )}
            {isHover && d.tooltip && (
              <div style={{
                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, marginTop: 2,
                background: 'var(--ink, #1B1B1B)', color: '#FFFFFF',
                padding: '6px 10px', borderRadius: 4,
                fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap',
                pointerEvents: 'none', maxWidth: 240,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}>{d.tooltip}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
