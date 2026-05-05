// app/revenue/channels/[source]/page.tsx
// Per-source (OTA / Direct / Wholesale) detail landing page.
// Source slug = encodeURIComponent(source_name).
//
// All numbers live from Supabase. No hardcoded narrative.
// Empty placeholder cards left for: BDC search impressions, OTA ranking,
// content score, photo audit — PBS will populate from Booking.com download.

import Link from 'next/link';
import PageHeader from '@/components/layout/PageHeader';
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

export const dynamic = 'force-dynamic';
export const revalidate = 60;

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
  const period = resolvePeriod(searchParams);
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

  // Booking.com — clean page: header + tabs + new layout. Skip standard 30-day panels.
  if (isBookingCom) {
    const bdcTab = String(searchParams.bdc_tab ?? 'now').toLowerCase();
    const tabBaseHref = `/revenue/channels/${encodeURIComponent(sourceName)}`;
    return (
      <>
        <PageHeader
          pillar="Revenue"
          tab="Channels"
          title={<>{sourceName}</>}
          lede={
            <>
              OTA · commission <strong>18%</strong> · 12-month rolling window from BDC reservations
              {' · '}<Link href="/revenue/channels" style={{ color: 'var(--brass)' }}>← All channels</Link>
            </>
          }
          rightSlot={
            <Link
              href="/settings/channel-contacts"
              style={{
                padding: '8px 14px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-extra)',
                color: 'var(--paper-warm)',
                background: 'var(--moss)',
                border: 'none',
                borderRadius: 4,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ⚙ Channel settings
            </Link>
          }
        />

        <div style={{ display: 'flex', gap: 0, marginTop: 12, marginBottom: 14, borderBottom: '1px solid var(--paper-deep)' }}>
          {[
            { key: 'now',     label: 'Now',     sub: 'Latest snapshot + actions' },
            { key: 'profile', label: 'Profile', sub: 'Crawler · recs · outcomes' },
            { key: 'trend',   label: 'Trends',  sub: 'History over time' },
            { key: 'signals', label: 'Signals', sub: 'Agent decisions queued' },
          ].map((t) => {
            const active = bdcTab === t.key;
            return (
              <Link
                key={t.key}
                href={`${tabBaseHref}?bdc_tab=${t.key}`}
                style={{
                  padding: '10px 18px',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--t-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-extra)',
                  color: active ? 'var(--ink)' : 'var(--ink-mute)',
                  borderBottom: active ? '2px solid var(--brass)' : '2px solid transparent',
                  textDecoration: 'none',
                  marginBottom: -1,
                }}
              >
                <div>{t.label}</div>
                <div style={{ fontSize: '10px', textTransform: 'none', letterSpacing: 'normal', color: 'var(--ink-mute)', marginTop: 2 }}>{t.sub}</div>
              </Link>
            );
          })}
        </div>

        {bdcTab === 'now' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'flex-start' }}>
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
        {bdcTab === 'profile' && <BdcProfileTab otaSource="Booking.com" />}
        {bdcTab === 'trend' && <BdcTrends />}
        {bdcTab === 'signals' && <BdcSignals />}
      </>
    );
  }

  if (!meta) {
    return (
      <>
        <PageHeader
          pillar="Revenue"
          tab="Channels"
          title={<>{sourceName}</>}
          lede={<>No bookings from this source in the active window. <Link href="/revenue/channels" style={{ color: 'var(--brass)' }}>← Back to all channels</Link></>}
          rightSlot={
            <Link
              href="/settings/channel-contacts"
              style={{
                padding: '8px 14px',
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-extra)',
                color: 'var(--paper-warm)',
                background: 'var(--moss)',
                border: 'none',
                borderRadius: 4,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              ⚙ Channel settings
            </Link>
          }
        />
      </>
    );
  }

  const netAdr = Number(meta.adr || 0) * (1 - Number(meta.commission_pct || 0) / 100);
  const dailyMaxRev = Math.max(1, ...dailyRows.map((d) => d.gross_revenue));
  const pickupMax = Math.max(1, ...pickupRows.map((d) => d.bookings));
  let totalMixRev = 0;
  for (const r of mixRows) totalMixRev += r.gross_revenue;

  // Delta helper using cmp data
  function delta(now: number, prior: number, suffix = ''): { text: string; tone: 'pos' | 'neg' | 'flat' } {
    if (!cmpFrom || prior === 0) return { text: suffix || '—', tone: 'flat' };
    const pct = ((now - prior) / prior) * 100;
    const arrow = pct > 0.5 ? '▲' : pct < -0.5 ? '▼' : '·';
    const tone = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'pos' : 'neg';
    return { text: `${arrow} ${Math.abs(pct).toFixed(0)}% ${period.cmpLabel.replace('vs ', '')}`, tone };
  }

  return (
    <>
      <PageHeader
        pillar="Revenue"
        tab="Channels"
        title={<>{sourceName}</>}
        lede={
          <>
            {cat} · commission <strong>{Number(meta.commission_pct).toFixed(0)}%</strong> · {period.label} · {period.rangeLabel}
            {' · '}<Link href="/revenue/channels" style={{ color: 'var(--brass)' }}>← All channels</Link>
          </>
        }
        rightSlot={
          <Link
            href="/settings/channel-contacts"
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--mono)',
              fontSize: 'var(--t-xs)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--ls-extra)',
              color: 'var(--paper-warm)',
              background: 'var(--moss)',
              border: 'none',
              borderRadius: 4,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            ⚙ Channel settings
          </Link>
        }
      />

      {/* HERO KPI strip — 8 tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12, marginBottom: 14 }}>
        <Tile label="Bookings" value={String(meta.bookings)} sub={`${meta.canceled} cancelled`}
          deltaText={delta(meta.bookings, cmpMeta?.bookings ?? 0).text}
          deltaTone={delta(meta.bookings, cmpMeta?.bookings ?? 0).tone}
        />
        <Tile label="Gross revenue" value={fmtMoney(Number(meta.gross_revenue), 'USD')} sub={`${meta.roomnights} room nights`}
          deltaText={delta(Number(meta.gross_revenue), Number(cmpMeta?.gross_revenue ?? 0)).text}
          deltaTone={delta(Number(meta.gross_revenue), Number(cmpMeta?.gross_revenue ?? 0)).tone}
        />
        <Tile label="ADR" value={fmtMoney(Number(meta.adr), 'USD')} sub="rev ÷ RNs"
          deltaText={delta(Number(meta.adr), Number(cmpMeta?.adr ?? 0)).text}
          deltaTone={delta(Number(meta.adr), Number(cmpMeta?.adr ?? 0)).tone}
        />
        <Tile label="Net ADR" value={fmtMoney(netAdr, 'USD')} sub={`after ${Number(meta.commission_pct).toFixed(0)}% commission`} />
        <Tile label="Commission $" value={fmtMoney(Number(meta.commission_usd), 'USD')} sub={`${(Number(meta.commission_usd) / Math.max(1, Number(meta.gross_revenue)) * 100).toFixed(1)}% of rev`} tone={Number(meta.commission_pct) >= 18 ? 'warn' : 'flat'} />
        <Tile label="Cancel %" value={`${Number(meta.cancel_pct).toFixed(1)}%`} sub={`${meta.canceled} of ${meta.bookings + meta.canceled}`} tone={Number(meta.cancel_pct) >= 25 ? 'bad' : Number(meta.cancel_pct) >= 10 ? 'warn' : 'flat'} />
        <Tile label="Avg lead time" value={`${Number(meta.avg_lead_days || 0).toFixed(0)}d`} sub="booking → arrival" />
        <Tile label="Avg LOS" value={Number(meta.avg_los || 0).toFixed(1)} sub="nights / stay" />
      </div>

      {/* Daily revenue trend */}
      <Section title={`Daily revenue · ${period.label}`} sub={`${dailyRows.length} active dates · max $${dailyMaxRev.toFixed(0)}`}>
        {dailyRows.length === 0 ? (
          <Empty>No bookings from this source on these dates.</Empty>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, minHeight: 160, padding: '8px 0', borderBottom: '1px solid var(--paper-deep)' }}>
            {dailyRows.map((d) => {
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
      </Section>

      {/* Pickup velocity for this source — last 28 days */}
      <Section title="Pickup velocity · last 28 days" sub="Daily NEW bookings made (booking_date)">
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
      </Section>

      {/* Room-type mix */}
      <Section title={`Room-type mix · ${period.label}`} sub={`${mixRows.length} room types · total $${totalMixRev.toFixed(0)}`}>
        {mixRows.length === 0 ? (
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
              {mixRows.map((r) => (
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
      </Section>

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
            Cloudbeds doesn&apos;t expose cancellation reason structured. Empty until {sourceName} channel manager exposes it.
          </Empty>
        </div>
      )}

      {/* Source-anchored decisions queue (placeholder — no rows yet) */}
      <Section title="Decisions queued for this source" sub="Filtered by source_agent or scope_section · governance.decision_queue">
        <Empty>No decisions queued. An agent watching {sourceName} will populate this when it detects an actionable play.</Empty>
      </Section>
    </>
  );
}

// ─── Local UI atoms ─────────────────────────────────────────────────────────

function Tile({ label, value, sub, tone = 'flat', deltaText, deltaTone = 'flat' }: {
  label: string; value: string; sub: string;
  tone?: 'flat' | 'warn' | 'bad';
  deltaText?: string; deltaTone?: 'pos' | 'neg' | 'flat';
}) {
  const valueColor =
    tone === 'bad' ? 'var(--st-bad-tx, #b03826)' :
    tone === 'warn' ? 'var(--st-warn-tx, #8a6418)' :
    'var(--ink)';
  const deltaColor =
    deltaTone === 'pos' ? 'var(--moss-glow)' :
    deltaTone === 'neg' ? 'var(--st-bad-tx, #b03826)' :
    'var(--ink-mute)';
  return (
    <div className="kpi-box">
      <div className="kpi-tile-scope">{label}</div>
      <div className="kpi-box-value" style={{ color: valueColor }}>{value}</div>
      <div className="kpi-tile-sub">{sub}</div>
      {deltaText && (
        <div style={{ marginTop: 4, fontSize: 'var(--t-xs)', color: deltaColor, fontFamily: 'var(--mono)' }}>
          {deltaText}
        </div>
      )}
    </div>
  );
}

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
