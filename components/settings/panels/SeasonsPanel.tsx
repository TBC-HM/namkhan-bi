// components/settings/panels/SeasonsPanel.tsx
// PBS 2026-05-13 rev3: brand-aware tokens.
import { PanelHeader, Chip, StatusBadge, EmptyState, formatDate } from './_shared';

const seasonColors: Record<string, 'green' | 'default' | 'warn' | 'muted'> = {
  high: 'warn',
  low: 'muted',
  shoulder: 'default',
  green: 'green',
};

export default function SeasonsPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Seasons" /><EmptyState message="No seasons defined." /></>;
  }

  return (
    <>
      <PanelHeader title="Seasons" subtitle={`${data.length} season blocks defined`} />
      <div className="p-6 space-y-3">
        {data.map((s) => (
          <div
            key={s.season_id}
            className="rounded-lg p-4 flex items-center gap-4"
            style={{ background: 'var(--paper-deep)', border: '1px solid var(--border)' }}
          >
            <div className="flex-shrink-0">
              <Chip tone={seasonColors[s.season_code?.toLowerCase()] || 'default'}>{s.season_code}</Chip>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium" style={{ color: 'var(--ink)' }}>{s.display_name}</h4>
              <p className="mt-0.5" style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                {formatDate(s.date_start)} → {formatDate(s.date_end)}
              </p>
              {s.notes && (
                <p className="mt-1 italic" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  {s.notes}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              <StatusBadge active={s.is_active} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
