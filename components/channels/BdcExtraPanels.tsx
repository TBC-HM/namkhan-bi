// components/channels/BdcExtraPanels.tsx — extra Booking.com panels backed by
// the 12-month reservations export + promotions report. Renders:
//   1. Promotion ROI table (winners/losers, with cancel risk)
//   2. Real 12-month country mix (from 448 reservations, not BDC market data)
//   3. Cancel cohort by check-in month (sparkline)
//   4. Device + Purpose mix side-by-side (compact)
//   5. Lead-time bucket cancel curve (real, computed from reservation data)
//
// All panels render empty-state with upload instruction if their backing data
// is unavailable.

import {
  getBdcPromos,
  getBdcCountryReal12m,
  getBdcCancelCohort,
  getBdcDeviceMix,
  getBdcPurposeMix,
  getBdcLeadTimeBuckets,
  type BdcPromoRow,
  type BdcCountryRealRow,
  type BdcCancelCohortRow,
  type BdcDeviceRow,
  type BdcPurposeRow,
  type BdcLeadTimeRow,
} from '@/lib/data-bdc-extra';
import { fmtMoney } from '@/lib/format';

const MINUS = '−';
const COUNTRY_NAMES: Record<string, string> = {
  de: 'Germany', gb: 'United Kingdom', us: 'United States', fr: 'France', jp: 'Japan',
  ch: 'Switzerland', th: 'Thailand', nl: 'Netherlands', it: 'Italy', be: 'Belgium',
  es: 'Spain', au: 'Australia', cn: 'China', vn: 'Vietnam', sg: 'Singapore', il: 'Israel',
  at: 'Austria', kr: 'South Korea', tw: 'Taiwan', hk: 'Hong Kong', cz: 'Czech Republic',
  pl: 'Poland', se: 'Sweden', fi: 'Finland', dk: 'Denmark', no: 'Norway', ie: 'Ireland',
  pt: 'Portugal', ro: 'Romania', ru: 'Russia', cy: 'Cyprus', hu: 'Hungary', sk: 'Slovakia',
  ee: 'Estonia', lt: 'Lithuania', lv: 'Latvia', lu: 'Luxembourg', mx: 'Mexico', ar: 'Argentina',
  br: 'Brazil', ca: 'Canada', nz: 'New Zealand', za: 'South Africa', ph: 'Philippines',
  my: 'Malaysia', id: 'Indonesia', in: 'India', ae: 'UAE', sa: 'Saudi Arabia', kw: 'Kuwait',
  bh: 'Bahrain', om: 'Oman', tr: 'Turkey', eg: 'Egypt', la: 'Laos', mm: 'Myanmar',
  kh: 'Cambodia', ua: 'Ukraine', sn: 'Senegal', ke: 'Kenya', gu: 'Guam', lv2: 'Latvia',
  bg: 'Bulgaria', hr: 'Croatia',
};
function countryName(iso2: string) {
  return COUNTRY_NAMES[iso2.toLowerCase()] ?? iso2.toUpperCase();
}

function pct(n: number | null, d = 1) {
  if (n == null || !isFinite(n)) return '—';
  return `${n.toFixed(d)}%`;
}
function diffArrow(n: number) {
  if (n > 0.5) return { glyph: '▲', tone: 'pos' as const };
  if (n < -0.5) return { glyph: '▼', tone: 'neg' as const };
  return { glyph: '·', tone: 'flat' as const };
}
function toneColor(t: 'pos' | 'neg' | 'flat') {
  return t === 'pos' ? 'var(--moss-glow)' : t === 'neg' ? 'var(--st-bad-tx, #b03826)' : 'var(--ink-mute)';
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
    <div style={{ padding: '14px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
      {title && <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>{title}</div>}
      {children}
    </div>
  );
}

// ─── Panel 1: Promotion ROI ────────────────────────────────────────────────
function PromotionsPanel({ rows }: { rows: BdcPromoRow[] }) {
  const withData = rows.filter((r) => (r.bookings ?? 0) > 0);
  if (!withData.length) {
    return (
      <Section title="Promotion ROI" sub="Winners + losers by revenue">
        <Empty title="No promo data">Upload BDC Active+Inactive promotions reports.</Empty>
      </Section>
    );
  }
  const sorted = [...withData].sort((a, b) => (b.revenue_usd ?? 0) - (a.revenue_usd ?? 0));
  const top = sorted.slice(0, 12);

  // Loser detection: high cancel + high discount
  const losers = withData
    .filter((r) => (r.cancel_rate_pct ?? 0) >= 35 && (r.bookings ?? 0) >= 5)
    .sort((a, b) => (b.cancel_rate_pct ?? 0) - (a.cancel_rate_pct ?? 0))
    .slice(0, 5);

  const totalRev = withData.reduce((s, r) => s + (r.revenue_usd ?? 0), 0);
  const totalBkg = withData.reduce((s, r) => s + (r.bookings ?? 0), 0);
  const totalRn = withData.reduce((s, r) => s + (r.room_nights ?? 0), 0);
  const totalCancRn = withData.reduce((s, r) => s + (r.canceled_room_nights ?? 0), 0);
  const overallCancelRate = totalRn > 0 ? (totalCancRn / totalRn) * 100 : 0;

  return (
    <Section title="Promotion ROI" sub={`${withData.length} promos with bookings · ${rows.length} total promos · 12 months`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <Mini label="Active promos" value={String(rows.filter((r) => r.status === 'active').length)} sub={`${rows.length} total`} />
        <Mini label="Total revenue" value={fmtMoney(totalRev, 'USD')} sub={`${totalBkg} bookings`} />
        <Mini label="Cancel rate" value={`${overallCancelRate.toFixed(1)}%`} sub={`${totalCancRn} of ${totalRn} RNs`} tone={overallCancelRate >= 30 ? 'bad' : 'flat'} />
        <Mini label="Best ROI" value={top[0]?.name.slice(0, 20) ?? '—'} sub={`${fmtMoney(top[0]?.revenue_usd ?? 0, 'USD')} · ${top[0]?.bookings} bkg`} />
      </div>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>Top 12 by revenue</div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Promo</th>
            <th>Status</th>
            <th className="num">Disc%</th>
            <th className="num">Bookings</th>
            <th className="num">RNs</th>
            <th className="num">ADR</th>
            <th className="num">Revenue</th>
            <th className="num">Cancel %</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r, i) => (
            <tr key={r.name + i}>
              <td className="lbl"><strong>{r.name}</strong></td>
              <td><span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: r.status === 'active' ? 'var(--moss-glow)' : 'var(--ink-mute)', textTransform: 'uppercase' }}>{r.status}</span></td>
              <td className="num">{pct(r.discount_pct, 0)}</td>
              <td className="num">{r.bookings}</td>
              <td className="num">{r.room_nights}</td>
              <td className="num">{fmtMoney(r.adr_usd ?? 0, 'USD')}</td>
              <td className="num">{fmtMoney(r.revenue_usd ?? 0, 'USD')}</td>
              <td className="num" style={{ color: (r.cancel_rate_pct ?? 0) >= 35 ? 'var(--st-bad-tx, #b03826)' : 'var(--ink)' }}>{pct(r.cancel_rate_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {losers.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: '#b03826', marginBottom: 6 }}>
            Cancel-heavy promos (≥35% cancel, ≥5 bookings) — investigate or kill
          </div>
          <table className="tbl">
            <thead><tr><th>Promo</th><th className="num">Disc%</th><th className="num">Bookings</th><th className="num">Cancel %</th><th className="num">Revenue</th></tr></thead>
            <tbody>
              {losers.map((r) => (
                <tr key={r.name}>
                  <td className="lbl"><strong>{r.name}</strong></td>
                  <td className="num">{pct(r.discount_pct, 0)}</td>
                  <td className="num">{r.bookings}</td>
                  <td className="num" style={{ color: 'var(--st-bad-tx, #b03826)' }}>{pct(r.cancel_rate_pct)}</td>
                  <td className="num">{fmtMoney(r.revenue_usd ?? 0, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Mini({ label, value, sub, tone = 'flat' }: { label: string; value: string; sub: string; tone?: 'flat' | 'bad' | 'warn' }) {
  const color = tone === 'bad' ? 'var(--st-bad-tx, #b03826)' : tone === 'warn' ? 'var(--st-warn-tx, #8a6418)' : 'var(--ink)';
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)', color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{sub}</div>
    </div>
  );
}

// ─── Panel 2: Real 12-month country mix ────────────────────────────────────
function CountryRealPanel({ rows }: { rows: BdcCountryRealRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Country mix · real 12 months" sub="From actual reservations">
        <Empty title="No reservation data">Upload the BDC Check-in export.</Empty>
      </Section>
    );
  }
  const top = rows.filter((r) => r.bookings_total >= 3).slice(0, 14);
  return (
    <Section title="Country mix · real 12 months" sub={`Top ${top.length} countries from 448 reservations · share = ok bookings`}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Country</th>
            <th className="num">Share %</th>
            <th>Bar</th>
            <th className="num">Bookings (ok / cancel)</th>
            <th className="num">Confirm %</th>
            <th className="num">Avg ADR</th>
            <th className="num">Avg LOS</th>
            <th className="num">Avg lead</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => {
            const lowConfirm = (r.confirm_rate_pct ?? 100) < 60;
            return (
              <tr key={r.country_iso2}>
                <td className="lbl"><strong>{countryName(r.country_iso2)}</strong> <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-mute)' }}>{r.country_iso2.toUpperCase()}</span></td>
                <td className="num">{(r.share_pct ?? 0).toFixed(1)}%</td>
                <td><div style={{ height: 8, background: 'var(--brass)', opacity: 0.7, width: `${Math.min(100, (r.share_pct ?? 0) * 6)}%`, maxWidth: 200, borderRadius: 2 }} /></td>
                <td className="num">{r.bookings_ok} / {r.bookings_cancelled}</td>
                <td className="num" style={{ color: lowConfirm ? 'var(--st-bad-tx, #b03826)' : 'var(--ink)' }}>{pct(r.confirm_rate_pct)}</td>
                <td className="num">{fmtMoney(r.avg_adr_usd ?? 0, 'USD')}</td>
                <td className="num">{r.avg_los_nights != null ? r.avg_los_nights.toFixed(1) : '—'}</td>
                <td className="num">{r.avg_lead_days != null ? `${r.avg_lead_days.toFixed(0)}d` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Panel 3: Cancel cohort by check-in month ──────────────────────────────
function CancelCohortPanel({ rows }: { rows: BdcCancelCohortRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Cancel cohort · monthly" sub="By check-in month">
        <Empty title="No reservation data">Upload BDC reservation export.</Empty>
      </Section>
    );
  }
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue_lost_usd));
  const maxCanc = Math.max(1, ...rows.map((r) => r.cancel_pct));
  const avgCancel = rows.reduce((s, r) => s + r.cancel_pct, 0) / rows.length;
  const totalLost = rows.reduce((s, r) => s + r.revenue_lost_usd, 0);

  return (
    <Section title="Cancel cohort · monthly" sub={`12 months · avg cancel ${avgCancel.toFixed(1)}% · ${fmtMoney(totalLost, 'USD')} cancelled revenue`}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 4 }}>
        {rows.map((r) => {
          const heightCanc = (r.cancel_pct / maxCanc) * 60;
          const heightLost = (r.revenue_lost_usd / maxRev) * 60;
          const dt = new Date(r.check_in_month);
          const label = `${dt.toLocaleDateString('en-GB', { month: 'short' })}\n'${String(dt.getFullYear()).slice(2)}`;
          return (
            <div key={r.check_in_month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: r.cancel_pct >= 40 ? 'var(--st-bad-tx, #b03826)' : 'var(--ink)' }}>{r.cancel_pct.toFixed(0)}%</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                <div title={`${r.cancel_pct}% cancel`} style={{ width: 8, height: Math.max(2, heightCanc), background: '#b03826', opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
                <div title={fmtMoney(r.revenue_lost_usd, 'USD') + ' lost'} style={{ width: 8, height: Math.max(2, heightLost), background: 'var(--ink-mute)', opacity: 0.5, borderRadius: '2px 2px 0 0' }} />
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-mute)', whiteSpace: 'pre', textAlign: 'center' }}>{label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 8 }}>
        Read: red bar = % of cohort cancelled. Grey bar = revenue lost. Months with red &gt; 40% need a policy fix at the lead-time bucket level (see lead-time panel below).
      </div>
    </Section>
  );
}

// ─── Panel 4: Device + Purpose mix (compact) ───────────────────────────────
function DevicePurposePanel({ devices, purposes }: { devices: BdcDeviceRow[]; purposes: BdcPurposeRow[] }) {
  if (!devices.length && !purposes.length) {
    return (
      <Section title="Device + travel purpose mix" sub="From reservations">
        <Empty title="No reservation data">—</Empty>
      </Section>
    );
  }
  return (
    <Section title="Device + travel purpose mix" sub="Real 12 months · ok bookings only">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>Device</div>
          <table className="tbl">
            <thead><tr><th>Device</th><th className="num">Bookings</th><th className="num">Confirm %</th><th className="num">Avg ADR</th><th className="num">Lead</th></tr></thead>
            <tbody>
              {devices.map((r) => (
                <tr key={r.device}>
                  <td className="lbl"><strong>{r.device}</strong></td>
                  <td className="num">{r.bookings_total}</td>
                  <td className="num">{pct(r.confirm_rate_pct)}</td>
                  <td className="num">{r.avg_adr_usd != null ? fmtMoney(r.avg_adr_usd, 'USD') : '—'}</td>
                  <td className="num">{r.avg_lead_days != null ? `${r.avg_lead_days.toFixed(0)}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>Travel purpose</div>
          <table className="tbl">
            <thead><tr><th>Purpose</th><th className="num">Bookings</th><th className="num">Avg ADR</th><th className="num">Avg LOS</th></tr></thead>
            <tbody>
              {purposes.map((r) => (
                <tr key={r.purpose}>
                  <td className="lbl"><strong>{r.purpose}</strong></td>
                  <td className="num">{r.bookings_total}</td>
                  <td className="num">{r.avg_adr_usd != null ? fmtMoney(r.avg_adr_usd, 'USD') : '—'}</td>
                  <td className="num">{r.avg_los_nights != null ? r.avg_los_nights.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ─── Panel 5: Lead-time bucket cancel curve (real) ─────────────────────────
function LeadTimePanel({ rows }: { rows: BdcLeadTimeRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Lead-time bucket · real cancel curve" sub="From reservations">
        <Empty title="No data">—</Empty>
      </Section>
    );
  }
  const filtered = rows.filter((r) => r.window_label !== '—');
  const maxBkg = Math.max(1, ...filtered.map((r) => r.bookings_total));
  return (
    <Section title="Lead-time bucket · real cancel curve" sub="From 448 reservations · cancel rate per lead-time window">
      <table className="tbl">
        <thead>
          <tr>
            <th>Window</th>
            <th className="num">Bookings</th>
            <th>Volume</th>
            <th className="num">Confirmed</th>
            <th className="num">Cancelled</th>
            <th className="num">Cancel %</th>
            <th className="num">Avg ADR</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const w = (r.bookings_total / maxBkg) * 100;
            const hot = r.cancel_pct >= 35;
            return (
              <tr key={r.window_label}>
                <td className="lbl"><strong>{r.window_label}</strong></td>
                <td className="num">{r.bookings_total}</td>
                <td><div style={{ height: 8, background: 'var(--brass)', opacity: 0.7, width: `${w}%`, maxWidth: 160, borderRadius: 2 }} /></td>
                <td className="num">{r.bookings_ok}</td>
                <td className="num">{r.bookings_cancelled}</td>
                <td className="num" style={{ color: hot ? 'var(--st-bad-tx, #b03826)' : 'var(--ink)' }}>{pct(r.cancel_pct)}</td>
                <td className="num">{r.avg_adr_usd != null ? fmtMoney(r.avg_adr_usd, 'USD') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Public composite ──────────────────────────────────────────────────────
// Order: smoking-gun first (lead-time cancel), then promos, country, cancel cohort,
// then a compact device+purpose summary (one row, not two tables).
export default async function BdcExtraPanels() {
  const [promos, countries, cohort, devices, purposes, leadTime] = await Promise.all([
    getBdcPromos().catch(() => []),
    getBdcCountryReal12m().catch(() => []),
    getBdcCancelCohort().catch(() => []),
    getBdcDeviceMix().catch(() => []),
    getBdcPurposeMix().catch(() => []),
    getBdcLeadTimeBuckets().catch(() => []),
  ]);

  const anyData = promos.length || countries.length || cohort.length || devices.length || purposes.length || leadTime.length;
  if (!anyData) return null;

  return (
    <>
      <LeadTimePanel rows={leadTime} />
      <PromotionsPanel rows={promos} />
      <CountryRealPanel rows={countries} />
      <CancelCohortPanel rows={cohort} />
      <DevicePurposeCompact devices={devices} purposes={purposes} />
    </>
  );
}

// ─── Compact device + purpose summary (replaces DevicePurposePanel) ────────
function DevicePurposeCompact({ devices, purposes }: { devices: BdcDeviceRow[]; purposes: BdcPurposeRow[] }) {
  if (!devices.length && !purposes.length) return null;
  const totalDev = devices.reduce((s, r) => s + r.bookings_total, 0);
  const totalPurp = purposes.reduce((s, r) => s + r.bookings_total, 0);
  const mobile = devices.find((d) => /mobile/i.test(d.device));
  const desktop = devices.find((d) => /desktop/i.test(d.device));
  const leisure = purposes.find((p) => /leisure/i.test(p.purpose));
  const business = purposes.find((p) => /business/i.test(p.purpose));

  const item = (label: string, count: number, total: number, sub?: string) => (
    <div style={{ flex: 1, padding: '0 12px', borderRight: '1px solid var(--paper-deep)' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>{total > 0 ? `${(count / total * 100).toFixed(0)}%` : '—'}</div>
      <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{count} of {total} · {sub ?? ''}</div>
    </div>
  );

  return (
    <Section title="Device + travel purpose" sub="One-line summary · 12 months · drives BDC funnel choices">
      <div style={{ display: 'flex', alignItems: 'stretch', padding: '6px 0' }}>
        {mobile && item('Mobile share', mobile.bookings_total, totalDev, `confirm ${mobile.confirm_rate_pct.toFixed(0)}%, ADR $${mobile.avg_adr_usd?.toFixed(0) ?? '—'}`)}
        {desktop && item('Desktop share', desktop.bookings_total, totalDev, `confirm ${desktop.confirm_rate_pct.toFixed(0)}%, ADR $${desktop.avg_adr_usd?.toFixed(0) ?? '—'}`)}
        {leisure && item('Leisure', leisure.bookings_total, totalPurp, `ADR $${leisure.avg_adr_usd?.toFixed(0) ?? '—'}, LOS ${leisure.avg_los_nights?.toFixed(1) ?? '—'}n`)}
        {business && <div style={{ flex: 1, padding: '0 12px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 2 }}>Business</div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>{totalPurp > 0 ? `${(business.bookings_total / totalPurp * 100).toFixed(0)}%` : '—'}</div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{business.bookings_total} of {totalPurp} · ADR ${business.avg_adr_usd?.toFixed(0) ?? '—'}</div>
        </div>}
      </div>
      <div style={{ marginTop: 8, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 8 }}>
        Read: BDC is mostly mobile + leisure. Pricing strategy should optimize for that split.
      </div>
    </Section>
  );
}
