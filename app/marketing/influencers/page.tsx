// app/marketing/influencers/page.tsx
// Marketing · Influencers.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import KpiBox from '@/components/kpi/KpiBox';
import ArtifactActions from '@/components/page/ArtifactActions';
import { getInfluencers } from '@/lib/marketing';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

function formatNum(n: number | null | undefined): string {
  if (n == null || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatUSD(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${Math.round(Number(n)).toLocaleString()}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function InfluencersPage() {
  const list = await getInfluencers({ limit: 100 });

  const totalComp = list.reduce((s: number, i: any) => s + Number(i.comp_value_usd ?? 0), 0);
  const totalPaid = list.reduce((s: number, i: any) => s + Number(i.paid_fee_usd ?? 0), 0);
  const totalReach = list.reduce((s: number, i: any) => s + Number(i.estimated_reach ?? i.reach ?? 0), 0);
  const delivered = list.filter((i: any) => i.delivered).length;
  const pending = list.length - delivered;

  return (
    <Page
      eyebrow="Marketing · Influencers"
      title={<>Influencer <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>campaigns</em>.</>}
      subPages={MARKETING_SUBPAGES}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <KpiBox value={list.length}            unit="count" label="Total campaigns" />
        <KpiBox value={pending}                unit="count" label="Pending delivery" tooltip={`${delivered} delivered`} />
        <KpiBox value={totalComp + totalPaid}  unit="usd"   label="Total investment" />
        <KpiBox value={null} unit="text" valueText={formatNum(totalReach)} label="Estimated reach" />
      </div>

      <Panel title={`Influencer log · ${list.length}`} eyebrow="marketing.influencers" actions={<ArtifactActions context={{ kind: 'table', title: 'Influencer log', dept: 'marketing' }} />}>
        {list.length === 0 ? (
          <div className="stub" style={{ padding: 32 }}>
            <h3>No campaigns logged yet</h3>
            <p>
              Add entries via Supabase → marketing.influencers table.
              Track: name, handle, reach, stay dates, comp value, paid fee, deliverables.
            </p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Handle</th>
                <th>Platform</th>
                <th className="num">Reach</th>
                <th>Stay</th>
                <th className="num">Comp</th>
                <th className="num">Paid</th>
                <th>Deliverables</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i: any) => (
                <tr key={i.id}>
                  <td className="lbl"><strong>{i.name}</strong></td>
                  <td className="lbl text-mute">{i.handle ?? '—'}</td>
                  <td className="lbl text-mute">{i.primary_platform ?? '—'}</td>
                  <td className="num">{formatNum(i.reach)}</td>
                  <td className="lbl text-mute">
                    {formatDate(i.stay_from)}{i.stay_to ? ` → ${formatDate(i.stay_to)}` : ''}
                  </td>
                  <td className="num">{formatUSD(i.comp_value_usd)}</td>
                  <td className="num">{formatUSD(i.paid_fee_usd)}</td>
                  <td className="lbl text-mute" style={{ maxWidth: 240 }}>{i.deliverables ?? '—'}</td>
                  <td>
                    <span className={`pill ${i.delivered ? 'good' : 'warn'}`}>
                      {i.delivered ? 'Delivered' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  );
}
