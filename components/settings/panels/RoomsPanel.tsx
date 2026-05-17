// components/settings/panels/RoomsPanel.tsx
// PBS 2026-05-13 rev3: brand-aware tokens.
import { PanelHeader, Chip, ChipList, EmptyState } from './_shared';

const tierColors: Record<string, 'green' | 'default' | 'warn' | 'muted'> = {
  signature: 'green',
  premium: 'warn',
  entry: 'default',
};

export default function RoomsPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Rooms" /><EmptyState message="No room types defined." /></>;
  }

  return (
    <>
      <PanelHeader title="Rooms" subtitle={`${data.length} room types · setup catalog (bookable inventory in pms.rooms)`} />
      <div className="p-6 space-y-4">
        {data.map((r) => (
          <div
            key={r.room_type_id}
            className="rounded-lg overflow-hidden transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="px-5 py-4 flex items-start justify-between gap-4"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--paper-deep)' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif" style={{ fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>
                    {r.display_name}
                  </h3>
                  {r.positioning_tier && <Chip tone={tierColors[r.positioning_tier] || 'default'}>{r.positioning_tier}</Chip>}
                </div>
                {r.short_pitch && (
                  <p className="mt-1" style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                    {r.short_pitch}
                  </p>
                )}
                {r.positioning_label && (
                  <p className="italic mt-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>
                    {r.positioning_label}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0" style={{ fontSize: 'var(--t-xs)' }}>
                <p style={{ color: 'var(--ink-mute)' }}>ID</p>
                <p className="font-mono" style={{ color: 'var(--ink-soft)' }}>{r.room_type_id}</p>
              </div>
            </div>

            <div
              className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4"
              style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}
            >
              <div>
                <p className="uppercase tracking-wider font-medium mb-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>Size</p>
                <p>{r.size_sqm ? `${r.size_sqm} m²` : '—'}{r.garden_sqm ? ` + ${r.garden_sqm} m² garden` : ''}</p>
              </div>
              <div>
                <p className="uppercase tracking-wider font-medium mb-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>Max occupancy</p>
                <p>{r.max_occupancy ?? '—'} ({r.max_adults}A + {r.max_children}C)</p>
              </div>
              <div>
                <p className="uppercase tracking-wider font-medium mb-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>Extra bed</p>
                <p>{r.extra_bed_allowed ? <Chip tone="green">Yes</Chip> : <Chip tone="muted">No</Chip>}</p>
              </div>
              <div>
                <p className="uppercase tracking-wider font-medium mb-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>View</p>
                <ChipList items={r.view_type} />
              </div>
              <div className="col-span-2">
                <p className="uppercase tracking-wider font-medium mb-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>Bed config</p>
                <ChipList items={r.bed_config} />
              </div>
              <div className="col-span-2">
                <p className="uppercase tracking-wider font-medium mb-1" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>Ideal for</p>
                <ChipList items={r.ideal_for} />
              </div>
            </div>

            {r.long_description && (
              <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                <details className="cursor-pointer">
                  <summary className="hover:underline" style={{ fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>
                    Show full description
                  </summary>
                  <p
                    className="mt-2 leading-relaxed whitespace-pre-wrap"
                    style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}
                  >
                    {r.long_description}
                  </p>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
