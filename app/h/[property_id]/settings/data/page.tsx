// app/h/[property_id]/settings/data/page.tsx
// PBS 2026-07-18 · NEW Data settings tab — lists every third-party API +
// integration used by Namkhan (email pickups, Google APIs, YouTube, Apify,
// Nimble, Cloudinary, Anthropic, etc.) with last-check freshness sourced
// from public.v_property_data_integrations (bridge over
// property.data_integrations + public.sync_runs). Daily probe cron TBD.
import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface IntegrationRow {
  integration_id: number;
  slug: string;
  name: string;
  category: string | null;
  vendor: string | null;
  website_url: string | null;
  api_docs_url: string | null;
  purpose: string | null;
  vault_secret_names: string[] | null;
  linked_sync_entity: string | null;
  linked_cron_name: string | null;
  is_active: boolean;
  last_check_at: string | null;
  last_check_status: string | null;
  last_check_error: string | null;
  last_rows_upserted: number | null;
  check_frequency_hours: number | null;
  next_check_at: string | null;
  display_order: number | null;
  notes: string | null;
  cron_active: boolean | null;
  cron_schedule: string | null;
}

const CAT_LABEL: Record<string, string> = {
  pms: 'PMS', oauth: 'OAuth', scraping: 'Scraping', ai: 'AI',
  email: 'Email', analytics: 'Analytics', media: 'Media', ecom: 'E-commerce',
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ok:      { bg: '#EBF1EE', fg: '#1F5C2C' },
  success: { bg: '#EBF1EE', fg: '#1F5C2C' },
  error:   { bg: '#FBE8E4', fg: '#B23A2E' },
  warning: { bg: '#FBEFD9', fg: '#B87F26' },
  never:   { bg: '#F5F0E1', fg: '#5A5A5A' },
  dormant: { bg: '#F5F0E1', fg: '#5A5A5A' },
};

function fmtWhen(ts: string | null): string {
  if (!ts) return 'never';
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const h = Math.round(diffMs / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return h + 'h ago';
  const days = Math.round(h / 24);
  return days + 'd ago';
}

async function loadIntegrations(propertyId: number): Promise<IntegrationRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_property_data_integrations')
    .select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false });
  return (data ?? []) as IntegrationRow[];
}

export default async function DataSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const rows = await loadIntegrations(propertyId);

  // Group by category for display
  const grouped = new Map<string, IntegrationRow[]>();
  for (const r of rows) {
    const c = r.category ?? 'other';
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(r);
  }
  const CAT_ORDER = ['pms', 'oauth', 'email', 'ai', 'media', 'scraping', 'analytics', 'ecom', 'other'];
  const orderedCats = CAT_ORDER.filter((c) => grouped.has(c));

  const activeCount = rows.filter((r) => r.is_active).length;
  const dormantCount = rows.length - activeCount;
  const errorCount = rows.filter((r) => (r.last_check_status ?? '').toLowerCase() === 'error').length;

  return (
    <DashboardPage
      title="Settings · Data"
      subtitle={`${rows.length} integrations · ${activeCount} active · ${dormantCount} dormant · property ${propertyId}`}
      tabs={[
        { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
        { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
        { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
        { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
        { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data`, active: true },
        { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain` },
        { key: 'send_logs',  label: 'Send Logs',  href: `/h/${propertyId}/settings/send-logs`  },
      ]}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container
          title="Data integrations"
          subtitle="Every third-party API + integration wired to Namkhan · daily 06:00 Vientiane probe (TBD)"
        >
          <div style={{ padding: 16 }}>
            {errorCount > 0 && (
              <div style={{ background: '#FBE8E4', border: '1px solid #E6DFCC', color: '#B23A2E', padding: '8px 12px', borderRadius: 4, fontSize: 12, marginBottom: 12 }}>
                ⚠ {errorCount} integration{errorCount === 1 ? '' : 's'} reporting errors — review below
              </div>
            )}
            {orderedCats.map((cat) => {
              const list = grouped.get(cat) ?? [];
              return (
                <section key={cat} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 700, marginBottom: 6 }}>
                    {CAT_LABEL[cat] ?? cat} · {list.length}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
                    {list.map((r) => {
                      const status = (r.last_check_status ?? 'never').toLowerCase();
                      const st = STATUS_STYLE[status] ?? STATUS_STYLE.never;
                      return (
                        <div key={r.integration_id} style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4, padding: '10px 12px', opacity: r.is_active ? 1 : 0.6 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1B1B1B' }}>{r.name}</span>
                            <span style={{ fontSize: 10, background: st.bg, color: st.fg, padding: '2px 6px', borderRadius: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {r.is_active ? status : 'dormant'}
                            </span>
                          </div>
                          {r.purpose && <div style={{ fontSize: 11, color: '#3A3A3A', marginBottom: 6, lineHeight: 1.45 }}>{r.purpose}</div>}
                          <div style={{ fontSize: 10, color: '#5A5A5A', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {r.vendor && <span>{r.vendor}</span>}
                            {r.website_url && <a href={r.website_url} target="_blank" rel="noreferrer" style={{ color: '#084838' }}>{new URL(r.website_url).hostname}</a>}
                            {r.api_docs_url && <a href={r.api_docs_url} target="_blank" rel="noreferrer" style={{ color: '#084838' }}>docs</a>}
                          </div>
                          <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span>Last check: <strong style={{ color: '#1B1B1B' }}>{fmtWhen(r.last_check_at)}</strong></span>
                            {r.last_rows_upserted != null && <span>{r.last_rows_upserted.toLocaleString()} rows</span>}
                            {r.cron_schedule && <span title={'Linked cron: ' + r.linked_cron_name}>cron: <code>{r.cron_schedule}</code></span>}
                          </div>
                          {r.last_check_error && (
                            <div style={{ fontSize: 10, color: '#B23A2E', marginTop: 4, fontFamily: 'ui-monospace, Menlo, monospace' }}>{r.last_check_error}</div>
                          )}
                          {(r.vault_secret_names ?? []).length > 0 && (
                            <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 4 }}>
                              Secrets: {(r.vault_secret_names ?? []).map((s) => <code key={s} style={{ background: '#F5F0E1', padding: '1px 4px', borderRadius: 2, marginRight: 4 }}>{s}</code>)}
                            </div>
                          )}
                          {r.notes && <div style={{ fontSize: 10, color: '#5A5A5A', marginTop: 4, fontStyle: 'italic' }}>{r.notes}</div>}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}