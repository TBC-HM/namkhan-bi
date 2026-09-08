'use client';
// app/h/[property_id]/marketing/dashboard/MarketingDashboard.tsx
// Brief marketing-dashboard-v1.
// Five tabs, deep-linkable via #today/#revenue/#reach/#segments/#goals (also ?tab=). Arrow keys switch tabs.
// Tailwind utility classes only (allowed for v1 per the brief's A8).
//
// NO DATA IS COMPUTED HERE — every number arrives in the payload from
// public.fn_mkt_dash_payload(). The helpers below only format and colour.
//
// Deviation from the handoff copy: the formatters take the payload's own
// widened value type (jsonb numerics can arrive as strings) instead of the
// narrow `Num`, which removes ~40 `as Num` casts at the call sites. Tiles that
// are JSON null for a tenant without a marketing.dash_source_map row (Donna
// 1000001: website, search, reputation, retreats, demand_inbox, icp_coverage,
// social_publishing, subscribers, villa_direct) are typed nullable and guarded.

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import Link from 'next/link';
import type { Payload, TabKey, Action, BarometerRow, Goal, Num, SeriesPoint, Val } from './types';
import { TABS } from './types';

/* ---------- formatting (display only) ---------- */
const num = (v: Val): number | null => {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// Dates and numbers are formatted WITHOUT Intl. Node's ICU and the browser's ICU
// can render the same instant with different invisible characters (NBSP vs space,
// U+202F before AM/PM), which is a hydration mismatch React reports as #425 — and
// which a whitespace-normalising diff cannot see. Building the strings by hand
// makes server and client byte-identical. All values are read in UTC, matching the
// database, the crons and deploy.deployments.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => (n < 10 ? '0' + n : String(n));
const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const nInt = (v: Val) => { const n = num(v); return n == null ? '—' : group(Math.round(n)); };
const nMoney = (v: Val) => { const n = num(v); return n == null ? '—' : '$' + group(Math.round(n)); };
const nMoneyK = (v: Val) => { const n = num(v); return n == null ? '—' : '$' + (n / 1000).toFixed(1) + 'k'; };
const nPct = (v: Val, d = 1) => { const n = num(v); return n == null ? '—' : n.toFixed(d) + '%'; };
const nSigned = (v: Val, suffix = '%') => { const n = num(v); return n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + suffix; };
// Dates render in UTC on BOTH server and client. Without an explicit timeZone the
// server (Vercel, UTC) and the browser (any offset) produce different text, which
// is a hydration mismatch (React #425) — it made React throw away the server HTML
// and re-render the whole page on every load, and flipped the date near midnight.
const nDate = (v: Val) => {
  if (typeof v !== 'string' || !v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const nStamp = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} UTC`;
};
const tone = (v: Val, bad: (n: number) => boolean, warn?: (n: number) => boolean) => {
  const n = num(v);
  return n == null ? 'text-neutral-500' : bad(n) ? 'text-red-800' : warn && warn(n) ? 'text-amber-700' : 'text-emerald-900';
};

/* ---------- small primitives ---------- */
function Sparkline({ pts, up }: { pts: SeriesPoint[] | undefined; up?: boolean }) {
  if (!pts || pts.length < 2) return <span className="text-xs text-neutral-400">—</span>;
  const vals = pts.map((p) => Number(p.v ?? 0));
  const w = 110, h = 22, mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const d = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / rg) * (h - 4)).toFixed(1)}`).join(' ');
  const col = up ? '#1E4D3B' : '#8A2A2A';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={col} strokeWidth="1.4" strokeLinejoin="round" points={d} />
    </svg>
  );
}

function Tile({ title, sub, big, bigTone, chip, chipTone, rows, cta, ctaHref, note, noteRed, wide, children }: {
  title: string; sub?: string; big: string; bigTone?: string; chip?: string; chipTone?: 'ok' | 'near' | 'miss';
  rows?: [string, string, string?][]; cta: string; ctaHref: string; note?: string; noteRed?: boolean; wide?: boolean; children?: ReactNode;
}) {
  const chipCls = chipTone === 'miss' ? 'bg-red-100 text-red-800' : chipTone === 'near' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-900';
  return (
    <div className={`flex min-h-[280px] flex-col bg-white p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <h3 className="flex items-baseline justify-between text-sm font-semibold">{title}{sub && <span className="text-xs font-normal text-neutral-500">{sub}</span>}</h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <div className={`font-serif text-3xl leading-none ${bigTone ?? ''}`}>{big}</div>
        {chip && <span className={`rounded px-2 py-0.5 text-xs ${chipCls}`}>{chip}</span>}
      </div>
      {rows && (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
          {rows.map(([k, v, t], i) => (
            <Fragment key={`${k}-${i}`}>
              <dt className="text-neutral-500">{k}</dt>
              <dd className={`text-right font-medium ${t ?? ''}`}>{v}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {children}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs">
        <Link href={ctaHref} className="border-b border-emerald-200 font-medium text-emerald-900 hover:border-emerald-900">{cta}</Link>
        {note && <span className={`text-right ${noteRed ? 'text-red-800' : 'text-neutral-500'}`}>{note}</span>}
      </div>
    </div>
  );
}

/* ---------- main ---------- */
export default function MarketingDashboard({ pid, payload, initialTab }: { pid: number; payload: Payload; initialTab?: string }) {
  const base = `/h/${pid}`;
  const href = (p: string) => (p.startsWith('/') ? `${base}${p}` : p);
  const valid = (t?: string): t is TabKey => !!t && TABS.some((x) => x.key === t);
  const [tab, setTab] = useState<TabKey>(valid(initialTab) ? initialTab : 'today');

  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (valid(fromHash)) setTab(fromHash);
    const onHash = () => { const h = window.location.hash.replace('#', ''); if (valid(h)) setTab(h); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (t: TabKey) => { setTab(t); history.replaceState(null, '', '#' + t); window.scrollTo({ top: 0 }); };
  const onKey = (e: ReactKeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    go(TABS[j].key);
  };

  const { badges, metrics: m, tiles: T, origin: O, series: S } = payload;
  const actions = payload.actions ?? [];
  const freshness = payload.freshness ?? [];
  const socialPlatforms = T.social_platforms ?? [];
  const icpProfiles = T.icp_profiles ?? [];

  const badge: Record<TabKey, { text: string; bad: boolean }> = {
    today: { text: `${badges.today.actions} actions · reach ${nSigned(badges.today.composite_change_pct)}`, bad: badges.today.actions_red > 0 },
    revenue: { text: `direct ${nPct(badges.revenue.direct_pct_90d)}`, bad: Number(badges.revenue.direct_pct_90d ?? 0) < 60 },
    reach: { text: `${nInt(badges.reach.published_30d)} published`, bad: Number(badges.reach.published_30d ?? 0) === 0 },
    segments: { text: `${nPct(badges.segments.bookings_matched_pct, 0)} classified`, bad: Number(badges.segments.bookings_matched_pct ?? 0) < 50 },
    goals: { text: `${nInt(badges.goals.measured)} / ${nInt(badges.goals.total)} measured`, bad: Number(badges.goals.measured ?? 0) === 0 },
  };

  const baro = useMemo(
    () => Object.fromEntries((payload.barometer ?? []).map((b) => [b.channel_key, b])) as Record<string, BarometerRow | undefined>,
    [payload.barometer],
  );
  const composite = baro['composite_touches'];

  return (
    <div className="mx-auto max-w-[1320px] px-7 py-6">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-3">
        {/* The page title is rendered by the DashboardPage shell (which also draws
            the Marketing department strip), so this is the metadata line only. */}
        <p className="text-sm text-neutral-500">Property {pid} · generated {nStamp(payload.generated_at)}{payload.cached ? ` · cached ${Math.round((payload.cache_age_sec ?? 0) / 60)} min` : ''}</p>
        <div className="text-right text-xs text-neutral-500">
          {payload.deploy && <>Production build <b className="text-neutral-900">{payload.deploy.commit_short}</b> aliased {nDate(payload.deploy.prod_aliased_at)}<br /></>}
          Goals table: <b className="text-neutral-900">{nInt(badges.goals.stored)} of {nInt(badges.goals.total)}</b> goals have a stored value
        </div>
      </header>

      {/* tabs */}
      <div role="tablist" aria-label="Marketing dashboard sections" className="flex gap-0.5 overflow-x-auto border-b-2 border-neutral-900">
        {TABS.map((t, i) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => go(t.key)} onKeyDown={(e) => onKey(e, i)}
            className={`-mb-0.5 flex items-baseline gap-2 whitespace-nowrap border-b-[3px] px-4 pb-2 pt-2.5 text-sm font-medium ${tab === t.key ? 'border-emerald-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'}`}>
            {t.label}<small className={`text-xs font-normal ${badge[t.key].bad ? 'text-red-800' : 'text-neutral-500'}`}>{badge[t.key].text}</small>
          </button>
        ))}
      </div>

      {/* ================= TODAY ================= */}
      {tab === 'today' && (
        <div role="tabpanel">
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 border-b border-neutral-200 py-3 text-xs text-neutral-500">
            {freshness.map((f) => (
              <span key={f.source_key} className="whitespace-nowrap">
                <i className={`mr-1.5 inline-block h-2 w-2 rounded-full ${f.status === 'fresh' ? 'bg-emerald-600' : f.status === 'warn' ? 'bg-amber-600' : 'bg-red-800'}`} />
                {f.label} {f.asof ? nDate(f.asof) : 'missing'}{f.days_old != null && f.days_old > 2 ? ` (${f.days_old} d)` : ''}
              </span>
            ))}
          </div>

          <section className="grid gap-7 border-b border-neutral-200 py-5 lg:grid-cols-[300px_1fr]">
            <div>
              <h2 className="font-serif text-lg font-semibold">Reach barometer</h2>
              <div className={`mt-2 font-serif text-5xl leading-none ${tone(composite?.change_pct, (n) => n < -5, (n) => n < 0)}`}>{nSigned(composite?.change_pct)}<small className="ml-2 font-sans text-sm text-neutral-500">audience touches</small></div>
              <p className="mt-2 max-w-[34ch] text-sm text-neutral-500"><b className="text-neutral-900">{nInt(composite?.now_value)}</b> touches now against <b className="text-neutral-900">{nInt(composite?.before_value)}</b> {composite?.days_apart} days earlier: website sessions, search impressions and Instagram/TikTok/Pinterest impressions added together.</p>
              <p className="mt-2 max-w-[34ch] text-sm text-neutral-500">Published in the window: {nInt(m.published_30d)} posts, {nInt(m.sends_30d)} emails, {nInt(m.yt_published_pipeline)} videos.</p>
            </div>
            <div>
              <table className="w-full text-xs">
                <thead><tr className="text-neutral-500"><th className="pb-1.5 text-left font-medium">Channel</th><th className="font-medium">Trend</th><th className="text-right font-medium">Now</th><th className="text-right font-medium">Before</th><th className="text-right font-medium">Change</th></tr></thead>
                <tbody>
                  {([
                    ['website_sessions', 'Website sessions', 'ga4_sessions'], ['paid_search_sessions', 'Paid search sessions', undefined], ['search_impressions', 'Search impressions', 'gsc_impressions'],
                    ['search_clicks', 'Search clicks', 'gsc_clicks'], ['social_instagram_impressions', 'Instagram impressions', 'social_instagram_impressions'], ['social_instagram_reach', 'Instagram reach', undefined],
                    ['social_tiktok_impressions', 'TikTok impressions', 'social_tiktok_impressions'], ['social_pinterest_impressions', 'Pinterest impressions', 'social_pinterest_impressions'],
                    ['yt_views_per_day', 'YouTube views per day', 'yt_views'], ['gbp_reviews', 'Google Business reviews', 'gbp_reviews'], ['newsletter_real_subscribers', 'Newsletter list (real)', undefined],
                  ] as [string, string, string | undefined][]).map(([k, label, sk]) => { const r = baro[k]; if (!r) return null; return (
                    <tr key={k} className="border-b border-neutral-200">
                      <td className="py-1.5">{label} <span className="text-neutral-500">{nDate(r.before_asof)} → {nDate(r.now_asof)}</span></td>
                      <td className="w-[120px]"><Sparkline pts={sk ? S?.[sk] : undefined} up={r.direction === 'up'} /></td>
                      <td className="text-right">{nInt(r.now_value)}</td><td className="text-right text-neutral-500">{nInt(r.before_value)}</td>
                      <td className={`text-right font-semibold ${r.direction === 'down' ? 'text-red-800' : r.direction === 'up' ? 'text-emerald-900' : 'text-neutral-500'}`}>{nSigned(r.change_pct)}</td>
                    </tr>); })}
                  {baro['bookings_4wk'] && (
                    <tr className="border-t-2 border-neutral-900"><td className="py-1.5 font-medium">Bookings taken, 4 wk vs prior 4 wk</td><td><Sparkline pts={S?.['bookings_weekly']} up /></td>
                      <td className="text-right">{nInt(baro['bookings_4wk'].now_value)} · {nMoneyK(baro['booking_revenue_4wk']?.now_value)}</td>
                      <td className="text-right text-neutral-500">{nInt(baro['bookings_4wk'].before_value)} · {nMoneyK(baro['booking_revenue_4wk']?.before_value)}</td>
                      <td className="text-right font-semibold text-emerald-900">{nSigned(baro['bookings_4wk'].change_pct)} · {nSigned(baro['booking_revenue_4wk']?.change_pct)}</td></tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-neutral-500">&ldquo;Before&rdquo; is the snapshot ≥30 days earlier, or the earliest one held; the gap lengthens automatically as snapshots accumulate. YouTube is excluded from the composite while its analytics are stale.</p>
            </div>
          </section>

          <div className="grid gap-x-8 lg:grid-cols-[2fr_1fr]">
            <section className="py-5">
              <h2 className="font-serif text-lg font-semibold">What needs action</h2>
              <p className="mb-3 text-sm text-neutral-500">Ranked by revenue exposure. Rules live in marketing.dash_action_rules.</p>
              <ol className="divide-y divide-neutral-200">
                {actions.map((a: Action, i) => (
                  <li key={a.rule_key} className="grid grid-cols-[34px_1fr] items-start gap-x-3 py-3.5 md:grid-cols-[34px_1fr_auto]">
                    <span className="font-serif text-2xl text-neutral-400">{i + 1}</span>
                    <div>
                      <div className="text-[15px] font-semibold">{a.title}<span className={`ml-2 rounded px-1.5 py-px align-[2px] text-[11px] font-medium ${a.severity === 'red' ? 'bg-red-100 text-red-800' : a.severity === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'}`}>{a.category}</span></div>
                      <div className="mt-0.5 max-w-[70ch] text-sm text-neutral-500">{a.detail}</div>
                    </div>
                    <div className="col-start-2 mt-2 flex flex-wrap gap-1.5 md:col-start-3 md:mt-0 md:min-w-[200px] md:flex-col">
                      <Link href={href(a.route_path)} className="rounded border border-emerald-900 bg-emerald-900 px-3 py-1.5 text-center text-xs font-medium text-white">{a.cta_label}</Link>
                      {a.route_path_2 && a.cta_label_2 && <Link href={href(a.route_path_2)} className="rounded border border-emerald-900 px-3 py-1.5 text-center text-xs font-medium text-emerald-900 hover:bg-emerald-50">{a.cta_label_2}</Link>}
                    </div>
                  </li>
                ))}
                {actions.length === 0 && <li className="py-3 text-sm text-neutral-500">No rule is firing.</li>}
              </ol>
            </section>
            <section className="py-5">
              <h2 className="font-serif text-lg font-semibold">Next 30 days</h2>
              <ul className="divide-y divide-neutral-200 text-sm">
                {(payload.agenda ?? []).map((g, i) => (
                  <li key={i} className="grid grid-cols-[64px_1fr] gap-2 py-2"><span className="font-semibold">{nDate(g.item_date)}</span>
                    <span>{g.title} <span className="text-neutral-500">· {g.item_type === 'email_slot' ? `email, ${g.status}` : g.item_type === 'domain_expiry' ? `domain expiry${g.detail ? ' · ' + g.detail : ''}` : `goal deadline · ${g.detail}`}</span></span></li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* ================= REVENUE ================= */}
      {tab === 'revenue' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Revenue</h2><span className="text-sm text-neutral-500">what marketing is paid to move</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile title="Direct share of revenue" sub="booked, last 90 d" big={nPct(T.direct_share?.direct_pct_90d)} bigTone={tone(T.direct_share?.direct_pct_90d, (n) => n < 45, (n) => n < 60)}
              chip="goal ≥ 60% by Dec 2026" chipTone={Number(T.direct_share?.direct_pct_90d ?? 0) >= 60 ? 'ok' : 'miss'}
              rows={[['With SLH counted as direct', nPct(T.direct_share?.direct_slh_pct_90d)], ['OTA share (incl. SLH)', nPct(Number(T.direct_share?.ota_pct_90d ?? 0) + Number(T.direct_share?.slh_pct_90d ?? 0)), 'text-red-800'], ['OTA excluding SLH', nPct(T.direct_share?.ota_pct_90d)], ['Last 30 d direct', nPct(T.direct_share?.direct_pct_30d)], ['Next 90 d on the books', `${nPct(T.direct_share?.direct_pct_otb90)} direct · OTA ${nPct(T.direct_share?.ota_incl_slh_pct_otb90)}`, 'text-red-800']]}
              cta="Open funnels" ctaHref={`${base}/marketing/funnels`} note="PMS maps SLH to OTA" noteRed />
            <Tile title="Bookings taken" sub="last 90 d, PMS" big={nInt(T.bookings?.bookings_90d)} chip={`${nMoneyK(T.bookings?.revenue_90d)} · ${nInt(T.bookings?.nights_90d)} nights`}
              rows={[['ADR · stay', `${nMoney(T.bookings?.adr_90d)} · ${T.bookings?.avg_los_90d ?? '—'} n`], ['Last 30 d', `${nInt(T.bookings?.bookings_30d)} · ${nMoneyK(T.bookings?.revenue_30d)}`], ['1-night bookings', nPct(T.bookings?.one_night_pct_90d), 'text-amber-700'], ['Cancelled, same window', `${nInt(T.bookings?.cancelled_90d)} of ${nInt(T.bookings?.attempts_90d)} · ${nPct(T.bookings?.cancel_pct_90d)}`, 'text-amber-700'], ['Median lead time', `${nInt(T.bookings?.median_lead_days)} days`], ['Next 90 d on the books', `${nInt(T.bookings?.otb90_bookings)} · ${nMoneyK(T.bookings?.otb90_revenue)}`], ['Email / offline', `${nInt(T.bookings?.email_bookings_90d)} · ${nMoneyK(T.bookings?.email_revenue_90d)} · ${nMoney(T.bookings?.email_avg_value_90d)} each`]]}
              cta="Open revenue" ctaHref={`${base}/revenue`} note="market_segment empty on all rows" />
            <Tile title="Reputation vs goals" sub={`${nInt(T.reputation?.total_reviews)} reviews`} big={String(T.reputation?.last_month_avg ?? '—')} bigTone={tone(T.reputation?.last_month_avg, (n) => n < 4.3, (n) => n < 4.6)}
              chip={`last full month · lifetime ${T.reputation?.lifetime_avg ?? '—'}`} chipTone={Number(T.reputation?.last_month_avg ?? 5) < 4.3 ? 'miss' : 'ok'}
              rows={[['Google Business Profile', `${T.reputation?.gbp_rating ?? '—'} → 4.8 by 31 Oct`, 'text-amber-700'], ['TripAdvisor rank', `${T.reputation?.tripadvisor_rank ?? '—'} of ${T.reputation?.tripadvisor_rank_of ?? '—'} → top 3`, 'text-red-800'], ['Trip.com', `${T.reputation?.ctrip_score ?? '—'} → 4.5`, 'text-red-800'], ['Booking · Expedia', `${T.reputation?.booking_score ?? '—'} · ${T.reputation?.expedia_score ?? '—'}`], ['Reviews last month · goal', `${nInt(T.reputation?.last_month_reviews)} · ≥15`], ['Never answered', `${nInt(T.reputation?.unanswered)} (${nPct(T.reputation?.unanswered_pct)})`, 'text-red-800']]}
              cta="Open reputation" ctaHref={`${base}/guest/reputation`} note="review conversion not computed" />
            <Tile title="Demand inbox" sub="real inquiries, 90 d" big={nInt(T.demand_inbox?.inquiries_90d)} chip={`${nInt(T.demand_inbox?.converted_90d)} converted`} chipTone="miss"
              rows={[['FIT · group · retreat · B2B', `${T.demand_inbox?.fit_90d ?? '—'} · ${T.demand_inbox?.group_90d ?? '—'} · ${T.demand_inbox?.retreat_90d ?? '—'} · ${T.demand_inbox?.b2b_90d ?? '—'}`], ['Untouched (“new”)', `${nInt(T.demand_inbox?.untouched_90d)} (${nPct(T.demand_inbox?.untouched_pct_90d, 0)})`, 'text-red-800'], ['Newest real inquiry', `${T.demand_inbox?.days_since_newest ?? '—'} d ago`, 'text-red-800'], ['Mail poll, 7 d', `${nInt(T.demand_inbox?.poll_ok_7d)} ok · ${nInt(T.demand_inbox?.poll_err_7d)} errors`], ['Leads · proposals sent', `${T.demand_inbox?.leads ?? '—'} · ${T.demand_inbox?.proposals_sent ?? '—'}`], ['Contracts active · pending', `${T.demand_inbox?.contracts_active ?? '—'} · ${T.demand_inbox?.contracts_pending ?? '—'}`]]}
              cta="Open sales inbox" ctaHref={`${base}/sales`} note={Number(T.demand_inbox?.test_rows ?? 0) > 0 ? `${T.demand_inbox?.test_rows} test rows in production` : undefined} noteRed />
          </div>

          <section className="border-b border-neutral-200 py-5">
            <h2 className="font-serif text-lg font-semibold">Where guests come from</h2>
            <p className="mb-3 text-sm text-neutral-500">Markets by revenue for stays this year; sources for bookings taken in the last 90 d; channel mix across four windows.</p>
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <h4 className="mb-2 text-sm font-semibold">Source markets <span className="font-normal text-neutral-500">stays YTD</span></h4>
                <Bars rows={(O?.markets_ytd ?? []).slice(0, 10).map((r) => ({ label: r.country, pct: r.pct_revenue, right: `${nPct(r.pct_revenue)} ${nMoneyK(r.revenue)}` }))} />
                <p className="mt-2 text-xs text-neutral-500">Last 90 d: {(O?.markets_90d ?? []).slice(0, 6).map((r) => `${r.country} ${nPct(r.pct_revenue)}`).join(', ')}. Country “00” = unknown at the PMS guest profile.</p>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Booking sources <span className="font-normal text-neutral-500">booked, 90 d</span></h4>
                <Bars wide rows={(O?.sources_90d ?? []).slice(0, 8).map((r) => ({ label: r.source_name, pct: r.pct_revenue, ota: r.channel_dash === 'OTA', right: `${nMoneyK(r.revenue)} ${r.bookings}` }))} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold">Channel mix <span className="font-normal text-neutral-500">share of revenue (OTB: nights)</span></h4>
                <ChannelMixTable rows={O?.channel_mix ?? []} />
                <p className="mt-2 text-xs text-neutral-500">SLH shown on its own line so goal 5 (“direct + SLH ≥60%”) can be read directly.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ================= REACH ================= */}
      {tab === 'reach' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Reach and audience</h2><span className="text-sm text-neutral-500">trend lines are on the Today tab</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile title="Website to booking" sub="30 d, GA4 + PMS" big={nPct(T.website?.session_to_booking_pct, 2)} chip={`${nInt(T.website?.website_bookings_30d)} engine bookings / ${nInt(T.website?.sessions)} sessions`} chipTone="near"
              rows={[['Sessions vs before', `${nInt(T.website?.sessions)} · ${nSigned(T.website?.sessions_change_pct)}`, tone(T.website?.sessions_change_pct, (n) => n < -10, (n) => n < 0)], ['Paid search', `${nInt(T.website?.paid_sessions)} · ${nSigned(T.website?.paid_change_pct)}`, tone(T.website?.paid_change_pct, (n) => n < -10, (n) => n < 0)], ['Organic search (all engines)', `${nInt(T.website?.organic_sessions)} · ${nSigned(T.website?.organic_change_pct)}`], ['Direct / typed', `${nInt(T.website?.direct_sessions)} · ${nSigned(T.website?.direct_change_pct)}`], ['Unattributed', nInt(T.website?.unattributed_sessions), 'text-amber-700'], ['Engagement · avg session', `${nPct(T.website?.engagement_pct)} · ${nInt(T.website?.avg_session_sec)} s`]]}
              cta="Open web analytics" ctaHref={`${base}/marketing/digital/web`} note="no paid spend, no CPA" noteRed />
            <Tile title="Search" sub={`Search Console 30 d · ranks ${nDate(T.search?.rank_asof)}`} big={nInt(T.search?.impressions)} chip={`impressions · ${nSigned(T.search?.impressions_change_pct)}`} chipTone={Number(T.search?.impressions_change_pct ?? 0) < -10 ? 'miss' : 'near'}
              rows={[['Clicks · CTR · position', `${nInt(T.search?.clicks)} · ${nPct(T.search?.ctr_pct)} · ${T.search?.avg_position ?? '—'}`], ['Tracked keywords', nInt(T.search?.tracked_keywords)], ['Top 3 / top 10', `${T.search?.top3 ?? '—'} / ${T.search?.top10 ?? '—'}`], ['Outside top 100', nInt(T.search?.not_ranked), 'text-amber-700'], ['Referring domains', `${nInt(T.search?.referring_domains)} (${nDate(T.search?.backlinks_asof)})`], ['AI mentions tracked', `${T.search?.llm_mentions ?? '—'}/${T.search?.llm_checks ?? '—'} · ${T.search?.llm_engines ?? '—'} engine(s)`]]}
              cta="Open SEO" ctaHref={`${base}/marketing/seo`} note={Number(T.search?.rank_days_stale ?? 0) > 7 ? `rank cron ${T.search?.rank_days_stale} d stale` : undefined} noteRed />
            <Tile title="Social" sub={`${nInt(T.social_publishing?.accounts_connected)} accounts connected`} big={nInt(socialPlatforms.reduce((s, p) => s + Number(p.impressions ?? 0), 0))} chip={`impressions · ${nInt(T.social_publishing?.published_30d)} posts published in 30 d`} chipTone={Number(T.social_publishing?.published_30d ?? 0) === 0 ? 'miss' : 'ok'}
              rows={[
                ...socialPlatforms.filter((p) => !p.no_data).map((p) => [p.platform, `${nInt(p.impressions)} (${nSigned(p.impressions_change_pct)}) · ${nInt(p.followers)} followers`, tone(p.impressions_change_pct, (n) => n < -10, (n) => n < 0)] as [string, string, string]),
                ['No metrics returned', socialPlatforms.filter((p) => p.no_data).map((p) => p.platform).join(', ') || '—', 'text-amber-700'],
                ['YouTube views/day · subs', `${nInt(T.social_publishing?.yt_views_per_day)} (${nSigned(T.social_publishing?.yt_views_change_pct)}) · ${nInt(T.social_publishing?.yt_subscribers)}`, 'text-red-800'],
                ['Planned cadence', `${T.social_publishing?.planned_posts_per_week ?? '—'} posts / week`],
                ['Ready · scheduled · drafts', `${T.social_publishing?.posts_ready ?? '—'} · ${T.social_publishing?.scheduled_future ?? '—'} · ${T.social_publishing?.posts_draft ?? '—'}`],
                ['YouTube token', Number(T.social_publishing?.yt_token_days_left ?? 99) <= 3 ? `expires in ${T.social_publishing?.yt_token_days_left} d` : 'ok', Number(T.social_publishing?.yt_token_days_left ?? 99) <= 3 ? 'text-red-800' : ''],
              ]}
              cta="Open social queue" ctaHref={`${base}/marketing/social`} note="profile-level stats, no per-post metrics" />
            <Tile title="Subscribers" sub="newsletter" big={nInt(T.subscribers?.rows_real)} chip={`real list · +${nInt(T.subscribers?.new_real_30d)} in 30 d`} chipTone="near"
              rows={[['PMS · mailbox · DMC · manual', `${T.subscribers?.src_pms ?? '—'} · ${T.subscribers?.src_gmail ?? '—'} · ${T.subscribers?.src_dmc ?? '—'} · ${T.subscribers?.src_manual ?? '—'}`], ['Foreign-tenant rows in table', nInt(T.subscribers?.rows_foreign), Number(T.subscribers?.rows_foreign ?? 0) > 0 ? 'text-red-800' : ''], ...(T.subscribers?.groups ?? []).slice(0, 4).map((g) => [g.name, `${nInt(g.members)}${g.cadence_per_month ? ` · ${g.cadence_per_month}/mo` : ''}`] as [string, string]), ['Broadcasts sent, ever', `${nInt(T.subscribers?.sends_broadcast)} (${nInt(T.subscribers?.sends_lifecycle)} lifecycle, last ${nDate(T.subscribers?.last_send_date)})`, 'text-red-800'], ['Unsubscribes · bounces recorded', `${T.subscribers?.unsubscribed ?? '—'} · ${T.subscribers?.bounced ?? '—'}`, 'text-amber-700']]}
              cta="Open audience" ctaHref={`${base}/marketing/audience`} note={`blocklist ${T.subscribers?.blocklist_scoped ?? '—'} scoped, ${T.subscribers?.blocklist_unscoped ?? '—'} unscoped`} noteRed />
          </div>

          <div className="grid gap-x-8 lg:grid-cols-[2fr_1fr]">
            <section className="py-5">
              <h2 className="font-serif text-lg font-semibold">Execution pipeline</h2>
              <p className="mb-3 text-sm text-neutral-500">Planned to published. The last column is the one that pays.</p>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-neutral-500"><th className="pb-1.5 text-left font-medium">Stream</th><th className="text-right font-medium">Planned</th><th className="text-right font-medium">Approved</th><th className="text-right font-medium">Ready</th><th className="text-right font-medium">Published</th></tr></thead>
                <tbody>{(payload.pipeline ?? []).map((p) => (
                  <tr key={p.stream} className="border-b border-neutral-200"><td className="py-1.5">{p.stream.replace('_', ' ')}</td><td className="text-right">{nInt(p.planned)}</td><td className="text-right">{p.approved == null ? '—' : nInt(p.approved)}</td><td className="text-right">{p.ready == null ? '—' : nInt(p.ready)}</td><td className={`text-right font-semibold ${Number(p.published ?? 0) === 0 ? 'text-red-800' : ''}`}>{nInt(p.published)}</td></tr>))}</tbody>
              </table>
              <p className="mt-2 text-xs text-neutral-500">Content validator last ran {nInt(m.validator_days_stale)} d ago; approved items are not re-validated before publish.</p>
            </section>
            <section className="py-5">
              <h2 className="font-serif text-lg font-semibold">Channel notes</h2>
              <ul className="space-y-2 text-sm">
                <li><b>Social metrics are profile-level rolling windows.</b> <span className="text-neutral-500">No post ids, so no per-post performance.</span></li>
                <li><b>GA4 has no conversion or spend.</b> <span className="text-neutral-500">Session-to-booking uses PMS booking-engine source as proxy.</span></li>
                <li><b>Reach history starts {nDate(composite?.before_asof)}.</b> <span className="text-neutral-500">Month-on-month arrives as snapshots accumulate.</span></li>
              </ul>
            </section>
          </div>
        </div>
      )}

      {/* ================= SEGMENTS & FUNNELS ================= */}
      {tab === 'segments' && (
        <div role="tabpanel">
          <div className="mb-2 mt-5 flex items-baseline gap-3"><h2 className="font-serif text-lg font-semibold">Conversion and segments</h2><span className="text-sm text-neutral-500">funnels and who the guest is</span></div>
          <div className="grid gap-px border border-neutral-200 bg-neutral-200 md:grid-cols-2 lg:grid-cols-4">
            <Tile wide title="Funnels" sub="email funnels + PMS journey" big={nInt(T.funnels?.active_enrollments)} bigTone="text-red-800" chip={`contacts enrolled in ${nInt(T.funnels?.funnels_total)} email funnels`} chipTone="miss"
              cta="Open funnels" ctaHref={`${base}/marketing/funnels`} note={T.funnels?.bdc_is_global_attribution ? 'Booking.com funnel is a global table' : undefined}>
              <div className="mt-2 text-xs text-neutral-500">{nInt(T.funnels?.funnels_draft)} draft · {nInt(T.funnels?.funnels_scheduled)} scheduled · {nInt(T.funnels?.steps_total)} steps · sends {nInt(T.funnels?.sends)} · opens {nInt(T.funnels?.opens)} · clicks {nInt(T.funnels?.clicks)} · bookings {nInt(T.funnels?.bookings)}</div>
              <Steps items={[[nInt(T.funnels?.journey_reservations), 'reservations, check-in ±180 d'], [nInt(T.funnels?.journey_confirmed), `confirmed · ${nPct(T.funnels?.journey_confirm_pct, 0)}`], [nInt(T.funnels?.journey_arrived), `arrived · ${nPct(T.funnels?.journey_arrive_pct, 0)} of confirmed`], [nInt(T.funnels?.journey_cancelled), `cancelled · ${nPct(T.funnels?.journey_cancel_pct)}`, true]]} />
              <Steps items={[[nInt(T.funnels?.bdc_attempts), 'Booking.com attempts'], [nInt(T.funnels?.bdc_confirmed), 'confirmed'], [nInt(T.funnels?.bdc_cancelled_guest), 'guest cancellations', true], [nMoneyK(T.funnels?.bdc_leaked_usd), `leaked · realised ${nPct(T.funnels?.bdc_realization_pct)}`, true]]} />
            </Tile>
            <Tile title="Retreats & wellness" sub="ICP-classified, 89 d" big={nPct(T.retreats?.retreat_revenue_pct_89d)} bigTone="text-amber-700" chip="retreat revenue · 8% 2026 · 25% 2028" chipTone="near"
              rows={[['Retreat bookings · revenue', `${nInt(T.retreats?.retreat_bookings_89d)} · ${nMoneyK(T.retreats?.retreat_revenue_89d)}`], ['Retreat · group inquiries, 90 d', `${T.retreats?.retreat_inquiries_90d ?? '—'} · ${T.retreats?.group_inquiries_90d ?? '—'}`], ['Programmes defined (unreviewed)', `${T.retreats?.programmes_defined ?? '—'} (${T.retreats?.programmes_unreviewed ?? '—'})`], ['Retreat pages live → goal 4', nInt(T.retreats?.retreat_pages_live), 'text-red-800'], [`Spa revenue ${T.retreats?.spa_last_month ?? ''}`.trim(), `${nMoney(T.retreats?.spa_revenue_last_month)} · ${T.retreats?.spa_charges_last_month ?? '—'} charges · avg ${nMoney(T.retreats?.spa_avg_check_last_month)}`], ['Spa capture · RevPOR → $55', `${nPct(T.retreats?.spa_capture_pct_last_month)} · $${T.retreats?.spa_revpor_last_month ?? '—'} (YTD $${T.retreats?.spa_revpor_ytd ?? '—'})`, 'text-red-800']]}
              cta="Open retreats" ctaHref={`${base}/sales`} note="spa from PMS folio, USALI Spa" />
            <Tile title="Segment coverage" sub="ICP board, 89 d" big={nPct(T.icp_coverage?.bookings_matched_pct, 0)} bigTone="text-red-800" chip={`of ${nInt(T.icp_coverage?.bookings_total)} bookings classified`} chipTone="miss"
              rows={[['Revenue matched', `${nMoneyK(T.icp_coverage?.revenue_matched)} (${nPct(T.icp_coverage?.revenue_matched_pct, 0)})`], ['Profiles with zero bookings', `${nInt(T.icp_coverage?.profiles_zero_bookings)} of ${nInt(T.icp_coverage?.profiles_total)}`, 'text-red-800'], ['Target shares set', `${nInt(T.icp_coverage?.profiles_with_target)} of ${nInt(T.icp_coverage?.profiles_total)}`, 'text-red-800'], ['Trend feeds ingesting', `${nInt(T.icp_coverage?.feeds_ingesting)} of ${nInt(T.icp_coverage?.feeds_total)}`, 'text-red-800'], ['Snapshot week', nDate(T.icp_coverage?.snapshot_week)]]}
              cta="Classify bookings" ctaHref={`${base}/sales`} note="target list, not source of business" />
          </div>
          <section className="border-b border-neutral-200 py-5">
            <h2 className="font-serif text-lg font-semibold">Ideal customer profiles</h2>
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-neutral-500"><th className="pb-1.5 text-left font-medium">Profile</th><th className="font-medium">Type</th><th className="text-right font-medium">Bookings</th><th className="text-right font-medium">Revenue</th><th className="text-right font-medium">ADR</th><th className="text-right font-medium">Stay</th><th className="text-right font-medium">Share</th><th className="text-right font-medium">Target</th></tr></thead>
              <tbody>{icpProfiles.map((p) => (
                <tr key={p.icp_key} className={`border-b border-neutral-200 ${Number(p.bookings_89d ?? 0) === 0 ? 'text-neutral-400' : ''}`}><td className="py-1.5">{p.name}</td><td>{p.icp_type}</td><td className="text-right">{nInt(p.bookings_89d)}</td><td className="text-right">{nMoneyK(p.revenue_89d)}</td><td className="text-right">{nMoney(p.adr_89d)}</td><td className="text-right">{p.los_89d ?? '—'} n</td><td className="text-right">{nPct(p.actual_share_revenue_pct)}</td><td className="text-right">{p.target_share_pct == null ? '—' : nPct(p.target_share_pct)}</td></tr>))}</tbody>
            </table>
            <p className="mt-3 border-l-[3px] border-amber-600 bg-amber-50 px-3 py-2 text-sm"><b>Read this as a target list, not a source-of-business report.</b> Coverage is {nPct(T.icp_coverage?.bookings_matched_pct, 0)} of bookings and no profile has a target share, so the gap column is empty by construction.</p>
          </section>
        </div>
      )}

      {/* ================= GOALS & DATA ================= */}
      {tab === 'goals' && (
        <div role="tabpanel" className="grid gap-x-8 lg:grid-cols-[2fr_1fr]">
          <section className="py-5">
            <h2 className="font-serif text-lg font-semibold">Marketing goals, measured today</h2>
            <p className="mb-3 text-sm text-neutral-500">Active tenant goals marketing owns or moves. “Now” is computed live; “Stored” is what the goals table holds (written back nightly).</p>
            <table className="w-full text-xs">
              <thead><tr className="text-neutral-500"><th className="pb-1.5 text-left font-medium">Goal</th><th className="text-left font-medium">Target</th><th className="text-left font-medium">Now</th><th className="text-left font-medium">Stored</th><th className="text-left font-medium">Deadline</th><th className="text-left font-medium">Source</th></tr></thead>
              <tbody>{(payload.goals ?? []).map((g: Goal) => (
                <tr key={g.goal_id} className="border-b border-neutral-200 align-top"><td className="py-1.5 pr-2">{g.title}</td><td className="pr-2">{g.target_value ?? '—'} <span className="text-neutral-500">{g.metric}</span></td>
                  <td className={`whitespace-nowrap pr-2 font-medium ${g.status_flag === 'bad' ? 'text-red-800' : g.status_flag === 'warn' ? 'text-amber-700' : g.status_flag === 'ok' ? 'text-emerald-900' : 'font-normal text-neutral-500'}`}>{g.computed_label ?? 'not computed'}</td>
                  <td className="pr-2 text-neutral-500">{g.stored_current_value ?? '—'}</td><td className="whitespace-nowrap pr-2">{g.deadline ? nDate(g.deadline) : '—'}</td><td className="text-neutral-500">{g.computed_source ?? '—'}</td></tr>))}</tbody>
            </table>
          </section>
          <section className="py-5">
            <h2 className="font-serif text-lg font-semibold">Data health</h2>
            <ul className="space-y-2 text-sm">
              {freshness.filter((f) => f.status !== 'fresh').map((f) => (<li key={f.source_key}><b>{f.label}</b> <span className="text-neutral-500">— {f.asof ? `${nDate(f.asof)} (${f.days_old} d)` : 'missing'}</span></li>))}
              {Number(m.rows_foreign ?? 0) > 0 && <li><b>Subscriber list contains {nInt(m.rows_foreign)} foreign-tenant rows.</b></li>}
              {Number(m.test_rows ?? 0) > 0 && <li><b>{nInt(m.test_rows)} test inquiries in production.</b></li>}
              <li><b>SLH counts as OTA in the PMS.</b> <span className="text-neutral-500">Dashboard splits it out; goal 5 wording must pick one definition.</span></li>
              <li><b>ICP, Booking.com funnel, proposals, contracts, YouTube requests carry no property_id.</b> <span className="text-neutral-500">Attributed via dash_source_map.icp_module_owner.</span></li>
              {T.villa_direct && <li><b>{nInt(T.villa_direct.bookings_without_room_type_ytd)} YTD bookings have no room type.</b> <span className="text-neutral-500">Villa direct share excludes them.</span></li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------- section helpers ---------- */
function Bars({ rows, wide }: { rows: { label: string; pct: Num; ota?: boolean; right: string }[]; wide?: boolean }) {
  const max = Math.max(...rows.map((r) => Number(r.pct ?? 0)), 1);
  return (
    <ul className="text-xs">
      {rows.map((r) => (
        <li key={r.label} className={`grid items-center gap-2 py-0.5 ${wide ? 'grid-cols-[118px_1fr_88px]' : 'grid-cols-[44px_1fr_88px]'}`}>
          <span className="truncate">{r.label}</span>
          <div className="relative h-[9px] bg-emerald-100"><i className={`absolute inset-y-0 left-0 ${r.ota ? 'bg-amber-600' : 'bg-emerald-900'}`} style={{ width: `${(Number(r.pct ?? 0) / max) * 100}%` }} /></div>
          <span className="whitespace-nowrap text-right text-neutral-500">{r.right}</span>
        </li>
      ))}
    </ul>
  );
}

function ChannelMixTable({ rows }: { rows: { window_key: string; channel_dash: string; pct_revenue: Num; pct_nights: Num }[] }) {
  const chans = ['OTA', 'SLH', 'Direct', 'Wholesale', 'Group', 'Walk-In', 'Other'];
  const cell = (w: string, c: string, nights = false) => { const r = rows.find((x) => x.window_key === w && x.channel_dash === c); return r ? nPct(nights ? r.pct_nights : r.pct_revenue) : '—'; };
  return (
    <table className="w-full text-xs">
      <thead><tr className="text-neutral-500"><th className="pb-1 text-left font-medium">Channel</th><th className="text-right font-medium">Booked 90 d</th><th className="text-right font-medium">Booked 30 d</th><th className="text-right font-medium">Stays YTD</th><th className="text-right font-medium">OTB 90 d*</th></tr></thead>
      <tbody>{chans.filter((c) => rows.some((r) => r.channel_dash === c)).map((c) => (
        <tr key={c} className="border-b border-neutral-200"><td className="py-1">{c}</td><td className={`text-right ${c === 'OTA' ? 'font-semibold text-red-800' : ''}`}>{cell('booked_90d', c)}</td><td className="text-right">{cell('booked_30d', c)}</td><td className="text-right">{cell('stays_ytd', c)}</td><td className="text-right">{cell('otb_90d', c, true)}</td></tr>))}</tbody>
    </table>
  );
}

function Steps({ items }: { items: [string, string, boolean?][] }) {
  return (
    <div className="mt-3 flex text-xs">
      {items.map(([b, l, bad], i) => (<div key={i} className={`flex-1 border-t-[3px] pt-1 ${bad ? 'border-red-800' : 'border-emerald-900'} ${i ? 'ml-1.5' : ''}`}><b className="block font-serif text-lg font-normal leading-tight">{b}</b>{l}</div>))}
    </div>
  );
}
