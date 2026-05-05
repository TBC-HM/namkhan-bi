// app/knowledge/_components/Snapshot.tsx
// Streaming SSR snapshot — each card is its own async component wrapped in
// <Suspense>. Page renders instantly; cards populate as their fetches resolve.

import { Suspense } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

async function safeJson<T = any>(url: string, ms = 8000): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch { return null; }
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--line-soft)',
  background: 'var(--paper-pure)',
  borderRadius: 4,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 140,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)',
  textTransform: 'uppercase',
  color: 'var(--brass)',
};

function aqiColor(band: string): string {
  switch (band) {
    case 'good':                 return 'var(--st-good)';
    case 'moderate':             return 'var(--st-warn)';
    case 'unhealthy_sensitive':  return '#d97706';
    case 'unhealthy':            return 'var(--st-bad)';
    case 'very_unhealthy':       return '#7c2d12';
    case 'hazardous':            return '#450a0a';
    default:                     return 'var(--ink-mute)';
  }
}

function siteBase() {
  return process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    || 'https://namkhan-bi.vercel.app';
}

function Skeleton({ label }: { label: string }) {
  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        Loading…
      </div>
    </div>
  );
}

function NotAvailable() {
  return (
    <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)',
                  fontStyle: 'italic', color: 'var(--ink-mute)' }}>
      Data source unavailable.
    </div>
  );
}

function dedupeByLink(items: any[]): any[] {
  const seen = new Set<string>();
  return items.filter(it => {
    const key = it.link || it.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ============================================================
 *  6 ASYNC CARDS — each rendered inside <Suspense>
 * ============================================================ */

async function WeatherCard() {
  const w = await safeJson<any>(`${siteBase()}/api/live/weather`, 6000);
  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>🌤  Weather · Luang Prabang</div>
      {w?.ok ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                          fontSize: 'var(--t-3xl)', color: 'var(--ink)' }}>
              {Math.round(w.current?.temperature_2m ?? 0)}°C
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
              feels {Math.round(w.current?.apparent_temperature ?? 0)}°C ·
              {' '}humidity {w.current?.relative_humidity_2m}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {w.daily?.time?.slice(0,7).map((d: string, i: number) => (
              <div key={d} style={{
                flex: '1 1 auto', minWidth: 50,
                background: 'var(--paper-warm)',
                padding: '4px 6px', borderRadius: 2,
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  {new Date(d).toLocaleDateString([], { weekday: 'short' }).slice(0,2)}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>
                  {Math.round(w.daily.temperature_2m_max[i])}°
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                  {Math.round(w.daily.precipitation_probability_max[i])}%
                </div>
              </div>
            ))}
          </div>
        </>
      ) : <NotAvailable />}
    </div>
  );
}

async function AirQualityCard() {
  const aq = await safeJson<any>(`${siteBase()}/api/live/airquality`, 6000);
  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>🍃  Air quality</div>
      {aq?.ok ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                          fontSize: 'var(--t-3xl)', color: aqiColor(aq.band) }}>
              AQI {Math.round(aq.current?.us_aqi ?? 0)}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                          color: aqiColor(aq.band), textTransform: 'uppercase',
                          letterSpacing: 'var(--ls-extra)' }}>
              {aq.band?.replace('_', ' ')}
            </div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)', color: 'var(--ink-soft)' }}>
            PM2.5 <strong>{aq.current?.pm2_5}</strong> · PM10 {aq.current?.pm10} · O3 {aq.current?.ozone}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            Source: Open-Meteo
          </div>
        </>
      ) : <NotAvailable />}
    </div>
  );
}

async function NewsCard() {
  const news = await safeJson<any>(`${siteBase()}/api/live/news?lim=8`, 8000);
  const items = news?.ok ? dedupeByLink(news.items || []).slice(0,5) : [];
  return (
    <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
      <div style={eyebrowStyle}>📰  Latest from Laos</div>
      {items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it: any, i: number) => (
            <a key={i} href={it.link} target="_blank" rel="noopener noreferrer" style={{
              textDecoration: 'none', color: 'inherit',
              paddingBottom: 6,
              borderBottom: i < items.length - 1 ? '1px solid var(--line-soft)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', color: 'var(--ink)' }}>
                {it.title}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {it.source} · {it.pub_date ? new Date(it.pub_date).toLocaleDateString() : '—'}
              </div>
            </a>
          ))}
        </div>
      ) : <NotAvailable />}
    </div>
  );
}

async function FlightsCard() {
  const f = await safeJson<any>(`${siteBase()}/api/live/flights?direction=both&hours=24`, 12000);
  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>✈  Flights · LPQ · last 24h</div>
      {f?.ok ? (
        <>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                            fontSize: 'var(--t-2xl)', color: 'var(--ink)' }}>
                {f.summary?.arrivals ?? 0}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                            color: 'var(--brass)' }}>arrivals</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                            fontSize: 'var(--t-2xl)', color: 'var(--ink)' }}>
                {f.summary?.departures ?? 0}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                            letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                            color: 'var(--brass)' }}>departures</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
            Source: OpenSky · sparse coverage in Laos · 0 = ADS-B silent zones, not "no flights"
          </div>
        </>
      ) : <NotAvailable />}
    </div>
  );
}

async function StatsCard() {
  let total = 0, indexed = 0, chunks = 0, critical = 0, parties = 0;
  try {
    const admin = getSupabaseAdmin();
    const [t, i, c, cr, pr] = await Promise.all([
      admin.schema('docs').from('documents').select('*', { head: true, count: 'exact' }),
      admin.schema('docs').from('documents').select('*', { head: true, count: 'exact' }).not('body_markdown','is',null),
      admin.schema('docs').from('chunks').select('*', { head: true, count: 'exact' }),
      admin.schema('docs').from('documents').select('*', { head: true, count: 'exact' }).eq('importance','critical'),
      admin.schema('docs').from('documents').select('external_party').not('external_party','is',null),
    ]);
    total = t.count ?? 0; indexed = i.count ?? 0; chunks = c.count ?? 0; critical = cr.count ?? 0;
    parties = new Set((pr.data || []).map((r: any) => r.external_party)).size;
  } catch {}

  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>📚  Knowledge base</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                        fontSize: 'var(--t-2xl)', color: 'var(--ink)' }}>{indexed}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        color: 'var(--brass)' }}>indexed</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                        fontSize: 'var(--t-2xl)', color: 'var(--ink)' }}>{chunks}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        color: 'var(--brass)' }}>paragraphs</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                        fontSize: 'var(--t-2xl)', color: 'var(--st-bad)' }}>{critical}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        color: 'var(--brass)' }}>critical</div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
        {total} total · {parties} unique parties
      </div>
    </div>
  );
}

async function ExpiriesCard() {
  let expiries: any[] = [];
  try {
    const admin = getSupabaseAdmin();
    const today = new Date().toISOString().slice(0,10);
    const horizon = new Date(Date.now() + 90 * 86400000).toISOString().slice(0,10);
    const { data } = await admin.schema('docs').from('documents')
      .select('doc_id, title, doc_type, external_party, importance, valid_until')
      .gte('valid_until', today).lte('valid_until', horizon)
      .eq('status','active').order('valid_until', { ascending: true }).limit(10);
    expiries = data ?? [];
  } catch {}
  return (
    <div style={cardStyle}>
      <div style={eyebrowStyle}>⏳  Expiring next 90 days</div>
      {expiries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {expiries.slice(0,6).map((d: any) => {
            const daysLeft = Math.ceil((new Date(d.valid_until).getTime() - Date.now()) / 86400000);
            return (
              <div key={d.doc_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-sm)',
                              color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap' }}>
                  {d.title}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                              color: daysLeft < 30 ? 'var(--st-bad)' : 'var(--st-warn)',
                              whiteSpace: 'nowrap' }}>
                  {daysLeft}d
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--sans)', fontSize: 'var(--t-md)',
                      fontStyle: 'italic', color: 'var(--ink-mute)' }}>
          No contracts/audits expiring in next 90 days.
        </div>
      )}
    </div>
  );
}

/* ============================================================
 *  GRID — outer page renders instantly, cards stream in
 * ============================================================ */

export default function Snapshot() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 16,
    }}>
      <Suspense fallback={<Skeleton label="🌤  Weather" />}><WeatherCard /></Suspense>
      <Suspense fallback={<Skeleton label="🍃  Air quality" />}><AirQualityCard /></Suspense>
      <Suspense fallback={<Skeleton label="📰  News" />}><NewsCard /></Suspense>
      <Suspense fallback={<Skeleton label="✈  Flights" />}><FlightsCard /></Suspense>
      <Suspense fallback={<Skeleton label="📚  KB" />}><StatsCard /></Suspense>
      <Suspense fallback={<Skeleton label="⏳  Expiries" />}><ExpiriesCard /></Suspense>
    </div>
  );
}
