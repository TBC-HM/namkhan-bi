// app/marketing/campaigns/page.tsx
// PBS 2026-07-05: Campaigns hub — new paper-white design.
// Migrated from legacy <Page>+<KpiBox>+<Panel> shell to DashboardPage+KpiTile.
//
// Data source:
//   • getCampaigns() → mkt_v_campaign_calendar (Supabase view).
//     Per PBS design contract: view is not yet seeded with a live campaign feed
//     (the underlying table is empty on Namkhan prod). Banner flags the state
//     so numbers here shouldn't be taken as marketing truth yet.
//
// KPI list: Total · Drafts · Pending · Scheduled · Published · Archived.
// Preserves: status-tab filter (?status=X), asset counts, channel labels,
// STATUS_COLOR pills, deep links into /marketing/campaigns/[id], "+ new"
// CTA into /marketing/campaigns/new.

import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  DashboardPage, KpiTile,
  type DashboardTab, type KpiTileProps,
} from '@/app/(cockpit)/_design';
import {
  getCampaigns, CHANNEL_LABEL, STATUS_COLOR, type CampaignStatus,
} from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const CREAM = '#F7F0E1';
const FOREST= '#084838';
const RED   = '#B03826';
const BAND  = '#FAFAF7';

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

  const [all, filtered] = await Promise.all([
    getCampaigns(),
    getCampaigns(status ? { status } : {}),
  ]);

  const counts = {
    all:       all.length,
    drafts:    all.filter(c => c.status === 'draft').length,
    pending:   all.filter(c => c.status === 'pending_approval').length,
    scheduled: all.filter(c => c.status === 'scheduled').length,
    published: all.filter(c => c.status === 'published').length,
    archived:  all.filter(c => c.status === 'archived').length,
  };

  const tabs: DashboardTab[] = MARKETING_SUBPAGES.map((s: any) => ({
    key: s.href, label: s.label, href: s.href,
    active: s.href === '/marketing/campaigns',
  }));

  const tiles: KpiTileProps[] = [
    { label: 'Total',     value: counts.all,       size: 'sm', footnote: 'all statuses' },
    { label: 'Drafts',    value: counts.drafts,    size: 'sm', footnote: 'awaiting input' },
    { label: 'Pending',   value: counts.pending,   size: 'sm', footnote: 'approval needed' },
    { label: 'Scheduled', value: counts.scheduled, size: 'sm', footnote: 'queued to publish' },
    { label: 'Published', value: counts.published, size: 'sm', footnote: 'live on a channel' },
    { label: 'Archived',  value: counts.archived,  size: 'sm', footnote: 'closed out' },
  ];

  return (
    <div style={{ background: WHITE, minHeight: '100vh' }}>
      <DashboardPage
        title="Marketing · Campaigns"
        subtitle={`${counts.all} campaign${counts.all === 1 ? '' : 's'} — drafts, scheduled, published.`}
        tabs={tabs}
      >
        {/* HARDCODED / EMPTY-STATE honesty banner */}
        <div style={{ ...fullRow, ...banner }}>
          <span style={bannerTag}>HARDCODED DATA</span>
          <span style={{ marginLeft: 8 }}>
            Sources <code style={code}>mkt_v_campaign_calendar</code> — the marketing
            campaigns table is not yet seeded with a live send/schedule feed on Namkhan.
            KPIs and rows shown are literal DB counts (likely 0). The AI-campaign builder
            at <Link href="/marketing/campaigns/new" style={{ color: FOREST, textDecoration: 'none', fontWeight: 600 }}>+ new</Link> writes into
            this same table, so seeded rows will appear here once shipped.
          </span>
        </div>

        {/* KPI strip */}
        <div style={{ ...fullRow, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
        </div>

        {/* Actions row */}
        <div style={{ ...fullRow, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Link href="/marketing/campaigns/new" style={btnPrimary}>+ New campaign</Link>
        </div>

        {/* Status filter tabs */}
        <div style={fullRow}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {STATUS_TABS.map(t => {
              const active = status === t.key;
              return (
                <Link key={t.key || 'all'}
                  href={t.key ? `/marketing/campaigns?status=${t.key}` : '/marketing/campaigns'}
                  style={{ ...pill,
                    background: active ? FOREST : WHITE,
                    color: active ? WHITE : INK,
                    borderColor: active ? FOREST : HAIR,
                  }}>{t.label}</Link>
              );
            })}
          </div>

          <div style={sectionHeader}>All campaigns{status ? ` · ${status}` : ''} · {filtered.length} row{filtered.length === 1 ? '' : 's'}</div>

          {filtered.length === 0 ? (
            <div style={emptyState}>
              <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 4 }}>
                No campaigns {status ? `with status "${status}"` : 'yet'}
              </div>
              <div style={{ fontSize: 12, color: INK_M, marginBottom: 12 }}>
                Build your first campaign in ~4 minutes — pick a channel, one-sentence brief,
                AI proposes assets, you approve and download.
              </div>
              <Link href="/marketing/campaigns/new" style={btnPrimary}>Start a campaign →</Link>
            </div>
          ) : (
            <div style={tableWrap}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: BAND, borderBottom: '1px solid ' + HAIR }}>
                    <th style={th}>Name</th>
                    <th style={th}>Channel</th>
                    <th style={{ ...th, textAlign: 'right' }}>Assets</th>
                    <th style={th}>Status</th>
                    <th style={th}>When</th>
                    <th style={{ ...th, textAlign: 'right', width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const sc = STATUS_COLOR[c.status];
                    return (
                      <tr key={c.campaign_id} style={{ borderBottom: '1px solid ' + HAIR, background: WHITE }}>
                        <td style={{ ...tdL, maxWidth: 320 }}>
                          <Link href={`/marketing/campaigns/${c.campaign_id}`}
                            style={{ color: INK, textDecoration: 'none', fontWeight: 600 }}>
                            {c.name}
                          </Link>
                          {c.brief_text && (
                            <div style={{ fontSize: 11, color: INK_M, marginTop: 2, fontStyle: 'italic' }}>
                              {c.brief_text.slice(0, 90)}{c.brief_text.length > 90 ? '…' : ''}
                            </div>
                          )}
                        </td>
                        <td style={tdL}>{CHANNEL_LABEL[c.channel]}</td>
                        <td style={tdR}>{c.asset_count}</td>
                        <td style={tdL}>
                          <span style={{ ...statusPill, background: sc.bg, color: sc.tx }}>{sc.label}</span>
                        </td>
                        <td style={{ ...tdL, color: INK_M }}>
                          {c.calendar_at ? new Date(c.calendar_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ ...tdR, textAlign: 'right' }}>
                          <Link href={`/marketing/campaigns/${c.campaign_id}`}
                            style={{ fontSize: 11, color: FOREST, textDecoration: 'none', fontWeight: 600 }}>
                            open ↗
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardPage>
    </div>
  );
}

const fullRow: CSSProperties = { gridColumn: '1 / -1' };
const banner: CSSProperties = {
  background: CREAM, border: '1px solid ' + HAIR, borderLeft: '3px solid ' + RED,
  borderRadius: 6, padding: '8px 12px', fontSize: 11, color: INK,
  display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', lineHeight: 1.5,
};
const bannerTag: CSSProperties = {
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
  color: RED,
};
const code: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10,
  background: WHITE, color: INK_M, border: '1px solid ' + HAIR,
  padding: '1px 5px', borderRadius: 3, margin: '0 3px',
};
const btnPrimary: CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  background: FOREST, color: WHITE, border: 'none', borderRadius: 4,
  textDecoration: 'none', display: 'inline-block',
};
const pill: CSSProperties = {
  padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4,
  textDecoration: 'none', border: '1px solid transparent',
};
const sectionHeader: CSSProperties = {
  fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_M, fontWeight: 600, margin: '8px 2px 8px',
};
const emptyState: CSSProperties = {
  padding: '20px 24px', background: WHITE, border: '1px solid ' + HAIR,
  borderRadius: 6, textAlign: 'left',
};
const tableWrap: CSSProperties = {
  border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden', background: WHITE,
};
const th: CSSProperties = {
  padding: '8px 10px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: INK, textAlign: 'left',
};
const tdL: CSSProperties = { padding: '8px 10px', fontSize: 12, color: INK };
const tdR: CSSProperties = {
  padding: '8px 10px', fontSize: 12, textAlign: 'right',
  fontVariantNumeric: 'tabular-nums', color: INK,
};
const statusPill: CSSProperties = {
  padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 3,
  letterSpacing: '0.04em', textTransform: 'uppercase', display: 'inline-block',
};
