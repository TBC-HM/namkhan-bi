// components/settings/panels/SeasonsPanel.tsx
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
            className="bg-white rounded-lg border border-[var(--sand,#B8A878)]/20 p-4 flex items-center gap-4"
          >
            <div className="flex-shrink-0">
              <Chip tone={seasonColors[s.season_code?.toLowerCase()] || 'default'}>{s.season_code}</Chip>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-[var(--primary,#1F3A2E)]">{s.display_name}</h4>
              <p className="text-sm text-[var(--primary,#1F3A2E)]/70 mt-0.5">
                {formatDate(s.date_start)} → {formatDate(s.date_end)}
              </p>
              {s.notes && <p className="text-xs text-[var(--primary,#1F3A2E)]/50 mt-1 italic">{s.notes}</p>}
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
