// components/settings/panels/CertificationsPanel.tsx
// PBS 2026-05-13 rev3: brand-aware tokens. See _shared.tsx for rationale.
import { PanelHeader, Chip, StatusBadge, EmptyState, formatDate } from './_shared';

export default function CertificationsPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Certifications" /><EmptyState message="No certifications defined." /></>;
  }

  return (
    <>
      <PanelHeader title="Certifications & Affiliations" subtitle={`${data.length} certifications`} />
      <div className="p-6 space-y-3">
        {data.map((c) => (
          <div
            key={c.cert_id}
            className="rounded-lg p-4"
            style={{ background: 'var(--paper-deep)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium" style={{ color: 'var(--ink)' }}>{c.certification_name}</h4>
                  {c.level && <Chip tone="green">{c.level}</Chip>}
                </div>
                <p className="mt-1" style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
                  Issued by {c.certifying_body}
                </p>
                <div
                  className="flex flex-wrap items-center gap-3 mt-2"
                  style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}
                >
                  {c.issued_date && <span>Issued {formatDate(c.issued_date)}</span>}
                  {c.expires_date && <span>· Expires {formatDate(c.expires_date)}</span>}
                  {c.certification_url && (
                    <a
                      href={c.certification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: 'var(--brass)' }}
                    >
                      Verify ↗
                    </a>
                  )}
                </div>
                {c.notes && (
                  <p
                    className="mt-2 italic"
                    style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}
                  >
                    {c.notes}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <StatusBadge active={c.is_active} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
