// app/revenue/compset/_components/EventsStrip.tsx
// Horizontal strip of upcoming demand events. Pure render — no interactivity.

import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { EMPTY } from '@/lib/format';
import type { UpcomingEventRow } from './types';

const STATUS_TONE: Record<string, StatusTone> = {
  live:     'active',
  buildup:  'pending',
  imminent: 'pending',
  horizon:  'inactive',
};

const STATUS_LABEL: Record<string, string> = {
  live:     'LIVE',
  buildup:  'BUILDUP',
  imminent: 'IMMINENT',
  horizon:  'HORIZON',
};

const STATUS_BORDER: Record<string, string> = {
  live:     'var(--moss)',
  buildup:  'var(--brass)',
  imminent: 'var(--brass)',
  horizon:  'var(--ink-mute)',
};

interface Props {
  events: UpcomingEventRow[];
}

export default function EventsStrip({ events }: Props) {
  if (events.length === 0) {
    return (
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--paper-warm)',
          border: '1px dashed var(--paper-deep)',
          borderRadius: 8,
          color: 'var(--ink-mute)',
          fontSize: 'var(--t-sm)',
          textAlign: 'center',
          marginTop: 14,
        }}
      >
        No upcoming events. Add events in marketing.calendar_events.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 0',
        marginTop: 14,
        overflowX: 'auto',
      }}
    >
      {events.map((e) => {
        const status = (e.status ?? 'horizon').toLowerCase();
        const tone: StatusTone = STATUS_TONE[status] ?? 'inactive';
        const label = STATUS_LABEL[status] ?? status.toUpperCase();
        const borderColor = STATUS_BORDER[status] ?? 'var(--ink-mute)';
        return (
          <div
            key={e.event_id}
            style={{
              flex: '0 0 auto',
              background: 'var(--paper-warm)',
              border: '1px solid var(--paper-deep)',
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: 4,
              padding: '10px 14px',
              minWidth: 200,
            }}
          >
            <div
              style={{
                fontSize: 'var(--t-md)',
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              {e.display_name}
            </div>
            <div
              style={{
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                fontFamily: 'var(--mono)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <StatusPill tone={tone}>{label}</StatusPill>
              {e.days_until_event != null
                ? `${e.days_until_event}d`
                : EMPTY}
              {e.demand_score != null && (
                <span style={{ color: 'var(--ink-faint)' }}>
                  · score {e.demand_score}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
