'use client';
// app/guest/reputation/_components/ReportContainer.tsx
// Consolidated bullet-point management report — generated server-side data, formatted here.
// Includes a "Send me this report now" button (POST /api/reputation/email-report).
import { useState } from 'react';

type Review = {
  id: number; source: string; rating_norm: number | string | null;
  title: string | null; body: string | null;
  response_status: string | null; reviewer_name: string | null;
  reviewed_at: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google', tripadvisor: 'TripAdvisor', booking: 'Booking.com', expedia: 'Expedia', ctrip: 'Trip.com',
};

function generateBullets(reviews: Review[]): { headline: string; bullets: string[] } {
  const total = reviews.length;
  if (total === 0) return { headline: 'No reviews scraped yet.', bullets: [] };

  const avg = reviews.reduce((s,r) => s + (Number(r.rating_norm) || 0), 0) / total;
  const bySource = new Map<string, { n: number; sum: number }>();
  const responded = reviews.filter(r => r.response_status === 'responded').length;
  const unanswered = reviews.filter(r => r.response_status === 'unanswered').length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  for (const r of reviews) {
    const cur = bySource.get(r.source) ?? { n:0, sum:0 };
    cur.n++; cur.sum += (Number(r.rating_norm) || 0);
    bySource.set(r.source, cur);
  }

  const perSourceList = Array.from(bySource.entries())
    .sort((a,b) => b[1].n - a[1].n)
    .map(([s, v]) => `${SOURCE_LABEL[s] ?? s}: ${v.n} reviews · avg ${(v.sum / v.n).toFixed(1)}/5`);

  const lows = reviews.filter(r => Number(r.rating_norm) < 3).slice(0, 3);
  const recent = reviews.slice()
    .sort((a,b) => (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? ''))
    .slice(0, 3);

  const bullets: string[] = [
    `📊 Total reviews (local sample): ${total} · weighted avg ${avg.toFixed(2)}/5`,
    `🎯 Response rate: ${responseRate}% (${responded} responded / ${unanswered} pending)`,
    `📚 Per source: ${perSourceList.join(' · ')}`,
  ];
  if (lows.length > 0) {
    bullets.push(`⚠️ Low-scoring reviews needing attention: ${lows.map(r => `${r.reviewer_name ?? 'anon'} · ${Number(r.rating_norm).toFixed(1)}/5 · ${(r.title ?? '').slice(0,50)}`).join(' | ')}`);
  }
  if (recent.length > 0) {
    bullets.push(`🆕 Most recent 3: ${recent.map(r => `${SOURCE_LABEL[r.source] ?? r.source} · ${(r.reviewed_at ?? '').slice(0,10)} · ${Number(r.rating_norm).toFixed(1)}/5`).join(' | ')}`);
  }
  if (unanswered > 3) {
    bullets.push(`🚨 Action: ${unanswered} unanswered reviews across platforms. Priority-reply the lowest-scoring first.`);
  }

  const headline = avg >= 4.5
    ? `Excellent standing (${avg.toFixed(2)}/5) — keep the response cadence up.`
    : avg >= 4.0
    ? `Strong standing (${avg.toFixed(2)}/5) — a few complaint themes to close out.`
    : `Attention needed — average ${avg.toFixed(2)}/5 is below target. See action bullets.`;
  return { headline, bullets };
}

export default function ReportContainer({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState(true);
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ kind:'ok'|'err'; text:string } | null>(null);

  const { headline, bullets } = generateBullets(reviews);
  const asText = [headline, '', ...bullets.map(b => '• ' + b)].join('\n');

  const send = async () => {
    if (!emailTo.trim()) { setMsg({ kind:'err', text:'Enter an email address first.' }); return; }
    setSending(true); setMsg(null);
    try {
      const res = await fetch('/api/reputation/email-report', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ to: emailTo.trim(), subject: `Namkhan · Reputation weekly · ${new Date().toISOString().slice(0,10)}`, text: asText, html_bullets: [headline, ...bullets] }),
      });
      const j = await res.json();
      if (j?.ok) setMsg({ kind:'ok', text:'Report sent.' });
      else setMsg({ kind:'err', text: j?.error ?? 'send failed' });
    } catch (e) { setMsg({ kind:'err', text: e instanceof Error ? e.message : String(e) }); }
    finally { setSending(false); }
  };

  return (
    <div style={box}>
      <button onClick={() => setExpanded(!expanded)} style={header}>
        <span>📋 Management report (bullet summary)</span>
        <span style={{ fontSize:11, color:'#5A5A5A', fontWeight:400 }}>{reviews.length} reviews summarised</span>
        <span style={{ marginLeft:'auto', fontSize:14 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ padding:14 }}>
          {/* Send + Schedule controls at TOP (freed up space below for the report) */}
          <div style={{
            display:'flex', gap:6, alignItems:'center', flexWrap:'wrap',
            padding:'8px 10px', background:'#F0EBD9', borderRadius:6, marginBottom:14,
          }}>
            <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} disabled={sending}
              placeholder="pbsbase@gmail.com" style={inp} />
            <button onClick={send} disabled={sending || !emailTo.trim()} style={btnSend}>
              {sending ? 'Sending…' : '📧 Send now'}
            </button>
            <button onClick={() => alert('Schedule already active: Sunday 20:00 Laos time (cron reviews-scrape-weekly-sunday). Ping me to add another recipient.')} disabled={sending}
              style={btnLight}>
              🗓 Schedule
            </button>
          </div>
          {msg && (
            <div style={{
              marginBottom:12, padding:6, fontSize:11,
              background: msg.kind==='ok' ? '#F0F7F2' : '#FFF3F1',
              border: '1px solid ' + (msg.kind==='ok' ? '#0848380F' : '#B04A2F33'),
              color:    msg.kind==='ok' ? '#084838' : '#B04A2F',
              borderRadius:4,
            }}>{msg.text}</div>
          )}

          {/* Traffic-light breakdown — positive/neutral/negative overall + per source */}
          <TrafficLight reviews={reviews} />

          <div style={{ fontSize:12, fontWeight:600, color:'#1B1B1B', margin:'12px 0 6px' }}>{headline}</div>
          <ul style={{ paddingLeft:16, margin:0 }}>
            {bullets.map((b, i) => (
              <li key={i} style={{ fontSize:11, color:'#3A3A3A', lineHeight:1.5, marginBottom:4 }}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrafficLight({ reviews }: { reviews: Review[] }) {
  let pos = 0, neu = 0, neg = 0;
  const bySource = new Map<string, { pos:number; neu:number; neg:number }>();
  for (const r of reviews) {
    const n = Number(r.rating_norm);
    if (!Number.isFinite(n)) continue;
    const src = r.source ?? 'unknown';
    const c = bySource.get(src) ?? { pos:0, neu:0, neg:0 };
    if (n >= 4)      { pos++; c.pos++; }
    else if (n >= 3) { neu++; c.neu++; }
    else             { neg++; c.neg++; }
    bySource.set(src, c);
  }
  const total = pos + neu + neg;
  if (total === 0) return null;
  const pct = (v: number) => (v / total) * 100;
  const seg = (p: number) => `${p}%`;

  return (
    <div style={{ padding:'8px 10px', background:'#FAFAF7', border:'1px solid #E6DFCC', borderRadius:6, marginBottom:8 }}>
      <div style={{
        fontSize:9, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase',
        color:'#5A5A5A', marginBottom:5,
      }}>
        Sentiment · {total} reviews
      </div>
      <div style={{ display:'flex', height:8, borderRadius:99, overflow:'hidden', background:'#EEE', marginBottom:6 }}>
        <div style={{ width: seg(pct(pos)), background:'#4A8A5F' }} title={`Positive: ${pos}`} />
        <div style={{ width: seg(pct(neu)), background:'#D4A866' }} title={`Neutral: ${neu}`} />
        <div style={{ width: seg(pct(neg)), background:'#B04A2F' }} title={`Negative: ${neg}`} />
      </div>
      <div style={{ display:'flex', gap:10, fontSize:10, color:'#3A3A3A', flexWrap:'wrap' }}>
        <span><span style={dotStyle('#4A8A5F')} /> Positive {pos} · {Math.round(pct(pos))}%</span>
        <span><span style={dotStyle('#D4A866')} /> Neutral {neu} · {Math.round(pct(neu))}%</span>
        <span><span style={dotStyle('#B04A2F')} /> Negative {neg} · {Math.round(pct(neg))}%</span>
      </div>
      {bySource.size > 1 && (
        <div style={{ marginTop:6, paddingTop:6, borderTop:'1px solid #F0EBD9', fontSize:10, color:'#5A5A5A' }}>
          {Array.from(bySource.entries()).map(([src, c]) => (
            <span key={src} style={{ marginRight:12 }}>
              <strong style={{ color:'#1B1B1B' }}>{src}</strong> · +{c.pos} ={c.neu} −{c.neg}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const dotStyle = (color: string): React.CSSProperties => ({
  display:'inline-block', width:8, height:8, borderRadius:99, background:color, marginRight:4, verticalAlign:'middle',
});

const box: React.CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', overflow:'hidden' };
const header: React.CSSProperties = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'#FAFAF7', border:'none', borderBottom:'1px solid #E6DFCC', fontSize:12, fontWeight:600, color:'#1B1B1B', cursor:'pointer', fontFamily:'inherit', textAlign:'left' };
const inp: React.CSSProperties = { flex:1, minWidth:200, padding:'5px 8px', fontSize:12, border:'1px solid #E6DFCC', borderRadius:4, background:'#FFFFFF', color:'#1B1B1B' };
const btnSend: React.CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#084838', color:'#FFFFFF', border:'1px solid #084838', borderRadius:4, cursor:'pointer' };
const btnLight: React.CSSProperties = { padding:'6px 14px', fontSize:12, fontWeight:600, background:'#FFFFFF', color:'#084838', border:'1px solid #084838', borderRadius:4, cursor:'pointer' };