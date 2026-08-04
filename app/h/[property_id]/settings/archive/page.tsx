// app/h/[property_id]/settings/archive/page.tsx
// Archive settings — document archive stats, folder config, retention thresholds.
// Distinct from Documents tab (which handles doc registry: families/types/matters).

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSettingsTabs } from '@/lib/property-settings-tabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchArchiveStats(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [totalRes, byTypeRes, recentRes] = await Promise.all([
    sb.from('dms.documents' as any).select('doc_id', { count: 'exact', head: true }).eq('property_id', propertyId),
    Promise.resolve(sb.rpc('fn_doc_archive_stats_by_type' as any, { p_property_id: propertyId })).catch(() => ({ data: null, error: null })),
    Promise.resolve(sb.from('v_doc_register').select('doc_type, project, last_updated_at, status').eq('property_id', propertyId)
      .order('last_updated_at', { ascending: false }).limit(10)).catch(() => ({ data: null, error: null })),
  ]);
  return {
    total: totalRes.count ?? 0,
    byType: (byTypeRes as any).data ?? null,
    recent: (recentRes as any).data ?? [],
  };
}

function StatRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid #F5F1EA' }}>
      <span style={{ width: 220, flexShrink: 0, fontSize: 12, color: '#5A5A5A', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: value != null ? '#1B1B1B' : '#B0A896', fontStyle: value != null ? 'normal' : 'italic' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

export default async function ArchiveSettingsPage({ params }: { params: { property_id: string } }) {
  const pid = Number(params.property_id);
  const stats = await fetchArchiveStats(pid).catch(() => ({ total: 0, byType: null, recent: [] }));

  return (
    <DashboardPage
      title="Settings · Archive"
      subtitle={`Document archive pipeline · stats · retention configuration · property ${pid}`}
      tabs={getSettingsTabs(pid, 'archive')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Archive Pipeline" subtitle="DMS document counts by extraction and classification status">
          <div style={{ padding: '4px 16px 12px' }}>
            <StatRow label="Total documents registered"  value={stats.total} />
            <StatRow label="Archive path"                value={`/h/${pid}/finance/legal/docs`} />
            <StatRow label="Brain pipeline"              value={`/h/${pid}/settings/brain`} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F5F1EA' }}>
            <a
              href={`/h/${pid}/finance/legal/docs`}
              style={{ fontSize: 12, fontWeight: 600, color: '#1F3A2E', textDecoration: 'none', marginRight: 24 }}
            >
              Open Document Archive →
            </a>
            <a
              href={`/h/${pid}/settings/brain`}
              style={{ fontSize: 12, fontWeight: 600, color: '#1F3A2E', textDecoration: 'none' }}
            >
              Brain Pipeline →
            </a>
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Retention & Thresholds" subtitle="Auto-archive rules · expiry · sensitivity — managed in Brain settings">
          <div style={{ padding: '12px 16px', color: '#5A5A5A', fontSize: 13 }}>
            <p style={{ margin: 0 }}>
              Retention rules and sensitivity thresholds are configured in the{' '}
              <a href={`/h/${pid}/settings/brain`} style={{ color: '#1F3A2E', fontWeight: 600 }}>Brain settings</a>.
              {' '}Classification status, excluded docs, and nightly battery reports are all managed there.
            </p>
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
        <Container title="Recent Documents" subtitle="Last 10 registered by update time — open archive for full list">
          {stats.recent.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: '#5A5A5A', fontStyle: 'italic' }}>No documents registered yet.</div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9F7F3', borderBottom: '1px solid #E6DFCC' }}>
                  {['Type','Project','Status','Last Updated'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: '#5A5A5A' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats.recent as any[]).map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F5F1EA' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 500 }}>{r.doc_type || '—'}</td>
                    <td style={{ padding: '7px 12px' }}>{r.project || '—'}</td>
                    <td style={{ padding: '7px 12px' }}>{r.status || '—'}</td>
                    <td style={{ padding: '7px 12px' }}>{r.last_updated_at ? r.last_updated_at.slice(0,10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
