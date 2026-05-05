// components/channels/BdcPanels.tsx — Booking.com-only analytics panels
// Renders 5 panels using data loaded from the BDC Extranet PDF/CSV exports
// stored in revenue.bdc_*. Server component, no client JS.
//
// Panels:
//   1. Search funnel & ranking (impressions → page → book + scorecard)
//   2. Country mix vs market (top 12 — share % delta vs market)
//   3. Book-window cancel curve (mix vs cancel risk by lead time)
//   4. Genius dependency monthly (% Genius bookings + YoY booking volume)
//   5. Pace by stay-month vs LY (RN, ADR, Revenue diff%)
//
// All numbers live from Supabase. If a panel has no data, it renders an empty
// state with the upload instructions instead of vanishing — so the operator
// knows what to do to populate it.

import {
  getBdcCountryInsights,
  getBdcBookWindowInsights,
  getBdcGeniusMonthly,
  getBdcPaceMonthly,
  getBdcRankingSnapshot,
  type BdcCountryRow,
  type BdcBookWindowRow,
  type BdcGeniusRow,
  type BdcPaceMonthRow,
  type BdcRankingSnapshot,
} from '@/lib/data-bdc';
import { fmtMoney } from '@/lib/format';

const MINUS = '−'; // U+2212 true minus

function pp(n: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? MINUS : '';
  return `${sign}${Math.abs(n).toFixed(1)}pp`;
}
function pct(n: number | null, d = 1): string {
  if (n == null || !isFinite(n)) return '—';
  return `${n.toFixed(d)}%`;
}
function num(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString('en-GB');
}
function diffArrow(n: number): { glyph: string; tone: 'pos' | 'neg' | 'flat' } {
  if (n > 0.5) return { glyph: '▲', tone: 'pos' };
  if (n < -0.5) return { glyph: '▼', tone: 'neg' };
  return { glyph: '·', tone: 'flat' };
}
function toneColor(t: 'pos' | 'neg' | 'flat') {
  return t === 'pos' ? 'var(--moss-glow)' : t === 'neg' ? 'var(--st-bad-tx, #b03826)' : 'var(--ink-mute)';
}

function Empty({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px', background: 'var(--paper)', border: '1px dashed var(--line-soft)', borderRadius: 6, color: 'var(--ink-mute)', fontSize: 'var(--t-sm)' }}>
      {title && <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 6 }}>{title}</div>}
      {children}
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

// ─── Panel 1: Search funnel + ranking ──────────────────────────────────────
function FunnelPanel({ rs }: { rs: BdcRankingSnapshot }) {
  const sv = rs.search_views;
  const pv = rs.page_views;
  const bk = rs.bookings;
  const stp = rs.search_to_page_pct;
  const ptb = rs.page_to_book_pct;
  // Scale bars: search_views = 100% width
  const pvWidth = sv > 0 ? (pv / sv) * 100 : 0;
  const bkWidth = sv > 0 ? (bk / sv) * 100 : 0;
  const reviewDelta = rs.review_score - rs.area_avg_review_score;
  const reviewArrow = diffArrow(reviewDelta);
  const cancelDelta = rs.cancel_pct - rs.area_avg_cancel_pct;
  const cancelArrow = diffArrow(-cancelDelta); // lower cancel is better

  return (
    <Section
      title="Search funnel & ranking"
      sub={`Snapshot ${rs.snapshot_date}`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* Funnel bars */}
        <div>
          <FunnelRow
            label="Search views"
            value={num(sv)}
            sub="Total times the property surfaced in BDC search"
            widthPct={100}
            color="var(--brass)"
          />
          <FunnelRow
            label="Property page views"
            value={num(pv)}
            sub={`${stp.toFixed(1)}% of search views clicked through`}
            widthPct={pvWidth}
            color="var(--brass)"
            opacity={0.75}
          />
          <FunnelRow
            label="Bookings"
            value={num(bk)}
            sub={`${ptb.toFixed(2)}% page → book conversion`}
            widthPct={bkWidth}
            color="var(--moss-glow)"
          />
        </div>

        {/* Scorecard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ScoreRow
            label="Search score"
            value={`${rs.search_score} / ${rs.search_score_max}`}
            sub={`Better than ${rs.better_than_pct_in_city.toFixed(0)}% of city`}
          />
          <ScoreRow
            label="Conversion"
            value={`${rs.conversion_pct.toFixed(2)}%`}
            sub={rs.area_avg_conversion_pct != null ? `Area avg ${rs.area_avg_conversion_pct.toFixed(2)}%` : 'Area avg not reported'}
          />
          <ScoreRow
            label="Cancel rate"
            value={`${rs.cancel_pct.toFixed(1)}%`}
            sub={`Area avg ${rs.area_avg_cancel_pct.toFixed(1)}% · ${cancelArrow.glyph} ${Math.abs(cancelDelta).toFixed(1)}pp`}
            subColor={toneColor(cancelArrow.tone)}
          />
          <ScoreRow
            label="Review score"
            value={rs.review_score.toFixed(1)}
            sub={`Area avg ${rs.area_avg_review_score.toFixed(1)} · ${reviewArrow.glyph} ${Math.abs(reviewDelta).toFixed(1)}`}
            subColor={toneColor(reviewArrow.tone)}
          />
        </div>
      </div>
    </Section>
  );
}

function FunnelRow({ label, value, sub, widthPct, color, opacity = 1 }: {
  label: string; value: string; sub: string; widthPct: number; color: string; opacity?: number;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>{value}</span>
      </div>
      <div style={{ height: 12, background: 'var(--paper)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${widthPct}%`, background: color, opacity, borderRadius: 2 }} />
      </div>
      <div style={{ marginTop: 4, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>{sub}</div>
    </div>
  );
}

function ScoreRow({ label, value, sub, subColor = 'var(--ink-mute)' }: {
  label: string; value: string; sub: string; subColor?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--paper-deep)', paddingBottom: 6 }}>
      <div>
        <div style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', fontFamily: 'var(--mono)' }}>{label}</div>
        <div style={{ fontSize: 'var(--t-xs)', color: subColor, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-2xl)', color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}

// ─── Panel 2: Country mix vs market ────────────────────────────────────────
function CountryPanel({ rows }: { rows: BdcCountryRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Country mix vs market" sub="Booking.com Booker insights">
        <Empty title="No country data loaded">
          Upload the BDC Booker Insights PDF (Analytics → Booker Insights → Reservations by country) and reload.
        </Empty>
      </Section>
    );
  }
  return (
    <Section title="Country mix vs market" sub={`${rows.length} top countries · my share vs market share`}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Country</th>
            <th className="num">My share</th>
            <th className="num">Market</th>
            <th className="num">Δ pp</th>
            <th className="num">My ADR</th>
            <th className="num">Lead</th>
            <th className="num">Cancel %</th>
            <th className="num">LOS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const arrow = r.share_delta_pp != null ? diffArrow(r.share_delta_pp) : null;
            return (
              <tr key={r.country}>
                <td className="lbl"><strong>{r.country}</strong></td>
                <td className="num">{pct(r.my_reservation_pct)}</td>
                <td className="num" style={{ color: 'var(--ink-mute)' }}>{pct(r.market_reservation_pct)}</td>
                <td className="num" style={{ color: arrow ? toneColor(arrow.tone) : 'var(--ink-mute)' }}>
                  {arrow ? `${arrow.glyph} ${pp(r.share_delta_pp)}` : '—'}
                </td>
                <td className="num">{r.my_adr_usd != null ? fmtMoney(r.my_adr_usd, 'USD') : '—'}</td>
                <td className="num">{r.my_book_window_days != null ? `${r.my_book_window_days.toFixed(0)}d` : '—'}</td>
                <td className="num">{pct(r.my_cancel_pct)}</td>
                <td className="num">{r.my_los_nights != null ? r.my_los_nights.toFixed(1) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Panel 3: Book-window cancel curve ─────────────────────────────────────
function BookWindowPanel({ rows }: { rows: BdcBookWindowRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Book-window mix · cancel risk" sub="Lead time vs cancellation pattern">
        <Empty title="No book-window data loaded">Upload the BDC Booker Insights → Book window section.</Empty>
      </Section>
    );
  }
  const maxRes = Math.max(1, ...rows.map((r) => r.my_reservation_pct));
  return (
    <Section title="Book-window mix · cancel risk" sub="What lead time books, and which leads cancel">
      <table className="tbl">
        <thead>
          <tr>
            <th>Window</th>
            <th className="num">My share</th>
            <th>Mix</th>
            <th className="num">Compset share</th>
            <th className="num">My ADR</th>
            <th className="num">My cancel %</th>
            <th className="num">Compset cancel %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const w = (r.my_reservation_pct / maxRes) * 100;
            const isHotCancel = r.my_cancel_pct >= 6;
            return (
              <tr key={r.window_label}>
                <td className="lbl"><strong>{r.window_label}</strong></td>
                <td className="num">{pct(r.my_reservation_pct)}</td>
                <td>
                  <div style={{ height: 8, background: 'var(--brass)', opacity: 0.7, width: `${w}%`, maxWidth: 160, borderRadius: 2 }} />
                </td>
                <td className="num" style={{ color: 'var(--ink-mute)' }}>{pct(r.compset_reservation_pct)}</td>
                <td className="num">{fmtMoney(r.my_adr_usd, 'USD')}</td>
                <td className="num" style={{ color: isHotCancel ? 'var(--st-bad-tx, #b03826)' : 'var(--ink)' }}>
                  {pct(r.my_cancel_pct)}
                </td>
                <td className="num" style={{ color: 'var(--ink-mute)' }}>{pct(r.compset_cancel_pct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Panel 4: Genius dependency monthly ────────────────────────────────────
function GeniusPanel({ rows }: { rows: BdcGeniusRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Genius dependency · monthly" sub="What % of BDC bookings come from Genius members">
        <Empty title="No Genius timeline loaded">Upload the BDC Performance timeline CSV.</Empty>
      </Section>
    );
  }
  const maxBk = Math.max(1, ...rows.map((r) => Math.max(r.bookings, r.bookings_last_year)));
  return (
    <Section title="Genius dependency · monthly" sub={`${rows.length} months · % of BDC bookings made by Genius members`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + rows.length + ', 1fr)', gap: 12 }}>
        {rows.map((r) => {
          const bkH = (r.bookings / maxBk) * 80;
          const lyH = (r.bookings_last_year / maxBk) * 80;
          const yoyDelta = r.bookings - r.bookings_last_year;
          const yoyArrow = diffArrow(yoyDelta);
          return (
            <div key={r.period_month} style={{ borderRight: '1px solid var(--paper-deep)', paddingRight: 8, paddingLeft: 8 }}>
              <div style={{ fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', fontFamily: 'var(--mono)' }}>
                {r.period_month}
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)', marginTop: 4 }}>
                {r.genius_pct.toFixed(0)}%
              </div>
              <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', marginBottom: 8 }}>
                Genius share
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                <div title={`${r.bookings} bkg now`} style={{ flex: 1, height: Math.max(2, bkH), background: 'var(--brass)', opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
                <div title={`${r.bookings_last_year} bkg LY`} style={{ flex: 1, height: Math.max(2, lyH), background: 'var(--ink-mute)', opacity: 0.45, borderRadius: '2px 2px 0 0' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 'var(--t-xs)', color: toneColor(yoyArrow.tone) }}>
                {yoyArrow.glyph} {r.bookings} vs {r.bookings_last_year} LY
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 8 }}>
        Read: when Genius % is &gt; 80% the channel becomes a Genius-discount channel — losing Genius status would meaningfully reduce ADR. High dependency = pricing risk.
      </div>
    </Section>
  );
}

// ─── Panel 5: Pace monthly vs LY ───────────────────────────────────────────
function PacePanel({ rows }: { rows: BdcPaceMonthRow[] }) {
  if (!rows.length) {
    return (
      <Section title="Pace by stay-month vs LY" sub="BDC OTB vs same time last year">
        <Empty title="No pace data loaded">Upload the BDC Pace report PDF.</Empty>
      </Section>
    );
  }
  return (
    <Section title="Pace by stay-month vs LY" sub={`${rows.length} stay months · OTB room nights, ADR, revenue diff vs LY`}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Stay month</th>
            <th className="num">RN now</th>
            <th className="num">RN LY</th>
            <th className="num">RN Δ%</th>
            <th className="num">ADR now</th>
            <th className="num">ADR Δ%</th>
            <th className="num">Rev now</th>
            <th className="num">Rev Δ%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rnArrow = diffArrow(r.rn_diff_pct);
            const adrArrow = diffArrow(r.adr_diff_pct);
            const revArrow = diffArrow(r.revenue_diff_pct);
            return (
              <tr key={r.stay_year_month}>
                <td className="lbl"><strong>{r.stay_year_month}</strong></td>
                <td className="num">{r.rn_current}</td>
                <td className="num" style={{ color: 'var(--ink-mute)' }}>{r.rn_last_year}</td>
                <td className="num" style={{ color: toneColor(rnArrow.tone) }}>
                  {rnArrow.glyph} {r.rn_diff_pct.toFixed(1)}%
                </td>
                <td className="num">{fmtMoney(r.adr_current_usd, 'USD')}</td>
                <td className="num" style={{ color: toneColor(adrArrow.tone) }}>
                  {adrArrow.glyph} {r.adr_diff_pct.toFixed(1)}%
                </td>
                <td className="num">{fmtMoney(r.revenue_current_usd, 'USD')}</td>
                <td className="num" style={{ color: toneColor(revArrow.tone) }}>
                  {revArrow.glyph} {r.revenue_diff_pct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

// ─── Public composite ──────────────────────────────────────────────────────
export default async function BdcPanels() {
  const [rs, countries, windows, genius, paceMonths] = await Promise.all([
    getBdcRankingSnapshot().catch(() => null),
    getBdcCountryInsights(12).catch(() => []),
    getBdcBookWindowInsights().catch(() => []),
    getBdcGeniusMonthly().catch(() => []),
    getBdcPaceMonthly().catch(() => []),
  ]);

  if (!rs && !countries.length && !windows.length && !genius.length && !paceMonths.length) {
    return (
      <Section title="Booking.com analytics" sub="No BDC exports loaded yet">
        <Empty title="No BDC data">
          Upload the latest Booking.com Extranet PDFs (Booker insights, Pace report, Performance timeline CSV, Ranking dashboard) and run the BDC loader migration to populate this panel.
        </Empty>
      </Section>
    );
  }

  return (
    <>
      {rs && <FunnelPanel rs={rs} />}
      <CountryPanel rows={countries} />
      <BookWindowPanel rows={windows} />
      <GeniusPanel rows={genius} />
      <PacePanel rows={paceMonths} />
    </>
  );
}
