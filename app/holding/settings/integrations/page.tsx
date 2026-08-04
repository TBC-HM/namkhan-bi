// app/holding/settings/integrations/page.tsx
// Holding-level integration registry — platform tools + per-property connection summary.
// No PMS at holding level. Donna-specific integrations shown separately.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const T = {
  bg: '#F4EFE2', paper: '#FFFFFF', ink: '#1B1B1B', inkSoft: '#5A5A5A',
  border: '#E6DFCC', forest: '#1F3A2E', green: '#2E7D32', greenTint: '#DFF0DE',
  amber: '#B48A3A', amberTint: '#FAF6E9', red: '#B03826', redTint: '#F5D5CE', grey: '#8A8A8A',
};

const TABS = [
  { key: 'platform',      label: 'Platform',      href: '/holding/settings'                   },
  { key: 'guardrails',    label: 'Guardrails',    href: '/holding/settings/guardrails'        },
  { key: 'documents',     label: 'Documents',     href: '/holding/settings/documents'         },
  { key: 'media',         label: 'Media',         href: '/holding/settings/media'             },
  { key: 'brain',         label: 'Brain',         href: '/holding/settings/brain'             },
  { key: 'integrations',  label: 'Integrations',  href: '/holding/settings/integrations', active: true },
];

// Platform-managed integrations (holding provides these to all tenants)
const PLATFORM_TOOLS = [
  { slug: 'anthropic_ai',    name: 'Anthropic Claude',          purpose: 'All AI agents · Felix · Lens · Newsletter AI · SOP generator', vault: 'ANTHROPIC_API_KEY',            status: 'ok',      note: 'Key rotated 2026-07-11. Powers all LLM features across both properties.' },
  { slug: 'openai_image',    name: 'OpenAI Image (gpt-image-1)', purpose: 'AI photo generation in AI Studio',                              vault: 'OPENAI_IMAGE_KEY',             status: 'ok',      note: null },
  { slug: 'ideogram',        name: 'Ideogram AI',               purpose: 'Text-in-image · logos · signage · marketing cards',             vault: 'IDEOGRAM_API_KEY',             status: 'pending', note: 'Not yet activated. Apply at developer.ideogram.ai' },
  { slug: 'runway_ml',       name: 'Runway ML (video)',          purpose: 'AI video generation · Gen-3 Alpha API',                         vault: 'RUNWAY_API_KEY',               status: 'pending', note: 'Not yet activated. API access at dev.runwayml.com' },
  { slug: 'google_vertex_ai',name: 'Google Vertex AI / Imagen', purpose: 'Imagen 3 photorealistic images · Gemini multimodal',            vault: 'GOOGLE_APPLICATION_CREDENTIALS_JSON', status: 'pending', note: 'Requires GCP project + service account JSON. Enable Vertex AI API.' },
  { slug: 'elevenlabs',      name: 'ElevenLabs (voice)',         purpose: 'Voice synthesis · video narration · multilingual audio',        vault: 'ELEVENLABS_API_KEY',           status: 'pending', note: 'Not yet activated.' },
  { slug: 'shotstack',       name: 'Shotstack Video Render',     purpose: 'Video composition · render · social clips',                    vault: 'SHOTSTACK_API_KEY',            status: 'ok',      note: null },
  { slug: 'apify',           name: 'Apify (web scrape)',          purpose: 'Competitor research · Booking.com landing capture',            vault: 'apify_api_token',              status: 'ok',      note: null },
  { slug: 'github_bridge',   name: 'GitHub API',                  purpose: 'Code deploy · PR automation · bridge fn_gh_push_file',        vault: 'github_token + github_workflow_token', status: 'ok', note: 'Contents R/W token + Workflows token (added 2026-08-03).' },
  { slug: 'supabase_platform',name: 'Supabase Platform',          purpose: 'Database · Edge functions · Vault · Storage',                 vault: 'SUPABASE_SERVICE_ROLE_KEY',    status: 'ok',      note: 'Project kpenyneooigsyuuomgct · eu-central-1' },
  { slug: 'vercel',          name: 'Vercel Deploy',               purpose: 'Frontend · Auto-deploy from main',                            vault: 'VERCEL_TOKEN (GitHub secret)', status: 'ok',      note: 'Project prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl · fra1' },
];

// Donna-specific (not at holding level, not Namkhan)
const DONNA_TOOLS = [
  { name: 'Mews PMS', purpose: 'Reservations · rooms · rates (Donna Portals)', vault: 'mews_access_token · mews_client_token · mews_platform_url', status: 'dormant', note: 'Universal 401 since 2026-05-13 — awaiting Mews token reissue. CSV import active as fallback.' },
  { name: 'Factorial HR', purpose: 'Staff records · payroll · scheduling (Donna)', vault: 'factorial API Donna', status: 'ok', note: 'Connected for Donna. Not applicable to Namkhan.' },
];

function StatusDot({ status }: { status: string }) {
  const c = status === 'ok' ? T.green : status === 'pending' ? T.amber : T.grey;
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 6, flexShrink: 0 }} />;
}

export default async function HoldingIntegrationsPage() {
  const sb = getSupabaseAdmin();

  // Per-property integration summary
  const { data: allIntegrations } = await sb
    .from('v_property_data_integrations')
    .select('property_id, slug, name, is_active, last_check_status, managed_by')
    .eq('managed_by', 'property')
    .order('property_id');

  const byProperty = new Map<number, typeof allIntegrations>();
  for (const r of (allIntegrations ?? [])) {
    const pid = r.property_id as number;
    if (!byProperty.has(pid)) byProperty.set(pid, []);
    byProperty.get(pid)!.push(r);
  }
  const PROPS: Record<number, string> = { 260955: 'The Namkhan', 1000001: 'Donna Portals' };

  const cell: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${T.border}`, fontSize: 11.5 };
  const hdr: React.CSSProperties = { ...cell, fontWeight: 600, fontSize: 10.5, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '.04em', background: T.bg };

  return (
    <DashboardPage title="Holding · Integrations" subtitle="Platform tools managed by TBC · per-property connection status" tabs={TABS}>
      <div style={{ maxWidth: 960 }}>

        {/* ── PLATFORM TOOLS ── */}
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.inkSoft }}>Platform tools — TBC manages these</div>
        <p style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 20 }}>
          These are provisioned centrally and available to all properties. Add vault secrets in Supabase → Project Settings → Vault.
          Pending tools need API access applied for and key added to vault.
        </p>

        <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden', marginBottom: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Tool', 'Powers', 'Vault key name', 'Status', 'Notes'].map(h => <th key={h} style={{ ...hdr, textAlign: 'left' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {PLATFORM_TOOLS.map(t => (
                <tr key={t.slug} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={cell}><b style={{ color: T.ink }}>{t.name}</b></td>
                  <td style={{ ...cell, color: T.inkSoft, maxWidth: 200 }}>{t.purpose}</td>
                  <td style={{ ...cell }}><code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, background: T.bg, padding: '1px 5px', borderRadius: 2 }}>{t.vault}</code></td>
                  <td style={cell}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <StatusDot status={t.status} />
                      <span style={{ color: t.status === 'ok' ? T.green : t.status === 'pending' ? T.amber : T.grey, fontWeight: 600, fontSize: 10.5 }}>
                        {t.status === 'ok' ? 'Active' : t.status === 'pending' ? 'Pending activation' : 'Dormant'}
                      </span>
                    </span>
                  </td>
                  <td style={{ ...cell, color: T.grey, fontSize: 11 }}>{t.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── PER-PROPERTY CONNECTIONS ── */}
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.inkSoft }}>Property connections — each tenant sets these up</div>
        <p style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 20 }}>
          Each property manages its own PMS, Google ecosystem, finance, and revenue intelligence connections.
          Holding does not have a PMS. View per-property details in the property's own Settings → Data tab.
        </p>

        {[...byProperty.entries()].map(([pid, ints]) => {
          const label = PROPS[pid] ?? `Property ${pid}`;
          const active = ints!.filter(i => i.is_active).length;
          const issues = ints!.filter(i => !i.is_active || (i.last_check_status ?? '').toLowerCase() === 'error').length;
          return (
            <div key={pid} style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</span>
                  <span style={{ marginLeft: 10, fontSize: 10, color: T.inkSoft }}>Property {pid}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: T.green }}>{active} active</span>
                  {issues > 0 && <span style={{ color: T.amber }}>{issues} need attention</span>}
                  <a href={`/h/${pid}/settings/data`} style={{ color: T.forest, textDecoration: 'underline' }}>View details →</a>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ints!.map(i => {
                  const s = (i.last_check_status ?? 'never').toLowerCase();
                  const color = !i.is_active ? T.grey : s === 'ok' ? T.green : s === 'error' ? T.red : T.amber;
                  return (
                    <span key={i.slug} style={{ display: 'flex', alignItems: 'center', fontSize: 10.5, padding: '2px 8px', borderRadius: 2, background: T.bg, border: `1px solid ${T.border}`, color: T.inkSoft }}>
                      <StatusDot status={!i.is_active ? 'dormant' : s === 'ok' ? 'ok' : 'pending'} />
                      {i.name}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── DONNA-SPECIFIC ── */}
        <div style={{ marginTop: 28, marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.inkSoft }}>Donna Portals — specific integrations</div>
        <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{['Integration', 'Purpose', 'Vault key', 'Status', 'Notes'].map(h => <th key={h} style={{ ...hdr, textAlign: 'left' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {DONNA_TOOLS.map(t => (
                <tr key={t.name}>
                  <td style={cell}><b style={{ color: T.ink }}>{t.name}</b></td>
                  <td style={{ ...cell, color: T.inkSoft }}>{t.purpose}</td>
                  <td style={cell}><code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10, background: T.bg, padding: '1px 5px', borderRadius: 2 }}>{t.vault}</code></td>
                  <td style={cell}><span style={{ display: 'flex', alignItems: 'center' }}><StatusDot status={t.status} /><span style={{ color: t.status === 'ok' ? T.green : T.grey, fontWeight: 600, fontSize: 10.5 }}>{t.status === 'ok' ? 'Active' : 'Dormant'}</span></span></td>
                  <td style={{ ...cell, color: T.grey, fontSize: 11 }}>{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, fontSize: 10.5, color: T.inkSoft, lineHeight: 1.6 }}>
          <b>Vault architecture note:</b> All secrets currently in one flat Supabase vault (no per-property isolation).
          Naming convention: holding-level secrets have no prefix (ANTHROPIC_API_KEY), property-level secrets are distinguished by context or name (YT_ACCESS_TOKEN_260955_*).
          Multi-tenant vault isolation is a future migration when Donna requires separate secret management.
        </div>
      </div>
    </DashboardPage>
  );
}
