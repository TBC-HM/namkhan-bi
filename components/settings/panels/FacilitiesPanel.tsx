// components/settings/panels/FacilitiesPanel.tsx
import { PanelHeader, Chip, StatusBadge, EmptyState } from './_shared';

export default function FacilitiesPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Facilities" /><EmptyState message="No facilities defined." /></>;
  }

  const byCategory: Record<string, any[]> = {};
  data.forEach((f) => {
    const cat = f.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(f);
  });

  return (
    <>
      <PanelHeader title="Facilities" subtitle={`${data.length} facilities across ${Object.keys(byCategory).length} categories`} />
      <div className="p-6 space-y-6">
        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <h3 className="text-xs uppercase tracking-[0.15em] text-[var(--sand,#B8A878)] font-semibold mb-3">
              {cat} <span className="text-[var(--primary,#1F3A2E)]/40 normal-case font-normal">({items.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((f) => (
                <div
                  key={f.facility_id}
                  className="bg-white rounded-lg border border-[var(--sand,#B8A878)]/20 p-4 hover:border-[var(--sand,#B8A878)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-[var(--primary,#1F3A2E)]">{f.name}</h4>
                      {f.description && (
                        <p className="text-sm text-[var(--primary,#1F3A2E)]/70 mt-1 leading-relaxed">{f.description}</p>
                      )}
                      {f.hours && <p className="text-xs text-[var(--sand,#B8A878)] mt-2">Hours: {f.hours}</p>}
                      {f.notes && <p className="text-xs text-[var(--primary,#1F3A2E)]/50 mt-1 italic">{f.notes}</p>}
                    </div>
                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                      <StatusBadge active={f.is_active} />
                      {f.is_complimentary ? <Chip tone="green">Free</Chip> : <Chip tone="warn">Paid</Chip>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
