// app/marketing/influencers/page.tsx

import { getInfluencers } from '@/lib/marketing';

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
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default async function InfluencersPage() {
  const list = await getInfluencers({ limit: 100 });

  const totalComp = list.reduce((s, i) => s + Number(i.comp_value_usd ?? 0), 0);
  const totalPaid = list.reduce((s, i) => s + Number(i.paid_fee_usd ?? 0), 0);
  const totalReach = list.reduce((s, i) => s + Number(i.estimated_reach ?? i.reach ?? 0), 0);
  const delivered = list.filter(i => i.delivered).length;
  const pending = list.length - delivered;

  return (
    <>
      <div className="kpi-strip cols-4">
        <div className="kpi-tile">
          <div className="kpi-label">Total Campaigns</div>
          <div className="kpi-value">{list.length}</div>
          <div className="kpi-deltas">all-time logged</div>
        </div>
        <div className={`kpi-tile ${pending > 0 ? 'warn' : ''}`}>
          <div className="kpi-label">Pending Delivery</div>
          <div className="kpi-value">{pending}</div>
          <div className="kpi-deltas">{delivered} delivered</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Total Investment</div>
          <div className="kpi-value">{formatUSD(totalComp + totalPaid)}</div>
          <div className="kpi-deltas">comp + cash</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Estimated Reach</div>
          <div className="kpi-value">{formatNum(totalReach)}</div>
          <div className="kpi-deltas">across all campaigns</div>
        </div>
      </div>

      <div className="section">
        <div className="section-head">
          <div className="section-title">Influencer Log</div>
          <div className="section-tag">most recent stays first</div>
        </div>
        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No influencer campaigns logged yet</div>
            <div className="empty-body">
              Add entries via Supabase dashboard → marketing.influencers table.
              Track: name, handle, reach, stay dates, comp value, paid fee, deliverables.
            </div>
          </div>
        ) : (
          <table>
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
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="label">{i.name}</td>
                  <td>{i.handle ?? <span className="muted">—</span>}</td>
                  <td className="muted">{i.primary_platform ?? '—'}</td>
                  <td className="num">{formatNum(i.reach)}</td>
                  <td className="muted">{formatDate(i.stay_from)}{i.stay_to ? ` → ${formatDate(i.stay_to)}` : ''}</td>
                  <td className="num">{formatUSD(i.comp_value_usd)}</td>
                  <td className="num">{formatUSD(i.paid_fee_usd)}</td>
                  <td style={{ maxWidth: 220 }} className="muted">{i.deliverables ?? '—'}</td>
                  <td>
                    {i.delivered ? (
                      <span className="badge badge-good">Delivered</span>
                    ) : (
                      <span className="badge badge-warn">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
