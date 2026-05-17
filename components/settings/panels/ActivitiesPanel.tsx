// components/settings/panels/ActivitiesPanel.tsx
// PBS 2026-05-13 rev3: brand-aware tokens. See _shared.tsx for rationale.
import { PanelHeader, Chip, StatusBadge, EmptyState } from './_shared';

export default function ActivitiesPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Activities" /><EmptyState message="No activities defined." /></>;
  }

  const byCategory: Record<string, any[]> = {};
  data.forEach((a) => {
    const cat = a.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(a);
  });

  return (
    <>
      <PanelHeader
        title="Activities"
        subtitle={`${data.length} activities — basic catalog. Rich bookable activities live in sales.activity_catalog.`}
      />
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
              {items.map((a) => (
                <div
                  key={a.activity_id}
                  className="rounded-lg p-4"
                  style={{ background: 'var(--paper-deep)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium" style={{ color: 'var(--ink)' }}>{a.name}</h4>
                      {a.description && (
                        <p
                          className="mt-1 leading-relaxed"
                          style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}
                        >
                          {a.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {a.duration_min && <Chip tone="muted">{a.duration_min} min</Chip>}
                        {a.group_type && <Chip tone="muted">{a.group_type}</Chip>}
                        {a.age_restriction && <Chip tone="warn">Age: {a.age_restriction}</Chip>}
                        {a.bookable_via && <Chip>{a.bookable_via}</Chip>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                      <StatusBadge active={a.is_active} />
                      {a.is_complimentary ? <Chip tone="green">Free</Chip> : <Chip tone="warn">Paid</Chip>}
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
