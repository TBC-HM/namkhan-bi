// app/revenue/channels/[source]/page.tsx
// Per-source (OTA / Direct / Wholesale) detail landing page.
// Source slug = encodeURIComponent(source_name).
//
// All numbers live from Supabase. No hardcoded narrative.
// Empty placeholder cards left for: BDC search impressions, OTA ranking,
// content score, photo audit — PBS will populate from Booking.com download.

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { REVENUE_SUBPAGES } from '../../_subpages';
import { resolvePeriod } from '@/lib/period';
import {
  getChannelEconomicsForRange,
  getChannelDailyForRange,
  getChannelRoomMixForRange,
  getChannelPickupForSource,
} from '@/lib/data-channels';
import { fmtMoney } from '@/lib/format';
import BdcPanels from '@/components/channels/BdcPanels';
import BdcExtraPanels from '@/components/channels/BdcExtraPanels';
import BdcAttentionCards from '@/components/channels/BdcAttentionCards';
import BdcTrends from '@/components/channels/BdcTrends';
import BdcSignals from '@/components/channels/BdcSignals';
import BdcHeroStrip from '@/components/channels/BdcHeroStrip';
import BdcKpiStrip from '@/components/channels/BdcKpiStrip';
import BdcProfileTab from '@/components/channels/BdcProfileTab';
import ChannelContactCard from '@/components/channels/ChannelContactCard';
import { MaybeOtaBadge } from '@/components/ota/OtaBadge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// 2026-05-06 cache-bust marker after RLS fix

interface Props {
  params: { source: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka|synxis/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[\- ]?in/i;
const WHOLESALE_RX = /hotelbeds|gta|tourico|wholesale|bonotel|miki|reseller|khiri|trails of/i;

function categorize(name: string): 'OTA' | 'Direct' | 'Wholesale' | 'Other' {
  if (OTA_RX.test(name)) return 'OTA';
  if (DIRECT_RX.test(name)) return 'Direct';
  if (WHOLESALE_RX.test(name)) return 'Wholesale';
  return 'Other';
}

function shortDay(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

export default async function ChannelDetailPage({ params, searchParams }: Props) {
  const sourceName = decodeURIComponent(params.source);
  const isBookingCom = /Booking\.com/i.test(sourceName);
  // PBS 2026-06-29: default to last-12-months. Covers every active source's bookings
  // without the heavy all-time scan (which made clicks "take forever" on cold caches).
  // Zero-history sources fall through to the profile fallback. User can override via ?win=
  const sp = (searchParams?.win) ? searchParams : { ...searchParams, win: 'l12m' };
  const period = resolvePeriod(sp);
  const cmpFrom = period.compareFrom;
  const cmpTo = period.compareTo;

  // For Booking.com we don't need the period-scoped channel-economics panels
  // since the BDC block has its own 12-month data. Skip the heavy queries.
  const [allRows, allCmpRows, dailyRows, mixRows, pickupRows] = isBookingCom
    ? [[], [], [], [], []] as const
    : await Promise.all([
        getChannelEconomicsForRange(period.from, period.to).catch(() => []),
        cmpFrom && cmpTo
          ? getChannelEconomicsForRange(cmpFrom, cmpTo).catch(() => [])
          : Promise.resolve([]),
        getChannelDailyForRange(sourceName, period.from, period.to).catch(() => []),
        getChannelRoomMixForRange(sourceName, period.from, period.to).catch(() => []),
        getChannelPickupForSource(sourceName, 28).catch(() => []),
      ]);

  const meta = allRows.find((r) => r.source_name === sourceName);
  const cmpMeta = allCmpRows.find((r) => r.source_name === sourceName);
  const cat = categorize(sourceName);
  // PBS 2026-06-29: l12m default covers active sources without the perf hit of an
  // all-time widen. Aliases for downstream code (was effectiveDaily/Mix previously).
  const effectiveDaily = dailyRows;
  const effectiveMix   = mixRows;
  const widenedToAllTime = false;

  // Booking.com — primitives shell (PBS #201). 4 tabs collapsed to 3: Now / Profile / History.
  // History merges Trends + Signals (both time-axis agent views).
  if (isBookingCom) {
    const bdcTab = (() => {
      const raw = String(searchParams.bdc_tab ?? 'now').toLowerCase();
      // Backwards-compat: old "trend" + "signals" URLs both land on "history".
      if (raw === 'trend' || raw === 'signals') return 'history';
      if (raw === 'now' || raw === 'profile' || raw === 'history') return raw;
      return 'now';
    })();
    const tabBaseHref = `/revenue/channels/${encodeURIComponent(sourceName)}`;
    const revenueTabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
      key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels'),
    }));
    return (
      <DashboardPage
        title={sourceName}
        subtitle={`Revenue · Channels · ${sourceName} — Booking.com hardwired data`}
        tabs={revenueTabs}
        action={<Link href="/settings/channel-contacts" style={{
          padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 600,
          background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
          borderRadius: 4, textDecoration: 'none',
        }}>⚙ Channel settings</Link>}
      >

        {/* Sub-tab strip — 3 tabs now */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 0, borderBottom: '1px solid var(--hairline, #E6DFCC)', marginBottom: 8 }}>
          {[
            { key: 'now',     label: 'Now',     sub: 'Live snapshot · actions · signals' },
            { key: 'profile', label: 'Profile', sub: 'Crawler · recs · outcomes' },
            { key: 'history', label: 'History', sub: 'Trends + agent decision queue' },
          ].map((t) => {
            const active = bdcTab === t.key;
            return (
              <Link
                key={t.key}
                href={`${tabBaseHref}?bdc_tab=${t.key}`}
                style={{
                  padding: '10px 18px',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: active ? 'var(--ink, #1B1B1B)' : 'var(--ink-soft, #5A5A5A)',
                  borderBottom: active ? '2px solid var(--primary, #1F3A2E)' : '2px solid transparent',
                  textDecoration: 'none',
                  fontWeight: active ? 600 : 500,
                  marginBottom: -1,
                }}
              >
                <div>{t.label}</div>
                <div style={{ fontSize: 10, textTransform: 'none', letterSpacing: 'normal', color: 'var(--ink-soft, #5A5A5A)', marginTop: 2, fontWeight: 400 }}>{t.sub}</div>
              </Link>
            );
          })}
        </div>

        {bdcTab === 'now' && (
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'flex-start' }}>
            <ChannelContactCard sourceName={sourceName} />
            <div>
              <BdcKpiStrip />
              <BdcHeroStrip />
              <BdcAttentionCards />
              <BdcExtraPanels />
              <BdcPanels />
            </div>
          </div>
        )}
        {bdcTab === 'profile' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <BdcProfileTab otaSource="Booking.com" />
          </div>
        )}
        {bdcTab === 'history' && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Container title="Trends" subtitle="ranking · book-window · country deltas — needs 3+ snapshots to fill">
              <BdcTrends />
            </Container>
            <Container title="Signals" subtitle="agent decisions queued — governance.decision_queue">
              <BdcSignals />
            </Container>
          </div>
        )}
      </DashboardPage>
    );
  }

  if (!meta) {
    const noMetaTabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
      key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels'),
    }));
    return (
      <DashboardPage
        title={sourceName}
        subtitle={`Revenue · Channels · ${sourceName} · ${cat} · no bookings on file`}
        tabs={noMetaTabs}
        action={<Link href="/settings/channel-contacts" style={{
          padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontWeight: 600,
          background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
          borderRadius: 4, textDecoration: 'none',
        }}>⚙ Channel settings</Link>}
      >
        {/* PBS 2026-06-29: every source has a landing, even with zero bookings.
            Show the channel contact + linked DMC contract + category context so
            the user knows the source exists and is being tracked. */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'flex-start', marginTop: 12 }}>
          <ChannelContactCard sourceName={sourceName} />
          <div style={{
            padding: 18, background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)',
            borderRadius: 6, color: 'var(--ink)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              No bookings on file
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5 }}>
              {sourceName} is tracked as a <strong>{cat}</strong> channel but has not produced any bookings in your PMS history. This could mean: (a) the partnership is new, (b) the partner books under a different source name in Cloudbeds, or (c) the relationship is dormant.
              {cat === 'DMC' && (
                <> Check the contract details under <Link href="/sales/b2b" style={{ color: 'var(--brass)' }}>B2B / DMC</Link> for commercial terms.</>
              )}
            </div>
          </div>
        </div>
      </DashboardPage>
    );
  }

  const netAdr = Number(meta.adr || 0) * (1 - Number(meta.commission_pct || 0) / 100);
  const dailyMaxRev = Math.max(1, ...effectiveDaily.map((d) => d.gross_revenue));
  const pickupMax = Math.max(1, ...pickupRows.map((d) => d.bookings));
  let totalMixRev = 0;
  for (const r of effectiveMix) totalMixRev += r.gross_revenue;

  // Delta helper using cmp data
  function delta(now: number, prior: number, suffix = ''): { text: string; tone: 'pos' | 'neg' | 'flat' } {
    if (!cmpFrom || prior === 0) return { text: suffix || '—', tone: 'flat' };
    const pct = ((now - prior) / prior) * 100;
    const arrow = pct > 0.5 ? '▲' : pct < -0.5 ? '▼' : '·';
    const tone = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'pos' : 'neg';
    return { text: `${arrow} ${Math.abs(pct).toFixed(0)}% ${period.cmpLabel.replace('vs ', '')}`, tone };
  }

  const mainTabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels'),
  }));

  return (
    <DashboardPage
      title={sourceName}
      subtitle={`Revenue · Channels · ${sourceName} · ${cat} · ${period.label}`}
      tabs={mainTabs}
      action={<Link href="/settings/channel-contacts" style={{
        padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em',
        textTransform: 'uppercase', fontWeight: 600,
        background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
        borderRadius: 4, textDecoration: 'none',
      }}>⚙ Channel settings</Link>}
    >

      {/* HERO KPI strip — 8 tiles on v6/v7 KpiTile primitive */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12, marginBottom: 14 }}>
        {([
          { label: 'Bookings',     value: meta.bookings,                                                       size: 'sm', footnote: `${meta.canceled} cancelled` },
          { label: 'Gross revenue', value: Math.round(Number(meta.gross_revenue)),  currency: 'USD',           size: 'sm', footnote: `${meta.roomnights} room nights` },
          { label: 'ADR',          value: Math.round(Number(meta.adr)),             currency: 'USD',           size: 'sm', footnote: 'rev ÷ RNs' },
          { label: 'Net ADR',      value: Math.round(netAdr),                       currency: 'USD',           size: 'sm', footnote: `after ${Number(meta.commission_pct).toFixed(0)}% commission` },
          { label: 'Commission',   value: Math.round(Number(meta.commission_usd)),  currency: 'USD',           size: 'sm', footnote: `${(Number(meta.commission_usd) / Math.max(1, Number(meta.gross_revenue)) * 100).toFixed(1)}% of rev`, status: (Number(meta.commission_pct) >= 18 ? 'amber' : 'green') as 'amber' | 'green' },
          { label: 'Cancel rate',  value: `${Number(meta.cancel_pct).toFixed(1)}%`,                            size: 'sm', footnote: `${meta.canceled} of ${meta.bookings + meta.canceled}`, status: (Number(meta.cancel_pct) >= 25 ? 'red' : Number(meta.cancel_pct) >= 10 ? 'amber' : 'green') as 'red' | 'amber' | 'green' },
          { label: 'Lead time',    value: `${Math.round(Number(meta.avg_lead_days || 0))}d`,                  size: 'sm', footnote: 'booking → arrival' },
          { label: 'LOS',          value: Number(meta.avg_los || 0).toFixed(1),                                size: 'sm', footnote: 'nights / stay' },
        ] as KpiTileProps[]).map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* Daily revenue trend — auto-widens to all-time when the active window is empty */}
      <Container title={`Daily revenue · ${widenedToAllTime ? 'all time' : period.label}`} subtitle={`${effectiveDaily.length} active dates · max $${dailyMaxRev.toFixed(0)}${widenedToAllTime ? ' · widened to all-time (no bookings in active window)' : ''}`}>
        {effectiveDaily.length === 0 ? (
          <Empty>No bookings from this source on these dates.</Empty>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minHeight: 160, padding: '8px 0', borderBottom: '1px solid var(--paper-deep)' }}>
            {effectiveDaily.map((d) => {
              const h = (d.gross_revenue / dailyMaxRev) * 140;
              return (
                <div
                  key={d.day}
                  title={`${shortDay(d.day)} · ${d.bookings} bkg · ${d.room_nights} RN · $${d.gross_revenue.toFixed(0)}`}
                  style={{ flex: 1, height: Math.max(2, h), minWidth: 2, background: 'var(--brass)', opacity: 0.85 }}
                />
              );
            })}
          </div>
        )}
      </Container>

      {/* Pickup velocity for this source — last 28 days */}
      <Container title="Pickup velocity · last 28 days" subtitle="Daily NEW bookings made (booking_date)">
        {pickupRows.length === 0 ? (
          <Empty>No new bookings made from this source in the last 28 days.</Empty>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, minHeight: 120, padding: '6px 0', borderBottom: '1px solid var(--paper-deep)' }}>
            {pickupRows.map((d) => {
              const h = (d.bookings / pickupMax) * 100;
              return (
                <div
                  key={d.day}
                  title={`${shortDay(d.day)} · ${d.bookings} new bkg`}
                  style={{ flex: 1, height: Math.max(2, h), minWidth: 4, background: 'var(--moss-glow)', opacity: 0.85, borderRadius: '2px 2px 0 0' }}
                />
              );
            })}
          </div>
        )}
      </Container>

      {/* Room-type mix */}
      <Container title={`Room-type mix · ${widenedToAllTime ? 'all time' : period.label}`} subtitle={`${effectiveMix.length} room types · total $${totalMixRev.toFixed(0)}`}>
        {effectiveMix.length === 0 ? (
          <Empty>No room-type mix to report.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Room type</th>
                <th className="num">Bookings</th>
                <th className="num">Room nights</th>
                <th className="num">Revenue</th>
                <th className="num">Share</th>
                <th>Bar</th>
              </tr>
            </thead>
            <tbody>
              {effectiveMix.map((r) => (
                <tr key={r.room_type_name}>
                  <td className="lbl"><strong>{r.room_type_name}</strong></td>
                  <td className="num">{r.bookings}</td>
                  <td className="num">{r.room_nights}</td>
                  <td className="num">{fmtMoney(r.gross_revenue, 'USD')}</td>
                  <td className="num">{r.share_pct.toFixed(1)}%</td>
                  <td><div style={{ height: 8, background: 'var(--brass)', opacity: 0.6, width: `${r.share_pct}%`, maxWidth: 200, borderRadius: 2 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Container>

      {/* Other OTAs — placeholders until per-OTA exports are wired */}
      {cat === 'OTA' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <Empty title="Search impressions / clicks / ranking">
            Per-OTA partner API or extranet export needed. Once loaded into a `revenue.{`{ota}`}_*` table this card auto-populates (Booking.com is wired — see above).
          </Empty>
          <Empty title="Content score · photos · description">
            OTA scorecard import pending for {sourceName}.
          </Empty>
          <Empty title="Promo activity">
            Cross-link to <Link href="/revenue/compset" style={{ color: 'var(--brass)' }}>Comp Set promo signals</Link>.
          </Empty>
          <Empty title="Cancellation reason mix">
            PMS doesn&apos;t expose cancellation reason structured. Empty until {sourceName} channel manager exposes it.
          </Empty>
        </div>
      )}

      {/* Source-anchored decisions queue (placeholder — no rows yet) */}
      <Container title="Decisions queued for this source" subtitle="Filtered by source_agent or scope_section · governance.decision_queue">
        <Empty>No decisions queued. An agent watching {sourceName} will populate this when it detects an actionable play.</Empty>
      </Container>
    </DashboardPage>
  );
}

// ─── Local UI atoms ─────────────────────────────────────────────────────────

// PBS 2026-06-30: local Tile retired — using KpiTile primitive everywhere now.

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)' }}>{title}</h2>
        {sub && <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
      {title && <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>{title}</div>}
      {children}
    </div>
  );
}
