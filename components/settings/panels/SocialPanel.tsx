// components/settings/panels/SocialPanel.tsx
// PBS 2026-05-13 rev3: brand-aware tokens.
import { PanelHeader, Chip, StatusBadge, EmptyState } from './_shared';

const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking.com',
  expedia: 'Expedia',
  google_business: 'Google Business',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
};

export default function SocialPanel({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <><PanelHeader title="Social" /><EmptyState message="No social accounts defined." /></>;
  }

  return (
    <>
      <PanelHeader title="Social & Distribution" subtitle={`${data.length} platform accounts`} />
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((s) => (
          <div
            key={s.id}
            className="rounded-lg p-4"
            style={{ background: 'var(--paper-deep)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Chip>{platformLabels[s.platform] || s.platform}</Chip>
                  {s.metric_kind && <Chip tone="muted">{s.metric_kind}</Chip>}
                </div>
                {s.handle && (
                  <p className="font-medium" style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{s.handle}</p>
                )}
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline break-all block mt-1"
                    style={{ fontSize: 'var(--t-xs)', color: 'var(--brass)' }}
                  >
                    {s.url} ↗
                  </a>
                )}
                <div className="grid grid-cols-3 gap-2 mt-3" style={{ fontSize: 'var(--t-xs)' }}>
                  <div>
                    <p className="uppercase tracking-wider" style={{ color: 'var(--ink-mute)' }}>Metric</p>
                    <p
                      className="font-semibold"
                      style={{ fontSize: 'var(--t-xl)', color: 'var(--ink)' }}
                    >
                      {s.metric_value?.toLocaleString() ?? '—'}
                    </p>
                  </div>
                  {s.secondary_value != null && (
                    <div>
                      <p className="uppercase tracking-wider" style={{ color: 'var(--ink-mute)' }}>Secondary</p>
                      <p
                        className="font-semibold"
                        style={{ fontSize: 'var(--t-xl)', color: 'var(--ink)' }}
                      >
                        {s.secondary_value}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="uppercase tracking-wider" style={{ color: 'var(--ink-mute)' }}>Last sync</p>
                    <p style={{ color: 'var(--ink-soft)' }}>
                      {s.last_synced_at
                        ? new Date(s.last_synced_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                        : '—'}
                    </p>
                  </div>
                </div>
                {s.last_sync_status && (
                  <div className="mt-2 flex items-center gap-2">
                    <Chip
                      tone={
                        s.last_sync_status === 'success'
                          ? 'green'
                          : s.last_sync_status === 'skipped'
                          ? 'muted'
                          : 'warn'
                      }
                    >
                      Sync: {s.last_sync_status}
                    </Chip>
                    {s.last_sync_error && (
                      <p
                        className="italic truncate"
                        style={{ fontSize: 'var(--t-xs)', color: 'var(--brass)' }}
                      >
                        {s.last_sync_error}
                      </p>
                    )}
                  </div>
                )}
                {s.notes && (
                  <p className="mt-1 italic" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                    {s.notes}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                <StatusBadge active={s.active} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
