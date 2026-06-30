// app/revenue/channels/[source]/page.tsx
// Per-source detail landing page.
//
// PBS 2026-06-30 (v4):
//   - 2 back routes: ← Channels  AND  ← B2B/DMC (visible when DMC matched)
//   - All KPI tiles carry 3 trailing windows (L30d / L90d / L365d) via
//     KpiTile.compare[] (native primitive support, not a custom local atom)
//   - Daily revenue subtitle clarifies window + sum + tooltip retained
//   - Room-type mix moved to DataTable primitive (no legacy <table className="tbl">)
//   - DMC panel: ink-black labels, Edit + Preview Contract buttons inline
//   - When DMC contract matches: Channel-contact container suppressed (no dup)

import Link from 'next/link';
import {
  DashboardPage, Container, KpiTile,
  type DashboardTab, type KpiTileProps, type KpiComparison,
} from '@/app/(cockpit)/_design';
import BackButton from '@/components/nav/BackButton';
import RoomTypeMixTable from './_components/RoomTypeMixTable';
import DmcContractEditPanel from './_components/DmcContractEditPanel';
import { REVENUE_SUBPAGES } from '../../_subpages';
import { resolvePeriod } from '@/lib/period';
import {
  getChannelEconomicsForRange,
  getChannelDailyForRange,
  getChannelRoomMixForRange,
  getChannelPickupForSource,
} from '@/lib/data-channels';
import { getDmcContracts, matchSourceToContract, type DmcContract } from '@/lib/dmc';
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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { source: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const OTA_RX = /booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka|synxis/i;
const DIRECT_RX = /direct|website|booking engine|email|walk[\- ]?in/i;
const WHOLESALE_RX = /hotelbeds|gta|tourico|wholesale|bonotel|miki|reseller|khiri|trails of/i;

function categorize(name: string, isDmc: boolean): 'OTA' | 'Direct' | 'Wholesale' | 'DMC' | 'Other' {
  if (OTA_RX.test(name)) return 'OTA';
  if (DIRECT_RX.test(name)) return 'Direct';
  if (WHOLESALE_RX.test(name)) return 'Wholesale';
  if (isDmc) return 'DMC';
  return 'Other';
}

function shortDay(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
  catch { return iso; }
}

function isoBack(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export default async function ChannelDetailPage({ params, searchParams }: Props) {
  const sourceName = decodeURIComponent(params.source);
  const isBookingCom = /Booking\.com/i.test(sourceName);
  const sp = (searchParams?.win) ? searchParams : { ...searchParams, win: 'l12m' };
  const period = resolvePeriod(sp);

  const today = new Date().toISOString().slice(0, 10);
  const d30  = isoBack(30);
  const d90  = isoBack(90);
  const d365 = isoBack(365);

  const [econ30, econ90, econ365, dailyRows, mixRows, pickupRows, dmcContracts] = isBookingCom
    ? [[], [], [], [], [], [], [] as DmcContract[]] as const
    : await Promise.all([
        getChannelEconomicsForRange(d30,  today).catch(() => []),
        getChannelEconomicsForRange(d90,  today).catch(() => []),
        getChannelEconomicsForRange(d365, today).catch(() => []),
        getChannelDailyForRange(sourceName, period.from, period.to).catch(() => []),
        getChannelRoomMixForRange(sourceName, period.from, period.to).catch(() => []),
        getChannelPickupForSource(sourceName, 28).catch(() => []),
        getDmcContracts().catch(() => [] as DmcContract[]),
      ]);

  const m30  = econ30.find((r)  => r.source_name === sourceName);
  const m90  = econ90.find((r)  => r.source_name === sourceName);
  const m365 = econ365.find((r) => r.source_name === sourceName);

  const dmcMatch = !isBookingCom
    ? matchSourceToContract(sourceName, dmcContracts)
    : { contract_id: null, partner_short_name: null };
  const dmcContract: DmcContract | null = dmcMatch.contract_id
    ? dmcContracts.find((c) => c.contract_id === dmcMatch.contract_id) ?? null
    : null;

  const cat = categorize(sourceName, !!dmcContract);
  const hasAnyBookings = !!m365 && m365.bookings > 0;

  // ─── Booking.com — hardwired BDC layout (unchanged) ─────────────────────
  if (isBookingCom) {
    const bdcTab = (() => {
      const raw = String(searchParams.bdc_tab ?? 'now').toLowerCase();
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
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <BackButton fallback="/revenue/channels" label="← Channels" />
          </div>
        }
      >
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

  // ─── Trailing-window helpers ────────────────────────────────────────────
  const v = (m: typeof m30, k: 'bookings'|'canceled'|'gross_revenue'|'roomnights'|'adr'|'commission_pct'|'commission_usd'|'cancel_pct'|'avg_lead_days'|'avg_los') =>
    m ? Number((m as Record<string, unknown>)[k] ?? 0) : 0;

  const netAdr = (m: typeof m30) => v(m, 'adr') * (1 - v(m, 'commission_pct') / 100);

  // Build [L90d, L365d] compare arrays for each tile (main value = L30d).
  const cmp = (
    label: string,
    val90: number,
    val365: number,
    format: 'absolute' | 'currency' | 'percent' = 'absolute',
  ): KpiComparison[] => [
    { label: 'L90d',  value: val90,  format, direction: 'flat' },
    { label: 'L365d', value: val365, format, direction: 'flat' },
  ];

  const dailyMaxRev = Math.max(1, ...dailyRows.map((d) => d.gross_revenue));
  const dailyTotalRev = dailyRows.reduce((s, d) => s + d.gross_revenue, 0);
  const dailyTotalBkg = dailyRows.reduce((s, d) => s + d.bookings, 0);
  const pickupMax = Math.max(1, ...pickupRows.map((d) => d.bookings));
  const pickupTotalBkg = pickupRows.reduce((s, d) => s + d.bookings, 0);
  let totalMixRev = 0;
  for (const r of mixRows) totalMixRev += r.gross_revenue;

  const mainTabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels'),
  }));

  return (
    <DashboardPage
      title={sourceName}
      subtitle={`Revenue · Channels · ${sourceName} · ${cat} · trailing L30d / L90d / L365d`}
      tabs={mainTabs}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <BackButton fallback="/revenue/channels" label="← Channels" />
          {dmcContract && (
            <Link href="/sales/b2b" style={navBtnStyle}>← B2B / DMC</Link>
          )}
        </div>
      }
    >
      {/* (1) Explanatory pane at the TOP when there are no bookings even in L365 */}
      {!hasAnyBookings && (
        <div style={{ gridColumn: '1 / -1', padding: '12px 16px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            No bookings on file for {sourceName} ({cat})
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            This source is tracked but has not produced bookings in PMS history. Possible reasons: (a) the partnership is new, (b) the partner books under a different source name in Cloudbeds, or (c) the relationship is dormant.{dmcContract ? ' Contract terms below.' : ''}
          </div>
        </div>
      )}

      {/* (2) DMC contract panel (when matched) — inline read/edit */}
      {dmcContract && (
        <div style={{ gridColumn: '1 / -1' }}>
          <DmcContractEditPanel contract={dmcContract} />
        </div>
      )}

      {/* (3) Trailing-window KPI tiles — L30d main · L90d + L365d via compare[] */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12, marginBottom: 14 }}>
        {([
          { label: 'Bookings',      value: v(m30, 'bookings'),                                                size: 'md', footnote: `${v(m30, 'canceled')} cancelled · L30d`,
            compare: cmp('Bookings', v(m90, 'bookings'), v(m365, 'bookings')) },
          { label: 'Gross revenue', value: Math.round(v(m30, 'gross_revenue')), currency: 'USD',              size: 'md', footnote: `${v(m30, 'roomnights')} RN · L30d`,
            compare: cmp('Gross', Math.round(v(m90, 'gross_revenue')), Math.round(v(m365, 'gross_revenue')), 'currency') },
          { label: 'ADR',           value: Math.round(v(m30, 'adr')),           currency: 'USD',              size: 'md', footnote: 'rev ÷ RNs · L30d',
            compare: cmp('ADR', Math.round(v(m90, 'adr')), Math.round(v(m365, 'adr')), 'currency') },
          { label: 'Net ADR',       value: Math.round(netAdr(m30)),             currency: 'USD',              size: 'md', footnote: `after ${v(m30, 'commission_pct').toFixed(0)}% commission · L30d`,
            compare: cmp('Net ADR', Math.round(netAdr(m90)), Math.round(netAdr(m365)), 'currency') },
          { label: 'Commission',    value: Math.round(v(m30, 'commission_usd')), currency: 'USD',             size: 'md', footnote: v(m30, 'gross_revenue') > 0 ? `${(v(m30, 'commission_usd') / v(m30, 'gross_revenue') * 100).toFixed(1)}% of rev · L30d` : '—',
            status: (v(m30, 'commission_pct') >= 18 ? 'amber' : 'green') as 'amber' | 'green',
            compare: cmp('Commission', Math.round(v(m90, 'commission_usd')), Math.round(v(m365, 'commission_usd')), 'currency') },
          { label: 'Cancel rate',   value: `${v(m30, 'cancel_pct').toFixed(1)}%`,                              size: 'md', footnote: `${v(m30, 'canceled')} of ${v(m30, 'bookings') + v(m30, 'canceled')} · L30d`,
            status: (v(m30, 'cancel_pct') >= 25 ? 'red' : v(m30, 'cancel_pct') >= 10 ? 'amber' : 'green') as 'red' | 'amber' | 'green',
            compare: cmp('Cancel', Number(v(m90, 'cancel_pct').toFixed(1)), Number(v(m365, 'cancel_pct').toFixed(1)), 'percent') },
          { label: 'Lead time',     value: `${Math.round(v(m30, 'avg_lead_days'))}d`,                          size: 'md', footnote: 'booking → arrival · L30d',
            compare: cmp('Lead', Math.round(v(m90, 'avg_lead_days')), Math.round(v(m365, 'avg_lead_days'))) },
          { label: 'LOS',           value: v(m30, 'avg_los').toFixed(1),                                       size: 'md', footnote: 'nights / stay · L30d',
            compare: cmp('LOS', Number(v(m90, 'avg_los').toFixed(1)), Number(v(m365, 'avg_los').toFixed(1))) },
        ] as KpiTileProps[]).map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* (4) Daily revenue trend */}
      <Container
        title={`Daily revenue · ${period.label}`}
        subtitle={`${dailyRows.length} active dates · $${Math.round(dailyTotalRev).toLocaleString('en-US')} total · ${dailyTotalBkg} bookings · max $${Math.round(dailyMaxRev).toLocaleString('en-US')}/day · hover a bar for details`}
      >
        {dailyRows.length === 0 ? (
          <Empty>No bookings from this source in the last 12 months.</Empty>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minHeight: 160, padding: '8px 0', borderBottom: '1px solid var(--paper-deep)' }}>
            {dailyRows.map((d) => {
              const h = (d.gross_revenue / dailyMaxRev) * 140;
              return (
                <div
                  key={d.day}
                  title={`${shortDay(d.day)} · ${d.bookings} bkg · ${d.room_nights} RN · $${Math.round(d.gross_revenue).toLocaleString('en-US')}`}
                  style={{ flex: 1, height: Math.max(2, h), minWidth: 2, background: 'var(--brass)', opacity: 0.85 }}
                />
              );
            })}
          </div>
        )}
      </Container>

      {/* (5) Pickup velocity last 28 days */}
      <Container
        title="Pickup velocity · last 28 days"
        subtitle={`${pickupTotalBkg} new bookings · ${pickupRows.length} days · max ${pickupMax}/day · hover for daily count`}
      >
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

      {/* (6) Room-type mix — DataTable primitive (no legacy .tbl) */}
      <Container
        title={`Room-type mix · ${period.label}`}
        subtitle={`${mixRows.length} room types · $${Math.round(totalMixRev).toLocaleString('en-US')} total`}
      >
        <RoomTypeMixTable rows={mixRows as Array<{ room_type_name: string; bookings: number; room_nights: number; gross_revenue: number; share_pct: number; }>} />
      </Container>

      {/* (7) Channel contact — only when there is NO DMC contract */}
      {!dmcContract && (
        <Container title="Channel contact" subtitle="Edit at /settings/channel-contacts">
          <ChannelContactCard sourceName={sourceName} />
        </Container>
      )}

      {/* (8) Decisions queue placeholder */}
      <Container title="Decisions queued for this source" subtitle="Filtered by source_agent or scope_section · governance.decision_queue">
        <Empty>No decisions queued. An agent watching {sourceName} will populate this when it detects an actionable play.</Empty>
      </Container>
    </DashboardPage>
  );
}


// ─── Local UI atoms ─────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '5px 12px', fontSize: 11, letterSpacing: '0.08em',
  textTransform: 'uppercase', fontWeight: 600,
  background: 'transparent', color: 'var(--ink, #1B1B1B)',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4, textDecoration: 'none',
};


function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
      {children}
    </div>
  );
}
