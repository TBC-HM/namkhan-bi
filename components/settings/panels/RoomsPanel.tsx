// components/settings/panels/RoomsPanel.tsx
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
            className="bg-white rounded-lg border border-[var(--sand,#B8A878)]/20 overflow-hidden hover:border-[var(--sand,#B8A878)]/50 transition-colors"
          >
            <div className="px-5 py-4 border-b border-[var(--sand,#B8A878)]/10 bg-[var(--bg,#F4EFE2)]/40 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif text-lg text-[var(--primary,#1F3A2E)]">{r.display_name}</h3>
                  {r.positioning_tier && <Chip tone={tierColors[r.positioning_tier] || 'default'}>{r.positioning_tier}</Chip>}
                </div>
                {r.short_pitch && <p className="text-sm text-[var(--primary,#1F3A2E)]/70 mt-1">{r.short_pitch}</p>}
                {r.positioning_label && <p className="text-xs text-[var(--sand,#B8A878)] italic mt-1">{r.positioning_label}</p>}
              </div>
              <div className="text-right text-xs flex-shrink-0">
                <p className="text-[var(--primary,#1F3A2E)]/50">ID</p>
                <p className="font-mono">{r.room_type_id}</p>
              </div>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1">Size</p>
                <p>{r.size_sqm ? `${r.size_sqm} m²` : '—'}{r.garden_sqm ? ` + ${r.garden_sqm} m² garden` : ''}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1">Max occupancy</p>
                <p>{r.max_occupancy ?? '—'} ({r.max_adults}A + {r.max_children}C)</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1">Extra bed</p>
                <p>{r.extra_bed_allowed ? <Chip tone="green">Yes</Chip> : <Chip tone="muted">No</Chip>}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1">View</p>
                <ChipList items={r.view_type} />
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1">Bed config</p>
                <ChipList items={r.bed_config} />
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-[var(--primary,#1F3A2E)]/50 font-medium mb-1">Ideal for</p>
                <ChipList items={r.ideal_for} />
              </div>
            </div>

            {r.long_description && (
              <div className="px-5 py-3 border-t border-[var(--sand,#B8A878)]/10">
                <details className="cursor-pointer">
                  <summary className="text-xs text-[var(--terracotta,#B8542A)] hover:underline">Show full description</summary>
                  <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap text-[var(--primary,#1F3A2E)]/80">
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
