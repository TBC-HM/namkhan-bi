// app/h/[property_id]/settings/data/page.tsx
// Rebuilt 2026-08-04: module-first layout, property vs platform split,
// email ingest info, expandable detail panels, new AI/media tools.
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import IntegrationDetail from './_client/IntegrationDetail';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const T = {
  bg: '#F4EFE2', paper: '#FFFFFF', ink: '#1B1B1B', inkSoft: '#5A5A5A',
  border: '#E6DFCC', forest: '#1F3A2E', green: '#2E7D32', greenTint: '#DFF0DE',
  amber: '#B48A3A', amberTint: '#FAF6E9', red: '#B03826', redTint: '#F5D5CE', grey: '#8A8A8A',
};

interface IntRow {
  slug: string; name: string; category: string | null; is_active: boolean;
  last_check_status: string | null; purpose: string | null;
  vault_secret_names: string[] | null; notes: string | null;
  last_check_at: string | null; website_url: string | null; api_docs_url: string | null;
  managed_by: string | null;
  linked_sync_entity: string | null; linked_cron_name: string | null;
  check_frequency_hours: number | null;
  email_ingest_enabled: boolean | null;
  email_ingest_address: string | null;
  email_ingest_subject_pattern: string | null;
  email_ingest_from_pattern: string | null;
}

const POWERS: Record<string, string> = {
  cloudbeds_pms:        'Revenue · Pace · F&B · Spa · HR · Guest',
  cloudbeds_transactions:'Folio reconciliation · USALI transactions',
  google_oauth:         'Gateway for Gmail · GBP · Calendar · YouTube',
  gmail_api:            'Newsletter · Inbox pickup · Guest comms · Email ingest',
  gbp_api:              'Reputation · Reviews · Q&A · Google insights',
  google_calendar:      'Retreat scheduling · Meeting availability',
  youtube_data_api:     'YouTube channel · Videos · Playlists · Audit',
  youtube_analytics_api:'YouTube analytics · View counts · Engagement',
  lighthouse:           'Rate shop · Compset pricing intel (daily)',
  quickbooks:           'P&L · GL · USALI · Cost governance (weekly)',
  canva:                'Design tool · Marketing materials · Social graphics · Brand templates',
  anthropic_ai:         'Felix · Lens audit · Newsletter AI · All agents',
  openai_image:         'AI Studio · Image generation (gpt-image-1)',
  ideogram:             'AI image gen — best for text in images · logos · signage',
  runway_ml:            'AI video generation · property clips · social reels',
  google_vertex_ai:     'Google Imagen 3 · Gemini multimodal · photorealistic imagery',
  elevenlabs:           'Voice synthesis · video narration · multilingual audio',
  gemini_video:         'Video understanding · analysis (future)',
  shotstack:            'Video rendering · composition · social clips',
  cloudinary:           'Video transcoding · poster generation (future)',
  apify:                'Competitor research · Booking.com scraping',
  nimble:               'Proxy infrastructure (future)',
  github_bridge:        'Code deploy · PR automation',
  supabase_platform:    'Database · Edge functions · Vault · Storage',
  vercel:               'Frontend · Auto-deploy',
};

// Property-level integrations not yet in DB
const MISSING_PROPERTY = [
  { slug: 'google_search_console', name: 'Google Search Console', powers: 'SEO module · Keyword rankings · Click data', needed: 'Enable Search Console API in GCP → add property → grant service account viewer access', setupUrl: 'https://search.google.com/search-console/' },
  { slug: 'google_analytics_4', name: 'Google Analytics 4 (GA4)', powers: 'Traffic attribution · Channel mix · Conversion tracking', needed: 'Create GA4 property → enable Analytics API in GCP → add service account as viewer', setupUrl: 'https://analytics.google.com/' },
  { slug: 'tripadvisor', name: 'TripAdvisor API (future)', powers: 'Reputation · Review monitoring · Ranking alerts', needed: 'Apply for TripAdvisor API access (waitlist)', setupUrl: 'https://www.tripadvisor.com/developers' },
];

const PLATFORM_SLUGS = new Set(['anthropic_ai','openai_image','ideogram','runway_ml','google_vertex_ai','elevenlabs','gemini_video','shotstack','cloudinary','apify','nimble','github_bridge','supabase_platform','vercel']);
const AI_SLUGS = new Set(['anthropic_ai','openai_image','ideogram','runway_ml','google_vertex_ai','elevenlabs','gemini_video','shotstack','cloudinary']);
const GOOGLE_SLUGS = new Set(['google_oauth','gmail_api','gbp_api','google_calendar','youtube_data_api','youtube_analytics_api']);

function statusBadge(status: string | null, isActive: boolean) {
  if (!isActive) return { label: 'DORMANT', bg: T.bg, fg: T.grey };
  const s = (status ?? 'never').toLowerCase();
  if (s === 'ok' || s === 'success') return { label: 'OK', bg: T.greenTint, fg: T.green };
  if (s === 'error') return { label: 'ERROR', bg: T.redTint, fg: T.red };
  if (s === 'missing_secret') return { label: 'SECRET MISSING', bg: T.amberTint, fg: T.amber };
  if (s === 'warning') return { label: 'WARNING', bg: T.amberTint, fg: T.amber };
  return { label: 'NEVER', bg: T.bg, fg: T.grey };
}

function fmtWhen(ts: string | null) {
  if (!ts) return 'never';
  const h = Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

function EmailBadge({ r }: { r: IntRow }) {
  if (!r.email_ingest_enabled) return null;
  return (
    <div style={{ marginTop: 8, background: T.amberTint, border: `1px solid ${T.amber}`, borderRadius: 3, padding: '8px 10px', fontSize: 11 }}>
      <div style={{ fontWeight: 600, color: T.amber, marginBottom: 4 }}>📧 Email ingest active</div>
      <div style={{ color: T.inkSoft, marginBottom: 2 }}>Forward reports to: <code style={{ fontFamily: 'ui-monospace,monospace', background: T.paper, padding: '1px 5px', borderRadius: 2 }}>{r.email_ingest_address}</code></div>
      {r.email_ingest_subject_pattern && <div style={{ color: T.inkSoft, marginBottom: 2 }}>Subject must match: <code style={{ fontFamily: 'ui-monospace,monospace', background: T.paper, padding: '1px 5px', borderRadius: 2 }}>{r.email_ingest_subject_pattern}</code></div>}
      {r.email_ingest_from_pattern && <div style={{ color: T.grey, fontSize: 10 }}>Sender: {r.email_ingest_from_pattern} · Gmail scan cron picks up automatically · uses existing email pickup infrastructure</div>}
    </div>
  );
}

function IntCard({ r, nested }: { r: IntRow; nested?: boolean }) {
  const badge = statusBadge(r.last_check_status, r.is_active);
  return (
    <div style={{ background: nested ? T.bg : T.paper, border: `1px solid ${T.border}`, borderRadius: 3, padding: '11px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{r.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: badge.bg, color: badge.fg }}>{badge.label}</span>
            {r.email_ingest_enabled && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 2, background: T.amberTint, color: T.amber, fontWeight: 600 }}>📧 EMAIL</span>}
          </div>
          {POWERS[r.slug] && <div style={{ fontSize: 11, color: T.forest, marginTop: 2 }}>Powers: {POWERS[r.slug]}</div>}
          {r.purpose && <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 2 }}>{r.purpose}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 10, color: T.grey, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>Last check: {fmtWhen(r.last_check_at)}</span>
            {r.vault_secret_names && r.vault_secret_names.length > 0 && (
              <span>Vault: {r.vault_secret_names.map(s => <code key={s} style={{ background: T.bg, borderRadius: 2, padding: '0 3px', marginRight: 3, fontFamily: 'ui-monospace,monospace', fontSize: 9.5 }}>{s}</code>)}</span>
            )}
          </div>
          <EmailBadge r={r} />
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <IntegrationDetail
          slug={r.slug} name={r.name} managedBy={r.managed_by ?? 'property'}
          purpose={r.purpose} notes={r.notes}
          vaultSecretNames={r.vault_secret_names} websiteUrl={r.website_url}
          apiDocsUrl={r.api_docs_url} category={r.category} isActive={r.is_active}
          lastCheckStatus={r.last_check_status} lastCheckAt={r.last_check_at}
          linkedSyncEntity={r.linked_sync_entity} linkedCronName={r.linked_cron_name}
          checkFrequencyHours={r.check_frequency_hours}
        />
      </div>
    </div>
  );
}

function MissingCard({ item }: { item: typeof MISSING_PROPERTY[0] }) {
  return (
    <div style={{ background: T.paper, border: `1px dashed ${T.border}`, borderRadius: 3, padding: '11px 14px', opacity: 0.85 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{item.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: T.bg, color: T.grey }}>NOT CONFIGURED</span>
      </div>
      <div style={{ fontSize: 11, color: T.forest, marginTop: 2 }}>Powers: {item.powers}</div>
      <div style={{ fontSize: 10.5, color: T.grey, marginTop: 3 }}>{item.needed}</div>
      <a href={item.setupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.forest, textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}>Set up →</a>
    </div>
  );
}

function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>{title}</h2>
        {count !== undefined && <span style={{ fontSize: 10, color: T.grey }}>{count}</span>}
      </div>
      <p style={{ fontSize: 11.5, color: T.inkSoft, margin: '2px 0 0' }}>{subtitle}</p>
    </div>
  );
}

export default async function DataSettingsPage({ params }: { params: { property_id: string } }) {
  const propertyId = Number(params.property_id);
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_property_data_integrations')
    .select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as IntRow[];

  const activeRows = rows.filter(r => r.is_active);
  const platformRows = rows.filter(r => PLATFORM_SLUGS.has(r.slug));
  const propertyRows = rows.filter(r => !PLATFORM_SLUGS.has(r.slug) && r.is_active);
  const googleRows = rows.filter(r => GOOGLE_SLUGS.has(r.slug));
  const pmsRows = rows.filter(r => r.category === 'pms' && r.is_active);
  const financeRows = rows.filter(r => ['quickbooks'].includes(r.slug));
  const revenueRows = rows.filter(r => ['lighthouse'].includes(r.slug));
  const canvaRow = rows.filter(r => r.slug === 'canva');
  const aiPlatformRows = rows.filter(r => AI_SLUGS.has(r.slug));
  const infraPlatformRows = rows.filter(r => PLATFORM_SLUGS.has(r.slug) && !AI_SLUGS.has(r.slug));

  const okCount = activeRows.filter(r => (r.last_check_status ?? '').toLowerCase() === 'ok').length;
  const issueCount = rows.filter(r => !r.is_active && !PLATFORM_SLUGS.has(r.slug)).length + MISSING_PROPERTY.length;

  const tabs = [
    { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property`   },
    { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media`      },
    { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
    { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
    { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data`, active: true },
    { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain`      },
    { key: 'knowledge',  label: 'Knowledge',  href: `/h/${propertyId}/settings/knowledge`  },
  ];

  const sec: React.CSSProperties = { marginBottom: 28 };
  const grid: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };

  return (
    <DashboardPage title="Settings · Data" subtitle="Data connections · integrations · API health" tabs={tabs}>
      <div style={{ maxWidth: 900 }}>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 28 }}>
          {[
            { l: 'Active & healthy', v: okCount, color: T.green },
            { l: 'Needs attention', v: issueCount, color: issueCount > 0 ? T.amber : T.grey },
            { l: 'Platform managed', v: platformRows.length, color: T.grey },
          ].map(t => (
            <div key={t.l} style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: T.inkSoft, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{t.l}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: t.color }}>{t.v}</div>
            </div>
          ))}
        </div>

        {/* ── YOUR INTEGRATIONS ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.inkSoft, marginBottom: 16 }}>
          Your integrations — set up by property
        </div>

        {/* PMS */}
        {pmsRows.length > 0 && (
          <div style={sec}>
            <SectionHeader title="PMS & Reservations" subtitle="Source of truth for all booking data — revenue, rooms, guests, folios." count={pmsRows.length} />
            <div style={grid}>{pmsRows.map(r => <IntCard key={r.slug} r={r} />)}</div>
          </div>
        )}

        {/* Finance */}
        <div style={sec}>
          <SectionHeader title="Finance & Accounting" subtitle="P&L, GL, USALI cost structure. QuickBooks exports ingested weekly via email." count={financeRows.length} />
          <div style={grid}>{financeRows.map(r => <IntCard key={r.slug} r={r} />)}</div>
        </div>

        {/* Google Ecosystem */}
        <div style={sec}>
          <SectionHeader title="Google Ecosystem" subtitle="One OAuth connection — each service requires its API enabled in Google Cloud Console." count={googleRows.length + 2} />
          <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.bg, fontSize: 11, fontWeight: 600, color: T.ink }}>
              OAuth gateway — all Google services share this connection
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {googleRows.map(r => <IntCard key={r.slug} r={r} nested />)}
              <MissingCard item={{ slug: 'google_search_console', name: 'Google Search Console', powers: 'SEO module · Keyword rankings · Click data', needed: 'Enable Search Console API in GCP → add property → grant service account viewer access', setupUrl: 'https://search.google.com/search-console/' }} />
              <MissingCard item={{ slug: 'google_analytics_4', name: 'Google Analytics 4 (GA4)', powers: 'Traffic attribution · Channel mix · Conversion tracking', needed: 'Create GA4 property → enable Analytics API in GCP → add service account as viewer', setupUrl: 'https://analytics.google.com/' }} />
            </div>
          </div>
        </div>

        {/* Revenue Intelligence */}
        <div style={sec}>
          <SectionHeader title="Revenue Intelligence" subtitle="Lighthouse rate shop ingested daily via email — no API key required." count={revenueRows.length} />
          <div style={grid}>{revenueRows.map(r => <IntCard key={r.slug} r={r} />)}</div>
        </div>

        {/* Design & Content */}
        {canvaRow.length > 0 && (
          <div style={sec}>
            <SectionHeader title="Design & Content Tools" subtitle="Canva Connect API for brand-consistent marketing materials." count={canvaRow.length} />
            <div style={grid}>{canvaRow.map(r => <IntCard key={r.slug} r={r} />)}</div>
          </div>
        )}

        {/* ── PLATFORM INTEGRATIONS ── */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: T.inkSoft, marginBottom: 4 }}>
          Platform integrations — managed by TBC
        </div>
        <p style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 16 }}>
          Provisioned centrally. No action required from you. Namkhan can request activation of dormant tools.
        </p>

        {/* AI & Generation */}
        <div style={sec}>
          <SectionHeader title="AI & Media Generation" subtitle="Claude for all agents · OpenAI + Ideogram for images · Runway + Shotstack for video · ElevenLabs for voice · Google Vertex AI / Imagen 3" />
          <div style={grid}>{aiPlatformRows.map(r => <IntCard key={r.slug} r={r} />)}</div>
        </div>

        {/* Infrastructure */}
        <div style={sec}>
          <SectionHeader title="Infrastructure & Data Collection" subtitle="GitHub deploys code · Supabase stores everything · Apify scrapes competitor data." />
          <div style={grid}>{infraPlatformRows.map(r => <IntCard key={r.slug} r={r} />)}</div>
        </div>

        <div style={{ fontSize: 10, color: T.grey, textAlign: 'center', paddingTop: 8 }}>
          Probe cadence: daily 06:00 Vientiane · Email ingest via Gmail scan cron · {rows.filter(r => r.is_active).length} active integrations
        </div>
      </div>
    </DashboardPage>
  );
}
