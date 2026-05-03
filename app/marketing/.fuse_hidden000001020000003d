// app/marketing/page.tsx
// Marketing snapshot — review summary + social presence + recent campaigns.

import Link from 'next/link';
import PanelHero from '@/components/sections/PanelHero';
import Card from '@/components/sections/Card';
import KpiCard from '@/components/kpi/KpiCard';
import Insight from '@/components/sections/Insight';
import {
  getReviewSummary, getReviewStatsBySource, getSocialAccounts,
  getInfluencers, getMediaLinks,
} from '@/lib/marketing';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { countPlaceholders, PROPERTY_ID } from '@/lib/settings';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  booking: 'Booking.com',
  expedia: 'Expedia',
  agoda: 'Agoda',
  slh: 'SLH',
  direct: 'Direct',
};

async function getProfileGaps(): Promise<{ placeholders: number; todos: number; total: number } | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .schema('marketing')
      .from('v_namkhan_factsheet')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const placeholders = countPlaceholders(data);
    const todos = Array.isArray((data as any).todos) ? (data as any).todos.length : 0;
    return { placeholders, todos, total: placeholders + todos };
  } catch {
    // service-role missing or RPC error — render KPI as unknown
    return null;
  }
}

export default async function MarketingPage() {
  const [summary, stats, socials, influencers, media, gaps] = await Promise.all([
    getReviewSummary(30),
    getReviewStatsBySource(90),
    getSocialAccounts(),
    getInfluencers({ limit: 5 }),
    getMediaLinks(),
    getProfileGaps(),
  ]);

  const totalFollowers = socials.reduce((s, a) => s + (a.followers ?? 0), 0);
  const pendingInfluencers = influencers.filter((i: any) => !i.delivered).length;

  return (
    <>
      <PanelHero
        eyebrow="Marketing · snapshot"
        title="Reputation"
        emphasis="& presence"
        sub="Reviews · social channels · influencer pipeline · media library"
        kpis={
          <>
            <KpiCard
              label="Reviews 30d"
              value={summary.total ?? 0}
              hint={`${summary.unanswered ?? 0} unanswered`}
            />
            <KpiCard
              label="Avg Rating"
              value={summary.avg_rating ? Number(summary.avg_rating).toFixed(2) : '—'}
              kind="text"
              tone={
                (summary.avg_rating ?? 0) >= 4.5 ? 'pos' :
                (summary.avg_rating ?? 0) >= 4 ? 'neutral' : 'warn'
              }
              hint="/ 5.00 normalised"
            />
            <KpiCard
              label="Response Rate"
              value={(summary.response_rate ?? 0) * 100}
              kind="pct"
              tone={
                (summary.response_rate ?? 0) >= 0.9 ? 'pos' :
                (summary.response_rate ?? 0) >= 0.7 ? 'warn' : 'neg'
              }
              hint="last 30d"
            />
            <KpiCard
              label="Social Followers"
              value={totalFollowers}
              hint={`${socials.length} channels · manual`}
            />
            <Link href="/settings/property" style={{ display: 'block' }} title="Open Property Settings to fill gaps">
              <KpiCard
                label="Profile Gaps"
                value={gaps == null ? '—' : gaps.total}
                kind={gaps == null ? 'text' : 'number'}
                tone={gaps == null ? 'neutral' : gaps.total === 0 ? 'pos' : gaps.total > 5 ? 'warn' : 'neutral'}
                hint={
                  gaps == null
                    ? 'service-role key missing'
                    : `${gaps.placeholders} LOREM · ${gaps.todos} todos · click to fix`
                }
              />
            </Link>
          </>
        }
      />

      <div className="card-grid-2">
        <Card title="Reviews" emphasis="by source · 90d" sub="Avg rating · count · unanswered" source="marketing.reviews">
          {stats.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No review data in window.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="num">Reviews</th>
                  <th className="num">Avg</th>
                  <th className="num">Unanswered</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s: any) => (
                  <tr key={s.source}>
                    <td className="lbl"><strong>{SOURCE_LABEL[s.source] ?? s.source}</strong></td>
                    <td className="num">{s.count}</td>
                    <td className="num">{s.avg_rating ? Number(s.avg_rating).toFixed(2) : '—'}</td>
                    <td className={`num ${s.unanswered > 0 ? 'text-warn' : 'text-mute'}`}>
                      {s.unanswered}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Social presence" sub="Manual entry · API integration Phase 2" source="marketing.social_accounts">
          {socials.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No social accounts configured.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Handle</th>
                  <th className="num">Followers</th>
                </tr>
              </thead>
              <tbody>
                {socials.slice(0, 8).map((a: any) => (
                  <tr key={a.id}>
                    <td className="lbl"><strong>{a.platform}</strong></td>
                    <td className="lbl text-mute">{a.handle ?? '—'}</td>
                    <td className="num">
                      {a.followers ? a.followers.toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="card-grid-2" style={{ marginTop: 22 }}>
        <Card title="Influencer pipeline" emphasis={`· ${pendingInfluencers} pending`} sub="Most recent campaigns" source="marketing.influencers">
          {influencers.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No influencer campaigns logged.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Platform</th>
                  <th className="num">Reach</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {influencers.map((i: any) => (
                  <tr key={i.id}>
                    <td className="lbl"><strong>{i.name}</strong></td>
                    <td className="lbl text-mute">{i.primary_platform ?? '—'}</td>
                    <td className="num">
                      {i.reach ? Number(i.reach).toLocaleString() : '—'}
                    </td>
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
        </Card>

        <Card title="Media library" emphasis={`· ${media.length} items`} sub="Drive-linked brand assets" source="marketing.media_links">
          {media.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No media links configured.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {media.slice(0, 8).map((m: any) => (
                  <tr key={m.id}>
                    <td className="lbl"><strong>{m.label}</strong></td>
                    <td className="lbl text-mute">{m.category}</td>
                    <td>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-mono" style={{ color: 'var(--brass)', fontSize: 11 }}>
                        Open ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {(summary.unanswered ?? 0) > 5 && (
        <Insight tone="alert" eye="Review action">
          <strong>{summary.unanswered} unanswered reviews</strong> in last 30 days.
          Response rate {((summary.response_rate ?? 0) * 100).toFixed(0)}% — SLH standard is 90%+.
          Auto-draft via Vertex agent arrives Phase 4; meanwhile manual reply via Reviews tab.
        </Insight>
      )}
    </>
  );
}
