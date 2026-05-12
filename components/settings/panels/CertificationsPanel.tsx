// components/settings/panels/CertificationsPanel.tsx
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
            className="bg-white rounded-lg border border-[var(--sand,#B8A878)]/20 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-[var(--primary,#1F3A2E)]">{c.certification_name}</h4>
                  {c.level && <Chip tone="green">{c.level}</Chip>}
                </div>
                <p className="text-sm text-[var(--primary,#1F3A2E)]/70 mt-1">
                  Issued by {c.certifying_body}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[var(--primary,#1F3A2E)]/60">
                  {c.issued_date && <span>Issued {formatDate(c.issued_date)}</span>}
                  {c.expires_date && <span>· Expires {formatDate(c.expires_date)}</span>}
                  {c.certification_url && (
                    <a
                      href={c.certification_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--terracotta,#B8542A)] hover:underline"
                    >
                      Verify ↗
                    </a>
                  )}
                </div>
                {c.notes && <p className="text-xs text-[var(--primary,#1F3A2E)]/50 mt-2 italic">{c.notes}</p>}
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
