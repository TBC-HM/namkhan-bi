// components/settings/panels/ContactsPanel.tsx
import { PanelHeader, Chip, StatusBadge, EmptyState } from './_shared';

const purposeOrder = ['reservations', 'gm', 'owner', 'billing', 'emergency'];

function contactHref(kind: string, value: string): string | undefined {
  if (!value || value.toLowerCase().includes('lorem ipsum')) return undefined;
  switch (kind) {
    case 'email': return `mailto:${value.trim()}`;
    case 'phone': return `tel:${value.replace(/\s/g, '')}`;
    case 'whatsapp': return `https://wa.me/${value.replace(/[^\d]/g, '')}`;
    default: return undefined;
  }
}

export default function ContactsPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Contacts" /><EmptyState message="No contacts defined." /></>;
  }

  const byPurpose: Record<string, any[]> = {};
  data.forEach((c) => {
    const p = c.purpose || 'other';
    if (!byPurpose[p]) byPurpose[p] = [];
    byPurpose[p].push(c);
  });

  const orderedKeys = [...purposeOrder.filter((k) => byPurpose[k]), ...Object.keys(byPurpose).filter((k) => !purposeOrder.includes(k))];

  return (
    <>
      <PanelHeader title="Contacts" subtitle={`${data.length} institutional contacts`} />
      <div className="p-6 space-y-6">
        {orderedKeys.map((purpose) => (
          <div key={purpose}>
            <h3 className="text-xs uppercase tracking-[0.15em] text-[var(--sand,#B8A878)] font-semibold mb-3">
              {purpose} <span className="text-[var(--primary,#1F3A2E)]/40 normal-case font-normal">({byPurpose[purpose].length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {byPurpose[purpose].map((c) => {
                const href = contactHref(c.kind, c.value);
                return (
                  <div key={c.contact_id} className="bg-white rounded-lg border border-[var(--sand,#B8A878)]/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Chip>{c.kind}</Chip>
                          {c.is_primary && <Chip tone="green">Primary</Chip>}
                          {!c.is_public && <Chip tone="warn">Internal</Chip>}
                        </div>
                        {href ? (
                          <a href={href} className="text-sm text-[var(--terracotta,#B8542A)] hover:underline break-all">
                            {c.value}
                          </a>
                        ) : (
                          <p className="text-sm text-[var(--primary,#1F3A2E)] break-all">{c.value}</p>
                        )}
                        {c.display_label && <p className="text-xs text-[var(--primary,#1F3A2E)]/60 mt-1">{c.display_label}</p>}
                        {c.hours_local && <p className="text-xs text-[var(--sand,#B8A878)] mt-1">Hours: {c.hours_local}</p>}
                        {c.notes && <p className="text-xs text-[var(--primary,#1F3A2E)]/50 mt-1 italic">{c.notes}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        <StatusBadge active={c.is_active} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
