// app/h/[property_id]/settings/data/page.tsx
// Rebuilt 2026-08-04: subtab navigation at top to prevent endless scrolling.
// URL: ?tab=pms|finance|google|revenue|content|ai|infra
import { DashboardPage } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import IntegrationDetail from './_client/IntegrationDetail';
import Link from 'next/link';

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
  managed_by: string | null; linked_sync_entity: string | null;
  linked_cron_name: string | null; check_frequency_hours: number | null;
  email_ingest_enabled: boolean | null; email_ingest_address: string | null;
  email_ingest_subject_pattern: string | null; email_ingest_from_pattern: string | null;
}

const POWERS: Record<string, string> = {
  cloudbeds_pms: 'Revenue · Pace · F&B · Spa · HR · Guest',
  cloudbeds_transactions: 'Folio reconciliation · USALI transactions',
  google_oauth: 'Gateway for Gmail · GBP · Calendar · YouTube',
  gmail_api: 'Newsletter · Inbox pickup · Guest comms · Email ingest',
  gbp_api: 'Reputation · Reviews · Q&A · Google insights',
  google_calendar: 'Retreat scheduling · Meeting availability',
  youtube_data_api: 'YouTube channel · Videos · Playlists · Audit',
  youtube_analytics_api: 'YouTube analytics · View counts · Engagement',
  lighthouse: 'Rate shop · Compset pricing intel (daily)',
  quickbooks: 'P&L · GL · USALI · Cost governance (weekly)',
  canva: 'Design tool · Marketing materials · Social graphics',
  anthropic_ai: 'Felix · Lens audit · Newsletter AI · All Claude-powered agents',
  openai_image: 'AI image generation (gpt-image-1) · AI Studio',
  openai_gpt: 'GPT-4o text reasoning · fallback LLM · complex analysis',
  mistral_ai: 'Fast inference · multilingual comms · high-volume tasks',
  google_gemini_pro: 'Gemini 1.5 Pro · multimodal · 1M token context · video understanding',
  deepseek: 'High-capability reasoning at low cost · code + analysis',
  ideogram: 'AI image gen — best for text in images · logos · signage',
  runway_ml: 'AI video generation · property clips · social reels',
  google_vertex_ai: 'Google Imagen 3 · photorealistic imagery',
  elevenlabs: 'Voice synthesis · video narration · audio content',
  gemini_video: 'Video analysis (future)',
  shotstack: 'Video rendering · composition · social clips',
  cloudinary: 'Video transcoding (future)',
  apify: 'Competitor research · Booking.com scraping',
  nimble: 'Proxy infrastructure (future)',
  github_bridge: 'Code deploy · PR automation',
  supabase_platform: 'Database · Edge functions · Vault · Storage',
  vercel: 'Frontend · Auto-deploy',
};

const PLATFORM_SLUGS = new Set(['anthropic_ai','openai_image','openai_gpt','mistral_ai','google_gemini_pro','deepseek','ideogram','runway_ml','google_vertex_ai','elevenlabs','gemini_video','shotstack','cloudinary','apify','nimble','github_bridge','supabase_platform','vercel']);
const AI_SLUGS = new Set(['anthropic_ai','openai_image','openai_gpt','mistral_ai','google_gemini_pro','deepseek','ideogram','runway_ml','google_vertex_ai','elevenlabs','gemini_video','shotstack','cloudinary']);
const GOOGLE_SLUGS = new Set(['google_oauth','gmail_api','gbp_api','google_calendar','youtube_data_api','youtube_analytics_api']);

const TABS = [
  { id: 'pms',     label: 'PMS',           desc: 'Reservations & bookings' },
  { id: 'finance', label: 'Finance',        desc: 'Accounting & payments' },
  { id: 'google',  label: 'Google',         desc: 'OAuth · Gmail · GBP · YouTube' },
  { id: 'revenue', label: 'Revenue Intel',  desc: 'Rate shop & compset' },
  { id: 'content', label: 'Content',        desc: 'Design tools' },
  { id: 'ai',      label: 'AI & LLMs',      desc: 'Platform-managed models' },
  { id: 'infra',   label: 'Infrastructure', desc: 'Platform-managed infra' },
];

const MISSING_BY_TAB: Record<string, Array<{ slug: string; name: string; powers: string; needed: string; setupUrl: string }>> = {
  google: [
    { slug: 'google_search_console', name: 'Google Search Console', powers: 'SEO module · rankings · click data', needed: 'Enable API in GCP → add property → grant service account viewer', setupUrl: 'https://search.google.com/search-console/' },
    { slug: 'google_analytics_4', name: 'Google Analytics 4', powers: 'Traffic attribution · channel mix · conversions', needed: 'Create GA4 property → enable Analytics API → add service account', setupUrl: 'https://analytics.google.com/' },
  ],
};

function statusBadge(status: string | null, isActive: boolean) {
  if (!isActive) return { label: 'DORMANT', bg: T.bg, fg: T.grey };
  const s = (status ?? 'never').toLowerCase();
  if (s === 'ok' || s === 'success') return { label: 'OK', bg: T.greenTint, fg: T.green };
  if (s === 'error') return { label: 'ERROR', bg: T.redTint, fg: T.red };
  if (s === 'missing_secret') return { label: 'SECRET MISSING', bg: T.amberTint, fg: T.amber };
  return { label: 'NEVER', bg: T.bg, fg: T.grey };
}

function fmtWhen(ts: string | null) {
  if (!ts) return 'never';
  const h = Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

function EmailBlock({ r }: { r: IntRow }) {
  if (!r.email_ingest_enabled) return null;
  return (
    <div style={{ marginTop: 8, background: T.amberTint, border: `1px solid ${T.amber}`, borderRadius: 3, padding: '8px 10px', fontSize: 11 }}>
      <b style={{ color: T.amber }}>📧 Email ingest active</b>
      <div style={{ color: T.inkSoft, marginTop: 2 }}>Forward to: <code style={{ fontFamily: 'ui-monospace,monospace', background: T.paper, padding: '1px 5px', borderRadius: 2 }}>{r.email_ingest_address}</code></div>
      {r.email_ingest_subject_pattern && <div style={{ color: T.inkSoft }}>Subject matches: <code style={{ fontFamily: 'ui-monospace,monospace', background: T.paper, padding: '1px 5px', borderRadius: 2 }}>{r.email_ingest_subject_pattern}</code></div>}
      <div style={{ color: T.grey, fontSize: 10, marginTop: 2 }}>Picked up automatically by Gmail scan cron · uses existing email pickup infrastructure</div>
    </div>
  );
}

function IntCard({ r, nested }: { r: IntRow; nested?: boolean }) {
  const badge = statusBadge(r.last_check_status, r.is_active);
  return (
    <div style={{ background: nested ? T.bg : T.paper, border: `1px solid ${T.border}`, borderRadius: 3, padding: '11px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{r.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: badge.bg, color: badge.fg }}>{badge.label}</span>
        {r.email_ingest_enabled && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 2, background: T.amberTint, color: T.amber, fontWeight: 600 }}>📧 EMAIL</span>}
        {r.managed_by === 'holding' && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: T.bg, color: T.grey, border: `1px solid ${T.border}` }}>PLATFORM</span>}
      </div>
      {POWERS[r.slug] && <div style={{ fontSize: 11, color: T.forest, marginBottom: 2 }}>Powers: {POWERS[r.slug]}</div>}
      {r.purpose && <div style={{ fontSize: 11, color: T.inkSoft }}>{r.purpose}</div>}
      <div style={{ fontSize: 10, color: T.grey, marginTop: 4 }}>Last check: {fmtWhen(r.last_check_at)}{r.vault_secret_names?.length ? ` · vault: ${r.vault_secret_names.join(', ')}` : ''}</div>
      <EmailBlock r={r} />
      <div style={{ marginTop: 8 }}>
        <IntegrationDetail slug={r.slug} name={r.name} managedBy={r.managed_by ?? 'property'}
          purpose={r.purpose} notes={r.notes} vaultSecretNames={r.vault_secret_names}
          websiteUrl={r.website_url} apiDocsUrl={r.api_docs_url} category={r.category}
          isActive={r.is_active} lastCheckStatus={r.last_check_status} lastCheckAt={r.last_check_at}
          linkedSyncEntity={r.linked_sync_entity} linkedCronName={r.linked_cron_name}
          checkFrequencyHours={r.check_frequency_hours} />
      </div>
    </div>
  );
}

function MissingCard({ item }: { item: { name: string; powers: string; needed: string; setupUrl: string } }) {
  return (
    <div style={{ background: T.paper, border: `1px dashed ${T.border}`, borderRadius: 3, padding: '10px 14px', opacity: 0.85 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft }}>{item.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 2, background: T.bg, color: T.grey }}>NOT CONFIGURED</span>
      </div>
      <div style={{ fontSize: 11, color: T.forest, marginTop: 2 }}>{item.powers}</div>
      <div style={{ fontSize: 10.5, color: T.grey, marginTop: 2 }}>{item.needed}</div>
      <a href={item.setupUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: T.forest, textDecoration: 'underline', display: 'inline-block', marginTop: 4 }}>Set up →</a>
    </div>
  );
}

export default async function DataSettingsPage({
  params, searchParams,
}: { params: { property_id: string }; searchParams: { tab?: string } }) {
  const propertyId = Number(params.property_id);
  const activeTab = searchParams.tab ?? 'pms';
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('v_property_data_integrations')
    .select('*').eq('property_id', propertyId).order('display_order', { ascending: true, nullsFirst: false });
  const rows = (data ?? []) as IntRow[];
  const bySlug = new Map(rows.map(r => [r.slug, r]));

  const TAB_ROWS: Record<string, IntRow[]> = {
    pms: rows.filter(r => r.category === 'pms' && r.is_active),
    finance: rows.filter(r => ['quickbooks'].includes(r.slug)),
    google: rows.filter(r => GOOGLE_SLUGS.has(r.slug)),
    revenue: rows.filter(r => ['lighthouse'].includes(r.slug)),
    content: rows.filter(r => ['canva'].includes(r.slug)),
    ai: rows.filter(r => AI_SLUGS.has(r.slug)),
    infra: rows.filter(r => PLATFORM_SLUGS.has(r.slug) && !AI_SLUGS.has(r.slug)),
  };

  const currentRows = TAB_ROWS[activeTab] ?? [];
  const missing = MISSING_BY_TAB[activeTab] ?? [];

  const baseHref = `/h/${propertyId}/settings/data`;
  const okCount = rows.filter(r => r.is_active && (r.last_check_status ?? '').toLowerCase() === 'ok').length;

  const settingsTabs = [
    { key: 'property',   label: 'Property',   href: `/h/${propertyId}/settings/property` },
    { key: 'media',      label: 'Media',      href: `/h/${propertyId}/settings/media` },
    { key: 'rate_plans', label: 'Rate Plans', href: `/h/${propertyId}/settings/rate-plans` },
    { key: 'guardrails', label: 'Guardrails', href: `/h/${propertyId}/settings/guardrails` },
    { key: 'data',       label: 'Data',       href: `/h/${propertyId}/settings/data`, active: true },
    { key: 'brain',      label: 'Brain',      href: `/h/${propertyId}/settings/brain` },
    { key: 'knowledge',  label: 'Knowledge',  href: `/h/${propertyId}/settings/knowledge` },
  ];

  return (
    <DashboardPage title="Settings · Data" subtitle={`${okCount} active connections · ${rows.length} registered`} tabs={settingsTabs}>
      <div style={{ maxWidth: 860 }}>

        {/* Section subtabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 24, overflowX: 'auto' }}>
          {TABS.map(t => (
            <Link key={t.id} href={`${baseHref}?tab=${t.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                color: activeTab === t.id ? T.forest : T.inkSoft,
                borderBottom: activeTab === t.id ? `2px solid ${T.forest}` : '2px solid transparent',
                background: 'transparent',
              }}>
                {t.label}
                <div style={{ fontSize: 9, fontWeight: 400, color: T.grey, marginTop: 1 }}>{t.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Current tab content */}
        {activeTab === 'google' ? (
          // Google: nested inside gateway card
          <div>
            <div style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: T.bg, fontSize: 11, fontWeight: 600, color: T.ink }}>
                OAuth gateway — all Google services share one connection
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentRows.map(r => <IntCard key={r.slug} r={r} nested />)}
                {missing.map(m => <MissingCard key={m.slug} item={m} />)}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 10.5, color: T.inkSoft }}>
              One Google Cloud project → one OAuth client → enable each service API separately in GCP.
              Missing services require enabling the API in GCP console + granting the correct OAuth scope.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentRows.map(r => <IntCard key={r.slug} r={r} />)}
            {missing.map(m => <MissingCard key={m.slug} item={m} />)}
            {currentRows.length === 0 && missing.length === 0 && (
              <div style={{ color: T.inkSoft, fontSize: 12, padding: '20px 0' }}>No integrations in this category yet.</div>
            )}
          </div>
        )}

        {/* Email ingest note on relevant tabs */}
        {['finance','revenue'].includes(activeTab) && (
          <div style={{ marginTop: 16, background: T.amberTint, border: `1px solid ${T.amber}`, borderRadius: 3, padding: '10px 14px', fontSize: 11.5 }}>
            <b style={{ color: T.amber }}>📧 Email ingest</b>
            <span style={{ color: T.inkSoft, marginLeft: 8 }}>
              These integrations are email-based — no API key required. Configure the email address and subject pattern above (expand "Details ▾").
              The Gmail scan cron picks up matching emails automatically using the same pickup infrastructure as newsletters.
            </span>
          </div>
        )}

        {/* Platform note on AI/infra tabs */}
        {['ai','infra'].includes(activeTab) && (
          <div style={{ marginTop: 16, fontSize: 10.5, color: T.inkSoft }}>
            🏢 Platform-managed · provisioned centrally by TBC · no setup required from property ·
            <Link href="/holding/settings/integrations" style={{ color: T.forest, textDecoration: 'underline', marginLeft: 4 }}>
              View holding integrations →
            </Link>
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 10, color: T.grey }}>
          Probe cadence: daily 06:00 Vientiane · {rows.filter(r => r.is_active).length} active · {rows.length} total registered
        </div>
      </div>
    </DashboardPage>
  );
}
