// components/channels/BdcHeroStrip.tsx — 3 hero graphs for BDC rev-manager view.
//   1. BDC vs hotel total (revenue share, RN share, ADR vs hotel)
//   2. Cancel funnel revenue leakage (gross attempts → realized)
//   3. 12-month trajectory (revenue + cancel% per month with H1/H2 comparison)
//
// Calls public.v_bdc_hero_channel_share, v_bdc_hero_funnel, v_bdc_hero_12m_trajectory.

import { supabase } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';

interface ChannelShare {
  bdc_bookings: number;
  bdc_room_nights: number;
  bdc_revenue_usd: number;
  bdc_adr_usd: number;
  hotel_room_nights: number;
  hotel_revenue_usd: number;
  hotel_adr_usd: number;
  bdc_rn_share_pct: number;
  bdc_revenue_share_pct: number;
  bdc_adr_premium_pct: number;
  period_from: string;
  period_to: string;
}
interface Funnel {
  attempts: number;
  confirmed: number;
  cancelled_guest: number;
  no_show: number;
  realized_revenue_usd: number;
  gross_attempted_revenue_usd: number;
  leaked_revenue_usd: number;
  realization_rate_pct: number;
}
interface MonthRow {
  month: string;
  bookings_total: number;
  bookings_ok: number;
  revenue_ok_usd: number;
  cancel_pct: number;
  half: 'H1' | 'H2';
}

async function getChannelShare(): Promise<ChannelShare | null> {
  const { data } = await supabase.from('v_bdc_hero_channel_share').select('*').limit(1).maybeSingle();
  if (!data) return null;
  return {
    period_from: String(data.period_from),
    period_to: String(data.period_to),
    bdc_bookings: Number(data.bdc_bookings ?? 0),
    bdc_room_nights: Number(data.bdc_room_nights ?? 0),
    bdc_revenue_usd: Number(data.bdc_revenue_usd ?? 0),
    bdc_adr_usd: Number(data.bdc_adr_usd ?? 0),
    hotel_room_nights: Number(data.hotel_room_nights ?? 0),
    hotel_revenue_usd: Number(data.hotel_revenue_usd ?? 0),
    hotel_adr_usd: Number(data.hotel_adr_usd ?? 0),
    bdc_rn_share_pct: Number(data.bdc_rn_share_pct ?? 0),
    bdc_revenue_share_pct: Number(data.bdc_revenue_share_pct ?? 0),
    bdc_adr_premium_pct: Number(data.bdc_adr_premium_pct ?? 0),
  };
}
async function getFunnel(): Promise<Funnel | null> {
  const { data } = await supabase.from('v_bdc_hero_funnel').select('*').limit(1).maybeSingle();
  if (!data) return null;
  return {
    attempts: Number(data.attempts ?? 0),
    confirmed: Number(data.confirmed ?? 0),
    cancelled_guest: Number(data.cancelled_guest ?? 0),
    no_show: Number(data.no_show ?? 0),
    realized_revenue_usd: Number(data.realized_revenue_usd ?? 0),
    gross_attempted_revenue_usd: Number(data.gross_attempted_revenue_usd ?? 0),
    leaked_revenue_usd: Number(data.leaked_revenue_usd ?? 0),
    realization_rate_pct: Number(data.realization_rate_pct ?? 0),
  };
}
async function getTrajectory(): Promise<MonthRow[]> {
  const { data } = await supabase.from('v_bdc_hero_12m_trajectory').select('*');
  if (!data) return [];
  return (data as any[]).map((r) => ({
    month: String(r.month).slice(0, 10),
    bookings_total: Number(r.bookings_total ?? 0),
    bookings_ok: Number(r.bookings_ok ?? 0),
    revenue_ok_usd: Number(r.revenue_ok_usd ?? 0),
    cancel_pct: Number(r.cancel_pct ?? 0),
    half: r.half === 'H2' ? 'H2' : 'H1',
  }));
}

function fmtPeriod(from: string, to: string) {
  const f = new Date(from), t = new Date(to);
  const m = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return `${m(f)} → ${m(t)}`;
}

export default async function BdcHeroStrip() {
  const [share, funnel, trajectory] = await Promise.all([
    getChannelShare().catch(() => null),
    getFunnel().catch(() => null),
    getTrajectory().catch(() => []),
  ]);
  if (!share || !funnel || !trajectory.length) return null;

  // H1 vs H2 split
  const h1 = trajectory.filter((m) => m.half === 'H1');
  const h2 = trajectory.filter((m) => m.half === 'H2');
  const h1Rev = h1.reduce((s, m) => s + m.revenue_ok_usd, 0);
  const h2Rev = h2.reduce((s, m) => s + m.revenue_ok_usd, 0);
  const h1Cancel = h1.length ? h1.reduce((s, m) => s + m.cancel_pct, 0) / h1.length : 0;
  const h2Cancel = h2.length ? h2.reduce((s, m) => s + m.cancel_pct, 0) / h2.length : 0;
  const revDelta = h1Rev > 0 ? ((h2Rev - h1Rev) / h1Rev) * 100 : 0;
  const cancelDelta = h2Cancel - h1Cancel;

  const maxRev = Math.max(1, ...trajectory.map((m) => m.revenue_ok_usd));
  const maxCancel = Math.max(1, ...trajectory.map((m) => m.cancel_pct));

  const periodLabel = fmtPeriod(share.period_from, share.period_to);

  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'var(--t-xl)' }}>The big picture</h2>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)' }}>{periodLabel} · BDC vs hotel total</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 14 }}>
        {/* HERO #1 — BDC vs hotel total */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 8 }}>
            BDC vs hotel total
          </div>
          <ShareRow label="Revenue" bdcLabel={fmtMoney(share.bdc_revenue_usd, 'USD')} hotelLabel={fmtMoney(share.hotel_revenue_usd, 'USD')} pct={share.bdc_revenue_share_pct} />
          <ShareRow label="Room nights" bdcLabel={String(share.bdc_room_nights)} hotelLabel={String(share.hotel_room_nights)} pct={share.bdc_rn_share_pct} />
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--paper-deep)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>ADR</span>
              <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>{fmtMoney(share.bdc_adr_usd, 'USD')}</span>
            </div>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
              Hotel avg {fmtMoney(share.hotel_adr_usd, 'USD')} · {share.bdc_adr_premium_pct >= 0 ? `▲ +${share.bdc_adr_premium_pct.toFixed(1)}%` : `▼ ${share.bdc_adr_premium_pct.toFixed(1)}%`}
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 8 }}>
            Read: BDC drives <strong>{share.bdc_revenue_share_pct.toFixed(0)}%</strong> of hotel revenue. Loss of this channel = {fmtMoney(share.bdc_revenue_usd, 'USD')} hole.
          </div>
        </div>

        {/* HERO #2 — Cancel funnel */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)', marginBottom: 8 }}>
            Cancel revenue leakage
          </div>
          <FunnelBar label={`${funnel.attempts} attempts`} value={fmtMoney(funnel.gross_attempted_revenue_usd, 'USD')} pct={100} color="var(--brass)" />
          <FunnelBar label={`${funnel.confirmed} confirmed (${funnel.realization_rate_pct.toFixed(0)}%)`} value={fmtMoney(funnel.realized_revenue_usd, 'USD')} pct={funnel.realization_rate_pct} color="var(--moss-glow)" />
          <FunnelBar label={`${funnel.cancelled_guest + funnel.no_show} lost`} value={`− ${fmtMoney(funnel.leaked_revenue_usd, 'USD')}`} pct={100 - funnel.realization_rate_pct} color="#b03826" />
          <div style={{ marginTop: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 8 }}>
            Read: <strong style={{ color: '#b03826' }}>{fmtMoney(funnel.leaked_revenue_usd, 'USD')}</strong> ({(100 - funnel.realization_rate_pct).toFixed(0)}% of gross) cancelled out. Each 1pp realization improvement = ~${(funnel.gross_attempted_revenue_usd / 100).toFixed(0)} recovered.
          </div>
        </div>

        {/* HERO #3 — 12-month trajectory */}
        <div style={{ background: 'var(--paper)', border: '1px solid var(--paper-deep)', borderRadius: 6, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', color: 'var(--brass)' }}>12-month trajectory</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-mute)' }}>
              H1 {fmtMoney(h1Rev, 'USD')} → H2 {fmtMoney(h2Rev, 'USD')} {revDelta >= 0 ? `▲ +${revDelta.toFixed(0)}%` : `▼ ${revDelta.toFixed(0)}%`}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${trajectory.length}, 1fr)`, gap: 3, alignItems: 'flex-end', height: 90, paddingTop: 8 }}>
            {trajectory.map((m) => {
              const hRev = (m.revenue_ok_usd / maxRev) * 70;
              const hCancel = (m.cancel_pct / maxCancel) * 70;
              const hot = m.cancel_pct >= 40;
              return (
                <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 70 }}>
                    <div title={`Revenue ${fmtMoney(m.revenue_ok_usd, 'USD')}`} style={{ width: 6, height: Math.max(2, hRev), background: m.half === 'H1' ? 'var(--brass)' : 'var(--moss-glow)', opacity: 0.85, borderRadius: '2px 2px 0 0' }} />
                    <div title={`Cancel ${m.cancel_pct.toFixed(0)}%`} style={{ width: 6, height: Math.max(2, hCancel), background: hot ? '#b03826' : 'var(--ink-mute)', opacity: hot ? 0.9 : 0.5, borderRadius: '2px 2px 0 0' }} />
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink-mute)' }}>
                    {new Date(m.month).toLocaleDateString('en-GB', { month: 'short' })[0]}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '10px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--brass)', marginRight: 4, verticalAlign: 'middle' }} /> H1 rev</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--moss-glow)', marginRight: 4, verticalAlign: 'middle' }} /> H2 rev</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#b03826', marginRight: 4, verticalAlign: 'middle' }} /> cancel ≥40%</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 'var(--t-xs)', color: 'var(--ink-mute)', borderTop: '1px solid var(--paper-deep)', paddingTop: 8 }}>
            Read: H2 cancel avg <strong>{h2Cancel.toFixed(0)}%</strong> vs H1 <strong>{h1Cancel.toFixed(0)}%</strong> ({cancelDelta >= 0 ? '▲ ' : '▼ '}{Math.abs(cancelDelta).toFixed(1)}pp). {Math.abs(cancelDelta) >= 5 ? 'Trend is shifting — investigate.' : 'Cancel trend stable.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareRow({ label, bdcLabel, hotelLabel, pct }: { label: string; bdcLabel: string; hotelLabel: string; pct: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--paper-deep)', borderRadius: 2, position: 'relative' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: 'var(--brass)', opacity: 0.85, borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: '10px', color: 'var(--ink-mute)', fontFamily: 'var(--mono)', marginTop: 2 }}>
        BDC {bdcLabel} of hotel {hotelLabel}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)', color: 'var(--ink)' }}>{value}</span>
      </div>
      <div style={{ height: 8, background: 'var(--paper-deep)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, opacity: 0.85, borderRadius: 2 }} />
      </div>
    </div>
  );
}
