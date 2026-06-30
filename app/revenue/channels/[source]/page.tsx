// app/revenue/channels/[source]/page.tsx
// Per-source detail landing page.
//
// PBS 2026-06-30 (v3): single layout — every source shows the same chrome
// (DMC panel if any · KPI tiles always · daily revenue · room mix). No more
// special "no meta" branch. Empty tiles render with zeros.
//
// DMC contract panel:
//   - Edit button → /settings/channel-contacts (one source of truth)
//   - Preview contract button → /api/dmc/contract/[id]/preview (302 → signed)
//   - Black/ink labels, no brass/brown legacy typography
// When a DMC contract exists, the contact card is suppressed (no duplication).

import Link from 'next/link';
import { DashboardPage, Container, KpiTile, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import BackButton from '@/components/nav/BackButton';
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

export default async function ChannelDetailPage({ params, searchParams }: Props) {
  const sourceName = decodeURIComponent(params.source);
  const isBookingCom = /Booking\.com/i.test(sourceName);
  const sp = (searchParams?.win) ? searchParams : { ...searchParams, win: 'l12m' };
  const period = resolvePeriod(sp);

  const [allRows, dailyRows, mixRows, pickupRows, dmcContracts] = isBookingCom
    ? [[], [], [], [], [] as DmcContract[]] as const
    : await Promise.all([
        getChannelEconomicsForRange(period.from, period.to).catch(() => []),
        getChannelDailyForRange(sourceName, period.from, period.to).catch(() => []),
        getChannelRoomMixForRange(sourceName, period.from, period.to).catch(() => []),
        getChannelPickupForSource(sourceName, 28).catch(() => []),
        getDmcContracts().catch(() => [] as DmcContract[]),
      ]);

  const meta = allRows.find((r) => r.source_name === sourceName);

  const dmcMatch = !isBookingCom
    ? matchSourceToContract(sourceName, dmcContracts)
    : { contract_id: null, partner_short_name: null };
  const dmcContract: DmcContract | null = dmcMatch.contract_id
    ? dmcContracts.find((c) => c.contract_id === dmcMatch.contract_id) ?? null
    : null;

  const cat = categorize(sourceName, !!dmcContract);

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

  // ─── Generic layout — single path for all other sources ────────────────
  const hasBookings = !!meta && meta.bookings > 0;
  const bookings = meta?.bookings ?? 0;
  const canceled = meta?.canceled ?? 0;
  const grossRev = Number(meta?.gross_revenue ?? 0);
  const rns = Number(meta?.roomnights ?? 0);
  const adr = Number(meta?.adr ?? 0);
  const commissionPct = Number(meta?.commission_pct ?? 0);
  const commissionUsd = Number(meta?.commission_usd ?? 0);
  const cancelPct = Number(meta?.cancel_pct ?? 0);
  const leadDays = Number(meta?.avg_lead_days ?? 0);
  const los = Number(meta?.avg_los ?? 0);
  const netAdr = adr * (1 - commissionPct / 100);

  const dailyMaxRev = Math.max(1, ...dailyRows.map((d) => d.gross_revenue));
  const pickupMax = Math.max(1, ...pickupRows.map((d) => d.bookings));
  let totalMixRev = 0;
  for (const r of mixRows) totalMixRev += r.gross_revenue;

  const mainTabs: DashboardTab[] = REVENUE_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/channels'),
  }));

  return (
    <DashboardPage
      title={sourceName}
      subtitle={`Revenue · Channels · ${sourceName} · ${cat} · ${period.label}`}
      tabs={mainTabs}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <BackButton fallback="/revenue/channels" label="← Channels" />
        </div>
      }
    >
      {/* (1) Explanatory pane at the TOP when there are no bookings */}
      {!hasBookings && (
        <div style={{ gridColumn: '1 / -1', padding: '12px 16px', background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
            No bookings on file for {sourceName} ({cat})
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            This source is tracked but has not produced bookings in PMS history. Possible reasons: (a) the partnership is new, (b) the partner books under a different source name in Cloudbeds, or (c) the relationship is dormant.{dmcContract ? ' Contract terms below.' : ''}
          </div>
        </div>
      )}

      {/* (2) DMC contract panel (when matched) — Edit + Preview buttons inline */}
      {dmcContract && (
        <div style={{ gridColumn: '1 / -1' }}>
          <DmcContractPanel c={dmcContract} sourceName={sourceName} />
        </div>
      )}

      {/* (3) Standard KPI tiles — always shown, even with zeros */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12, marginBottom: 14 }}>
        {([
          { label: 'Bookings',      value: bookings,                              size: 'sm', footnote: `${canceled} cancelled` },
          { label: 'Gross revenue', value: Math.round(grossRev), currency: 'USD', size: 'sm', footnote: `${rns} room nights` },
          { label: 'ADR',           value: Math.round(adr),      currency: 'USD', size: 'sm', footnote: 'rev ÷ RNs' },
          { label: 'Net ADR',       value: Math.round(netAdr),   currency: 'USD', size: 'sm', footnote: `after ${commissionPct.toFixed(0)}% commission` },
          { label: 'Commission',    value: Math.round(commissionUsd), currency: 'USD', size: 'sm', footnote: grossRev > 0 ? `${(commissionUsd / grossRev * 100).toFixed(1)}% of rev` : '—', status: (commissionPct >= 18 ? 'amber' : 'green') as 'amber' | 'green' },
          { label: 'Cancel rate',   value: `${cancelPct.toFixed(1)}%`,             size: 'sm', footnote: `${canceled} of ${bookings + canceled}`, status: (cancelPct >= 25 ? 'red' : cancelPct >= 10 ? 'amber' : 'green') as 'red' | 'amber' | 'green' },
          { label: 'Lead time',     value: `${Math.round(leadDays)}d`,             size: 'sm', footnote: 'booking → arrival' },
          { label: 'LOS',           value: los.toFixed(1),                         size: 'sm', footnote: 'nights / stay' },
        ] as KpiTileProps[]).map((t, i) => <KpiTile key={i} {...t} />)}
      </div>

      {/* (4) Daily revenue trend */}
      <Container title={`Daily revenue · ${period.label}`} subtitle={`${dailyRows.length} active dates · max $${dailyMaxRev.toFixed(0)}`}>
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
      </Container>

      {/* (5) Pickup velocity last 28 days */}
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

      {/* (6) Room-type mix */}
      <Container title={`Room-type mix · ${period.label}`} subtitle={`${mixRows.length} room types · total $${totalMixRev.toFixed(0)}`}>
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
      </Container>

      {/* (7) Channel contact — only when there is NO DMC contract (no duplication) */}
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

// ─── DMC contract panel (inline, black labels, edit + preview buttons) ──
function DmcContractPanel({ c, sourceName }: { c: DmcContract; sourceName: string }) {
  const statusBg = c.computed_status === 'active' ? 'var(--st-good-bg)' : c.computed_status === 'expiring' ? 'var(--st-warn-bg)' : 'var(--st-bad-bg)';
  const statusBd = c.computed_status === 'active' ? 'var(--st-good-bd)' : c.computed_status === 'expiring' ? 'var(--st-warn-bd)' : 'var(--st-bad-bd)';
  const statusFg = c.computed_status === 'active' ? 'var(--moss-glow)' : c.computed_status === 'expiring' ? 'var(--brass)' : 'var(--st-bad)';
  const statusEmoji = c.computed_status === 'active' ? '🟢' : c.computed_status === 'expiring' ? '🟡' : c.computed_status === 'expired' ? '🔴' : '○';
  const daysLeft = c.days_to_expiry;

  // PBS 2026-06-30: labels rendered in INK (black) not BRASS to drop the
  // legacy brown-uppercase typography.
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--t-xs)',
    color: 'var(--ink)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 6,
  };
  const valStyle: React.CSSProperties = {
    fontSize: 'var(--t-base)',
    color: 'var(--ink)',
    lineHeight: 1.55,
  };
  const cellStyle: React.CSSProperties = {
    background: 'var(--paper)',
    border: '1px solid var(--paper-deep)',
    borderRadius: 6,
    padding: '12px 14px',
  };

  const previewHref = c.pdf_storage_path
    ? `/api/dmc/contract/${c.contract_id}/preview`
    : null;
  const editHref = `/settings/channel-contacts?source=${encodeURIComponent(sourceName)}`;

  return (
    <Container
      title={`DMC contract · ${c.partner_short_name}`}
      subtitle={`Commercial terms from governance.dmc_contracts · ${c.partner_type} · ${c.country_flag ?? ''} ${c.country ?? '—'}`}
    >
      {/* Status + action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{ background: statusBg, border: `1px solid ${statusBd}`, color: statusFg, padding: '3px 10px', borderRadius: 12, fontSize: 'var(--t-sm)', fontWeight: 600 }}>
            {statusEmoji} {c.computed_status.charAt(0).toUpperCase() + c.computed_status.slice(1)}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
            LPA {c.effective_date?.slice(0, 4) ?? '—'}–{c.expiry_date?.slice(0, 4) ?? '—'}
            {c.expiry_date ? ` · expires ${c.expiry_date}` : ''}
            {daysLeft != null ? ` (${daysLeft > 0 ? `${daysLeft} days` : daysLeft === 0 ? 'today' : `${Math.abs(daysLeft)}d ago`})` : ''}
          </span>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
            Auto-renew {c.auto_renew ? <strong style={{ color: 'var(--moss-glow)' }}>YES</strong> : <strong style={{ color: 'var(--st-bad)' }}>NO</strong>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {previewHref ? (
            <a href={previewHref} target="_blank" rel="noopener noreferrer" style={pdfBtnStyle}>
              📄 Preview contract
            </a>
          ) : (
            <span style={{ ...pdfBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}>
              📄 No PDF on file
            </span>
          )}
          <Link href={editHref} style={editBtnStyle}>
            ✎ Edit
          </Link>
        </div>
      </div>

      {/* 3-column grid: pricing · contact · renewal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div style={cellStyle}>
          <div style={labelStyle}>Pricing posture</div>
          <div style={valStyle}>
            <strong>{c.pricing_model}</strong>
            {c.group_surcharge_pct != null ? <><br />group surcharge +{c.group_surcharge_pct}%</> : null}
            {c.group_threshold != null ? <> ({c.group_threshold}+ keys)</> : null}
            {c.extra_bed_usd != null ? <><br />extra bed ${c.extra_bed_usd}</> : null}
          </div>
        </div>

        <div style={cellStyle}>
          <div style={labelStyle}>Contact</div>
          <div style={valStyle}>
            {c.contact_name ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
            {c.contact_role ? <> · {c.contact_role}</> : null}
            <br />
            {c.contact_email ? <a href={`mailto:${c.contact_email}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>✉ {c.contact_email}</a> : <span style={{ color: 'var(--ink-faint)' }}>✉ —</span>}
            <br />
            {c.contact_phone ? <a href={`tel:${c.contact_phone}`} style={{ color: 'var(--ink)', textDecoration: 'underline' }}>📞 {c.contact_phone}</a> : <span style={{ color: 'var(--ink-faint)' }}>📞 —</span>}
          </div>
        </div>

        <div style={cellStyle}>
          <div style={labelStyle}>Renewal countdown</div>
          <div style={valStyle}>
            {daysLeft != null && daysLeft > 0 ? (
              <>
                <strong style={{ fontSize: 'var(--t-lg)', color: daysLeft < 90 ? 'var(--brass)' : 'var(--ink)' }}>{daysLeft} days</strong>
                <br />
                <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>auto-alerts at 90/60/30/14/7/1 days</span>
              </>
            ) : daysLeft != null && daysLeft <= 0 ? (
              <strong style={{ color: 'var(--st-bad)' }}>EXPIRED — needs renewal</strong>
            ) : (
              <span style={{ color: 'var(--ink-faint)' }}>no expiry on file</span>
            )}
          </div>
        </div>
      </div>

      {/* Identity / clause row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div style={cellStyle}>
          <div style={labelStyle}>Legal identity</div>
          <div style={valStyle}>
            VAT: <code style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)' }}>{c.vat_number ?? '—'}</code>
            <br />
            Address: {c.address ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
          </div>
        </div>
        <div style={cellStyle}>
          <div style={labelStyle}>Anti-publication clause</div>
          <div style={{ ...valStyle, fontSize: 'var(--t-sm)' }}>
            {c.anti_publication_clause
              ? <><strong style={{ color: 'var(--moss-glow)' }}>✓ Present</strong> — {c.anti_publication_clause.slice(0, 180)}{c.anti_publication_clause.length > 180 ? '…' : ''}</>
              : <span style={{ color: 'var(--ink-faint)' }}>not captured</span>}
          </div>
        </div>
      </div>
    </Container>
  );
}

// ─── Local UI atoms ─────────────────────────────────────────────────────
const pdfBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'var(--paper)',
  color: 'var(--ink)',
  border: '1px solid var(--ink)',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  textDecoration: 'none',
};

const editBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  border: '1px solid var(--primary, #1F3A2E)',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
      {children}
    </div>
  );
}
