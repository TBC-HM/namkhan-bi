// components/settings/panels/FacilitiesPanel.tsx
// PBS 2026-05-13 rev3: brand-aware tokens.
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
            <h3
              className="uppercase font-semibold mb-3"
              style={{ fontSize: 'var(--t-xs)', letterSpacing: '0.15em', color: 'var(--brass)' }}
            >
              {cat} <span className="normal-case font-normal" style={{ color: 'var(--ink-mute)' }}>({items.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((f) => (
                <div
                  key={f.facility_id}
                  className="rounded-lg p-4 transition-colors"
                  style={{ background: 'var(--paper-deep)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium" style={{ color: 'var(--ink)' }}>{f.name}</h4>
                      {f.description && (
                        <p
                          className="mt-1 leading-relaxed"
                          style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}
                        >
                          {f.description}
                        </p>
                      )}
                      {f.hours && (
                        <p className="mt-2" style={{ fontSize: 'var(--t-xs)', color: 'var(--brass)' }}>
                          Hours: {f.hours}
                        </p>
                      )}
                      {f.notes && (
                        <p className="mt-1 italic" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                          {f.notes}
                        </p>
                      )}
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
