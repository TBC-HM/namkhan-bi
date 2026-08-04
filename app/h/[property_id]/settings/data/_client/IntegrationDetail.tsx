'use client';
// Expandable integration detail panel — shows full spec, managed_by, vault keys,
// notes, and an action button (edit notes or follow setup guide).
import { useState } from 'react';

const T = {
  bg: '#F4EFE2', paper: '#FFFFFF', ink: '#1B1B1B', inkSoft: '#5A5A5A',
  border: '#E6DFCC', forest: '#1F3A2E', green: '#2E7D32', greenTint: '#DFF0DE',
  amber: '#B48A3A', amberTint: '#FAF6E9', red: '#B03826', redTint: '#F5D5CE', grey: '#8A8A8A',
};

export interface IntDetailProps {
  slug: string;
  name: string;
  managedBy: string;
  purpose: string | null;
  notes: string | null;
  vaultSecretNames: string[] | null;
  websiteUrl: string | null;
  apiDocsUrl: string | null;
  category: string | null;
  isActive: boolean;
  lastCheckStatus: string | null;
  lastCheckAt: string | null;
  linkedSyncEntity: string | null;
  linkedCronName: string | null;
  checkFrequencyHours: number | null;
}

// Per-integration setup guide (internal runbook)
const SETUP_GUIDE: Record<string, { steps: string[]; holdingNote?: string }> = {
  cloudbeds_pms: { steps: ['Log in to Cloudbeds → Settings → API Keys → Generate key', 'Add to Supabase vault: CLOUDBEDS_API_KEY', 'Trigger full sync via /api/cron/sync-cloudbeds'] },
  mews_pms: { steps: ['In Mews Commander → Marketplace → Integrations → Generate connector tokens', 'Add to vault: mews_access_token, mews_client_token, mews_platform_url', 'Activate sync cron'] },
  google_oauth: { steps: ['In Google Cloud Console → Create OAuth 2.0 Client ID', 'Add redirect URI: {vercel-url}/api/google/oauth/callback', 'Add to vault: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET', 'Connect each service (GBP, YouTube, Gmail) separately in its module settings'] },
  gmail_api: { steps: ['Ensure Google OAuth is connected (see above)', 'Enable Gmail API in GCP → APIs & Services → Enable APIs', 'Grant mail.readonly scope in OAuth consent screen', 'Run connection flow in /marketing/audience settings'] },
  gbp_api: { steps: ['Ensure Google OAuth is connected', 'Enable Business Profile API in GCP', 'Grant business.manage scope', 'Connect via /guest/reputation settings'] },
  youtube_data_api: { steps: ['Ensure Google OAuth is connected to the BRAND Google account (not personal)', 'Enable YouTube Data API v3 in GCP', 'Grant yt-force-ssl scope', 'Connect via /marketing/youtube/dashboard'] },
  youtube_analytics_api: { steps: ['Re-connect Google OAuth selecting The Namkhan brand account (not pbsbase@gmail.com)', 'Enable YouTube Analytics API in GCP → APIs & Services', 'Grant yt-analytics.readonly scope', 'This unlocks the Analytics tab in /marketing/youtube'] },
  google_search_console: { steps: ['Enable Search Console API in GCP', 'Add property in search.google.com/search-console', 'Grant service account viewer access', 'Add vault key: GOOGLE_SEARCH_CONSOLE_SITE_URL'] },
  google_analytics_4: { steps: ['Create GA4 property at analytics.google.com', 'Enable Analytics Data API in GCP', 'Add service account as viewer in GA4 property settings', 'Add vault key: GA4_PROPERTY_ID'] },
  quickbooks: { steps: ['Connect QuickBooks in /finance settings', 'Enable weekly GL sync cron', 'Verify USALI mapping in finance.gl_mapping'] },
  lighthouse: { steps: ['Lighthouse is email-based — no API key required', 'Forward daily rate report email to the Namkhan inbox', 'Parser cron picks it up automatically'] },
  anthropic_ai: { holdingNote: 'Managed by TBC · key in vault at holding level · rotated by PBS when needed', steps: [] },
  openai_image: { holdingNote: 'Managed by TBC · key in vault at holding level', steps: [] },
  shotstack: { holdingNote: 'Managed by TBC · key in vault at holding level', steps: [] },
  apify: { holdingNote: 'Managed by TBC · key in vault at holding level · used for competitor research', steps: [] },
  github_bridge: { holdingNote: 'Managed by TBC · PAT in vault · Contents R/W + optional Workflows scope', steps: [] },
  supabase_platform: { holdingNote: 'Managed by TBC · service role key in Vercel env', steps: [] },
  vercel: { holdingNote: 'Managed by TBC · auto-deploy from GitHub main branch', steps: [] },
};

function fmtWhen(ts: string | null) {
  if (!ts) return 'never';
  const h = Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}

export default function IntegrationDetail({ slug, name, managedBy, purpose, notes,
  vaultSecretNames, websiteUrl, apiDocsUrl, category, isActive, lastCheckStatus,
  lastCheckAt, linkedSyncEntity, linkedCronName, checkFrequencyHours }: IntDetailProps) {
  const [open, setOpen] = useState(false);
  const guide = SETUP_GUIDE[slug];

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 10, color: T.forest, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
      >
        {open ? 'Close ▴' : 'Details ▾'}
      </button>

      {open && (
        <div style={{ marginTop: 10, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 3, padding: '12px 14px', fontSize: 11.5 }}>

          {/* Managed by */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: managedBy === 'holding' ? T.grey : T.forest }}>
              {managedBy === 'holding' ? '🏢 Platform managed (TBC)' : '🏨 Property managed (you set this up)'}
            </span>
            {category && <span style={{ color: T.inkSoft }}>Category: {category}</span>}
            {checkFrequencyHours && <span style={{ color: T.inkSoft }}>Probe: every {checkFrequencyHours}h</span>}
          </div>

          {/* Vault keys */}
          {vaultSecretNames && vaultSecretNames.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: T.ink, marginBottom: 4 }}>Supabase vault secrets</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {vaultSecretNames.map(k => (
                  <code key={k} style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 2, padding: '2px 7px', fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }}>{k}</code>
                ))}
              </div>
              <div style={{ fontSize: 10, color: T.grey, marginTop: 4 }}>
                Add/update these in Supabase → Project → Vault · All secrets shared across the platform (no per-property isolation yet — naming convention distinguishes them)
              </div>
            </div>
          )}

          {/* Internal notes */}
          {notes && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: T.ink, marginBottom: 3 }}>Integration notes</div>
              <div style={{ color: T.inkSoft, lineHeight: 1.5 }}>{notes}</div>
            </div>
          )}

          {/* Sync / cron info */}
          {(linkedSyncEntity || linkedCronName) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600, color: T.ink, marginBottom: 3 }}>Sync configuration</div>
              {linkedSyncEntity && <div style={{ color: T.inkSoft }}>Sync entity: <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }}>{linkedSyncEntity}</code></div>}
              {linkedCronName && <div style={{ color: T.inkSoft }}>Cron job: <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5 }}>{linkedCronName}</code></div>}
              <div style={{ color: T.inkSoft }}>Last check: {fmtWhen(lastCheckAt)} · Status: {lastCheckStatus ?? 'never'}</div>
            </div>
          )}

          {/* Setup guide */}
          {guide && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 600, color: T.ink, marginBottom: 6 }}>
                {managedBy === 'holding' ? 'How this is managed' : 'Setup guide'}
              </div>
              {guide.holdingNote ? (
                <div style={{ color: T.inkSoft, fontStyle: 'italic' }}>{guide.holdingNote}</div>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {guide.steps.map((step, i) => (
                    <li key={i} style={{ color: T.inkSoft }}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* External links */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10.5 }}>
            {websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer" style={{ color: T.forest, textDecoration: 'underline' }}>Vendor site →</a>}
            {apiDocsUrl && <a href={apiDocsUrl} target="_blank" rel="noreferrer" style={{ color: T.forest, textDecoration: 'underline' }}>API docs →</a>}
          </div>
        </div>
      )}
    </div>
  );
}
