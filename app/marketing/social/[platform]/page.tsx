// app/marketing/social/[platform]/page.tsx
// PBS 2026-05-09 #30: "Make a landing page for every social media profile we
// have (like the other landing pages we have for channels f.e.)". Dynamic
// route that re-uses marketing.social_accounts as the data source.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getSocialAccounts } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_business: 'Google Business',
  tripadvisor: 'TripAdvisor',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X / Twitter',
  threads: 'Threads',
  pinterest: 'Pinterest',
};

const PLATFORM_TINT: Record<string, { bg: string; fg: string }> = {
  instagram:       { bg: '#E4405F', fg: '#fff' },
  facebook:        { bg: '#1877F2', fg: '#fff' },
  tiktok:          { bg: '#25F4EE', fg: '#000' },
  google_business: { bg: '#4285F4', fg: '#fff' },
  tripadvisor:     { bg: '#34E0A1', fg: '#000' },
  youtube:         { bg: '#FF0000', fg: '#fff' },
  linkedin:        { bg: '#0A66C2', fg: '#fff' },
  x:               { bg: '#000000', fg: '#fff' },
  threads:         { bg: '#101010', fg: '#fff' },
  pinterest:       { bg: '#E60023', fg: '#fff' },
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  params: { platform: string };
}

export default async function SocialPlatformPage({ params }: Props) {
  const platform = decodeURIComponent(params.platform).toLowerCase();
  const all = await getSocialAccounts();
  const account = all.find((a: any) => a.platform.toLowerCase() === platform);

  if (!account) {
    notFound();
  }

  const label = PLATFORM_LABEL[account.platform] ?? account.platform;
  const tint = PLATFORM_TINT[account.platform] ?? { bg: '#a8854a', fg: '#0a0a0a' };

  const eyebrow = `Marketing · Social · ${label}`;
  const title = (
    <>
      {label} <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>{account.handle ?? '—'}</em>
    </>
  );

  return (
    <Page eyebrow={eyebrow} title={title} subPages={MARKETING_SUBPAGES}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span aria-hidden style={{
          width: 36, height: 36, borderRadius: 8,
          background: tint.bg, color: tint.fg,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 18, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{label.charAt(0).toUpperCase()}</span>
        {account.url && (
          <a
            href={account.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--brass)',
              border: '1px solid #2a2520',
              padding: '6px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Open public profile ↗
          </a>
        )}
        <Link
          href="/marketing/social"
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11, color: 'var(--ink-mute)', textDecoration: 'none',
          }}
        >
          ← all channels
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={account.followers ?? 0} unit="count"  label="Followers"  tooltip={`Followers count from ${label}; manual until API sync wired.`} />
        <KpiBox value={account.posts ?? 0}     unit="count"  label="Posts"      tooltip="Total posts on this account." />
        <KpiBox value={null} unit="text"
          valueText={account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : '—'}
          label="Last synced"
          tooltip={`Last platform sync: ${fmtDate(account.last_synced_at)}`}
        />
        <KpiBox value={null} unit="text"
          valueText={account.active ? 'active' : 'inactive'}
          label="Status"
          tooltip={`marketing.social_accounts.active flag. Inactive accounts are hidden from /marketing/social.`}
        />
      </div>

      <Panel
        title="Profile"
        eyebrow="marketing.social_accounts"
        actions={<ArtifactActions context={{ kind: 'panel', title: `${label} profile`, dept: 'marketing' }} />}
      >
        <dl style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 8, columnGap: 14, fontSize: 13, margin: 0 }}>
          <dt style={S.dt}>Platform</dt>           <dd style={S.dd}>{label}</dd>
          <dt style={S.dt}>Handle</dt>             <dd style={S.dd}>{account.handle ?? '—'}</dd>
          <dt style={S.dt}>Display name</dt>       <dd style={S.dd}>{account.display_name ?? '—'}</dd>
          <dt style={S.dt}>URL</dt>
          <dd style={S.dd}>
            {account.url ? <a href={account.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>{account.url}</a> : '—'}
          </dd>
          <dt style={S.dt}>Followers</dt>          <dd style={S.dd}>{(account.followers ?? 0).toLocaleString()}</dd>
          <dt style={S.dt}>Posts</dt>              <dd style={S.dd}>{(account.posts ?? 0).toLocaleString()}</dd>
          <dt style={S.dt}>Last sync</dt>          <dd style={S.dd}>{fmtDate(account.last_synced_at)}</dd>
          <dt style={S.dt}>Last sync status</dt>   <dd style={S.dd}>{account.last_sync_status ?? '—'}</dd>
          <dt style={S.dt}>Last sync error</dt>    <dd style={S.dd}>{account.last_sync_error ?? '—'}</dd>
          <dt style={S.dt}>Notes</dt>              <dd style={S.dd}>{(account as any).notes ?? '—'}</dd>
        </dl>
      </Panel>

      <div style={{ height: 14 }} />

      <Panel
        title="Content actions"
        eyebrow="quick links"
        actions={<ArtifactActions context={{ kind: 'panel', title: `${label} content actions`, dept: 'marketing' }} />}
      >
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#d8cca8', lineHeight: 1.7 }}>
          <li>
            <Link href={`/marketing/library?tag=${encodeURIComponent(account.platform)}`} style={S.link}>
              Browse media library tagged for {label} →
            </Link>
          </li>
          <li>
            <Link href={`/marketing/campaigns?channel=${encodeURIComponent(account.platform)}`} style={S.link}>
              Open {label} campaigns →
            </Link>
          </li>
          <li>
            <Link href="/marketing/social" style={S.link}>
              Back to all social channels →
            </Link>
          </li>
        </ul>
      </Panel>
    </Page>
  );
}

const S: Record<string, React.CSSProperties> = {
  dt: { color: '#7d7565', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.10em' },
  dd: { color: '#e9e1ce', margin: 0 },
  link: { color: 'var(--brass)', textDecoration: 'none', fontWeight: 600 },
};
