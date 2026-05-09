// app/marketing/campaigns/page.tsx
// Brand & Marketing · Campaigns — list of all campaigns by status.

import Link from 'next/link';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getCampaigns, CHANNEL_LABEL, STATUS_COLOR, type CampaignStatus } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const STATUS_TABS: Array<{ key: CampaignStatus | ''; label: string }> = [
  { key: '',                 label: 'All' },
  { key: 'draft',            label: 'Drafts' },
  { key: 'pending_approval', label: 'Pending' },
  { key: 'scheduled',        label: 'Scheduled' },
  { key: 'published',        label: 'Published' },
];

interface SP { searchParams?: Record<string, string | string[] | undefined> }

export default async function CampaignsPage({ searchParams }: SP) {
  const status = (typeof searchParams?.status === 'string' ? searchParams.status : '') as CampaignStatus | '';
  const campaigns = await getCampaigns(status ? { status } : {});

  const counts = {
    all:        await getCampaigns().then(c => c.length),
    drafts:     campaigns.filter(c => c.status === 'draft').length,
    pending:    campaigns.filter(c => c.status === 'pending_approval').length,
    scheduled:  campaigns.filter(c => c.status === 'scheduled').length,
    published:  campaigns.filter(c => c.status === 'published').length,
  };

  return (
    <Page
      eyebrow="Marketing · Campaigns"
      title={<>Outbound <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>campaigns</em>.</>}
      subPages={MARKETING_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={counts.all}        unit="count" label="Total"      tooltip="All campaigns in marketing.campaigns regardless of status." />
        <KpiBox value={counts.drafts}     unit="count" label="Drafts"     tooltip="status IN ('draft','curating','composing','pending_approval'). Awaiting human input." />
        <KpiBox value={counts.scheduled}  unit="count" label="Scheduled"  tooltip="status='scheduled' — approved + queued to publish at a future time." />
        <KpiBox value={counts.published}  unit="count" label="Published"  tooltip="status='published' — already live on a channel." />
      </div>

      <Panel
        title={`All campaigns${status ? ` · ${status}` : ''}`}
        eyebrow="marketing.v_campaign_calendar"
        actions={<>
          <Link href="/marketing/campaigns/new" className="btn" style={{ fontSize: 'var(--t-sm)', textDecoration: 'none', background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)' }}>
            + new
          </Link>
          <ArtifactActions context={{ kind: 'table', title: 'Campaigns', dept: 'marketing' }} />
        </>}
      >
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {STATUS_TABS.map(t => {
            const active = status === t.key;
            return (
              <Link
                key={t.key || 'all'}
                href={t.key ? `/marketing/campaigns?status=${t.key}` : '/marketing/campaigns'}
                className="btn"
                style={{
                  fontSize: "var(--t-sm)",
                  textDecoration: 'none',
                  background: active ? 'var(--moss)' : 'var(--paper-warm)',
                  color: active ? 'var(--paper-warm)' : 'var(--ink)',
                  borderColor: active ? 'var(--moss)' : 'var(--line)',
                }}
              >{t.label}</Link>
            );
          })}
        </div>

        {campaigns.length === 0 ? (
          <div className="stub" style={{ padding: 32, textAlign: 'center' }}>
            <h3>No campaigns yet</h3>
            <p>Build your first campaign in 4 minutes — pick a channel, brief one sentence, AI proposes assets, you approve and download.</p>
            <p style={{ marginTop: 12 }}>
              <Link href="/marketing/campaigns/new" className="btn" style={{ fontSize: "var(--t-sm)", textDecoration: 'none', background: 'var(--moss)', color: 'var(--paper-warm)', borderColor: 'var(--moss)' }}>
                start a campaign →
              </Link>
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th className="num">Assets</th>
                <th>Status</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const sc = STATUS_COLOR[c.status];
                return (
                  <tr key={c.campaign_id}>
                    <td className="lbl">
                      <Link href={`/marketing/campaigns/${c.campaign_id}`} style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>
                        {c.name}
                      </Link>
                      {c.brief_text && <div style={{ fontSize: "var(--t-sm)", color: 'var(--ink-mute)', marginTop: 2, fontStyle: 'italic' }}>{c.brief_text.slice(0, 80)}{c.brief_text.length > 80 ? '…' : ''}</div>}
                    </td>
                    <td style={{ fontSize: "var(--t-base)" }}>{CHANNEL_LABEL[c.channel]}</td>
                    <td className="num">{c.asset_count}</td>
                    <td><span className="pill" style={{ background: sc.bg, color: sc.tx }}>{sc.label}</span></td>
                    <td style={{ fontSize: "var(--t-sm)", color: 'var(--ink-mute)' }}>
                      {c.calendar_at ? new Date(c.calendar_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/marketing/campaigns/${c.campaign_id}`} style={{ fontSize: "var(--t-sm)", color: 'var(--moss)' }}>open ↗</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  );
}
