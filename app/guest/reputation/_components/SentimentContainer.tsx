'use client';
// app/guest/reputation/_components/SentimentContainer.tsx
// PBS 2026-07-06 v2: infographic-style layout — big central donut circle with header badge,
// three point-cards for positive / neutral / negative with themes. Slide-presentation feel.
// (Vecteezy-style Sentiment Analysis Framework)
import { useState } from 'react';

type Review = {
  id: number; source: string; rating_norm: number | string | null;
  title: string | null; body: string | null;
};

const POSITIVE_THEMES: Record<string, string[]> = {
  Staff:       ['staff','service','host','team','welcome','friendly','helpful','attentive','kind'],
  Location:    ['location','view','riverside','namkhan','river','peaceful','serene','tranquil','quiet'],
  Food:        ['food','breakfast','meal','restaurant','dinner','delicious','cuisine'],
  Pool:        ['pool','swimming','infinity'],
  Cleanliness: ['clean','tidy','pristine','spotless'],
  Rooms:       ['room','villa','suite','bed','spacious','comfortable','beautiful'],
  Nature:      ['nature','garden','green','peaceful','birds','frogs','trees','jungle','forest'],
  Value:       ['value','worth','price','affordable'],
  Family:      ['family','kids','children','child','baby','shuttle'],
  Wellness:    ['spa','yoga','massage','wellness'],
};
const NEGATIVE_THEMES: Record<string, string[]> = {
  WiFi:        ['wifi','internet','connection','signal'],
  Aircon:      ['aircon','air conditioning','ac ','hot','warm','stuffy'],
  Noise:       ['noise','loud','snor','construction'],
  Bathroom:    ['shower','tap','sink','toilet','water pressure'],
  Bugs:        ['mosquito','insect','bug','ant','snake','spider'],
  Access:      ['access','transfer','far','remote','far from town','shuttle late','pickup'],
  Price:       ['overpriced','expensive','pricey'],
};

function countThemes(reviews: Review[], themeMap: Record<string, string[]>) {
  const counts = new Map<string, number>();
  for (const theme of Object.keys(themeMap)) counts.set(theme, 0);
  for (const r of reviews) {
    const hay = ((r.title ?? '') + ' ' + (r.body ?? '')).toLowerCase();
    for (const [theme, needles] of Object.entries(themeMap)) {
      if (needles.some(n => hay.includes(n))) counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).filter(([,n]) => n > 0).sort((a,b) => b[1] - a[1]);
}

// SVG donut arc helper
function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number, w: number) {
  const outerStart = polarToXY(cx, cy, r,     startAngle);
  const outerEnd   = polarToXY(cx, cy, r,     endAngle);
  const innerStart = polarToXY(cx, cy, r - w, endAngle);
  const innerEnd   = polarToXY(cx, cy, r - w, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${r} ${r} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${r - w} ${r - w} 0 ${large} 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');
}

export default function SentimentContainer({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState(true);

  const bucket = { pos: 0, neu: 0, neg: 0 };
  let sumRating = 0; let countRating = 0;
  for (const r of reviews) {
    const n = Number(r.rating_norm);
    if (!Number.isFinite(n)) continue;
    sumRating += n; countRating++;
    if (n >= 4)      bucket.pos++;
    else if (n >= 3) bucket.neu++;
    else             bucket.neg++;
  }
  const total = bucket.pos + bucket.neu + bucket.neg;
  const avgRating = countRating > 0 ? sumRating / countRating : 0;
  const pct = (n: number) => total > 0 ? (n / total) * 100 : 0;

  const bySource = new Map<string, { pos: number; neu: number; neg: number; total: number }>();
  for (const r of reviews) {
    const src = r.source ?? 'unknown';
    const cur = bySource.get(src) ?? { pos:0, neu:0, neg:0, total:0 };
    const n = Number(r.rating_norm);
    if (!Number.isFinite(n)) continue;
    if (n >= 4)      cur.pos++;
    else if (n >= 3) cur.neu++;
    else             cur.neg++;
    cur.total++;
    bySource.set(src, cur);
  }

  const positiveReviews = reviews.filter(r => Number(r.rating_norm) >= 4);
  const neutralReviews  = reviews.filter(r => { const n = Number(r.rating_norm); return n >= 3 && n < 4; });
  const negativeReviews = reviews.filter(r => Number(r.rating_norm) < 3);
  const topPraise    = countThemes(positiveReviews, POSITIVE_THEMES).slice(0, 4);
  const topComplaints = countThemes(negativeReviews, NEGATIVE_THEMES).slice(0, 4);

  // Donut geometry
  const R  = 62;   // outer radius
  const W  = 14;   // ring width
  const CX = 90; const CY = 90;
  let angle = 0;
  const posAngle = pct(bucket.pos) * 3.6;
  const neuAngle = pct(bucket.neu) * 3.6;
  const negAngle = pct(bucket.neg) * 3.6;
  const arcs: Array<{ path: string; color: string }> = [];
  if (posAngle > 0) { arcs.push({ path: arcPath(CX, CY, R, angle, angle + posAngle, W), color: '#4A8A5F' }); angle += posAngle; }
  if (neuAngle > 0) { arcs.push({ path: arcPath(CX, CY, R, angle, angle + neuAngle, W), color: '#D4A866' }); angle += neuAngle; }
  if (negAngle > 0) { arcs.push({ path: arcPath(CX, CY, R, angle, angle + negAngle, W), color: '#B04A2F' }); }

  return (
    <div style={box}>
      <button onClick={() => setExpanded(!expanded)} style={header}>
        <span style={badgePill}>SENTIMENT ANALYSIS</span>
        <span style={{ marginLeft:'auto', fontSize:14 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '24px 20px 18px' }}>
          {/* CENTRAL CIRCLE + STATS */}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:24, flexWrap:'wrap', marginBottom:24 }}>
            <svg width={180} height={180} viewBox="0 0 180 180" style={{ display:'block' }}>
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0EBD9" strokeWidth={W} />
              {arcs.length === 0 && (
                <text x={CX} y={CY+5} textAnchor="middle" fontSize={11} fill="#8A8A8A">No data</text>
              )}
              {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)}
              <text x={CX} y={CY - 6} textAnchor="middle" fontSize={11} fill="#5A5A5A" fontWeight={600} letterSpacing="0.08em">REVIEWS</text>
              <text x={CX} y={CY + 14} textAnchor="middle" fontSize={22} fill="#1B1B1B" fontWeight={700}>{total}</text>
              <text x={CX} y={CY + 32} textAnchor="middle" fontSize={10} fill="#8A8A8A">avg {avgRating.toFixed(2)}/5</text>
            </svg>
            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11, color:'#3A3A3A' }}>
              <LegendDot color="#4A8A5F" label={`Positive · ${bucket.pos} · ${Math.round(pct(bucket.pos))}%`} />
              <LegendDot color="#D4A866" label={`Neutral · ${bucket.neu} · ${Math.round(pct(bucket.neu))}%`} />
              <LegendDot color="#B04A2F" label={`Negative · ${bucket.neg} · ${Math.round(pct(bucket.neg))}%`} />
            </div>
          </div>

          {/* THREE POINT CARDS */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
            <PointCard n={1} color="#4A8A5F" title="POSITIVE" count={bucket.pos} pct={Math.round(pct(bucket.pos))}
              themes={topPraise.slice(0, 4).map(([t,c]) => `${t} · ${c}`)}
              emptyHint="No positive themes detected yet." />
            <PointCard n={2} color="#D4A866" title="NEUTRAL" count={bucket.neu} pct={Math.round(pct(bucket.neu))}
              themes={neutralReviews.length > 0 ? [`${neutralReviews.length} on-fence reviews`] : []}
              emptyHint="No neutral reviews yet." />
            <PointCard n={3} color="#B04A2F" title="NEGATIVE" count={bucket.neg} pct={Math.round(pct(bucket.neg))}
              themes={topComplaints.slice(0, 4).map(([t,c]) => `${t} · ${c}`)}
              emptyHint="No complaints in local sample." />
          </div>

          {/* PER-SOURCE FOOTER TABLE */}
          <div style={{ marginTop:22, paddingTop:14, borderTop:'1px solid #F0EBD9' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'#8A8A8A', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:8 }}>BY SOURCE</div>
            <table style={{ borderCollapse:'collapse', width:'100%' }}>
              <thead>
                <tr>
                  <th style={th}>Source</th>
                  <th style={{ ...th, textAlign:'right' }}>Total</th>
                  <th style={{ ...th, textAlign:'right', color:'#4A8A5F' }}>+</th>
                  <th style={{ ...th, textAlign:'right', color:'#D4A866' }}>=</th>
                  <th style={{ ...th, textAlign:'right', color:'#B04A2F' }}>−</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(bySource.entries()).sort((a,b) => b[1].total - a[1].total).map(([src, c]) => (
                  <tr key={src}>
                    <td style={td}>{src}</td>
                    <td style={{ ...td, textAlign:'right' }}>{c.total}</td>
                    <td style={{ ...td, textAlign:'right' }}>{c.pos}</td>
                    <td style={{ ...td, textAlign:'right' }}>{c.neu}</td>
                    <td style={{ ...td, textAlign:'right' }}>{c.neg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
      <span style={{ width:10, height:10, borderRadius:99, background:color, display:'inline-block' }} />
      <span>{label}</span>
    </span>
  );
}

function PointCard({ n, color, title, count, pct, themes, emptyHint }: {
  n: number; color: string; title: string; count: number; pct: number;
  themes: string[]; emptyHint: string;
}) {
  return (
    <div style={{
      background:'#FFFFFF', border:'1px solid ' + color + '33', borderRadius:8,
      padding:'14px 14px 12px', position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:3, background: color,
      }} />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{
          width:22, height:22, borderRadius:99, background:color, color:'#FFFFFF',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:700,
        }}>{n}</span>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.14em', color: color }}>{title}</span>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:8 }}>
        <span style={{ fontSize:22, fontWeight:700, color:'#1B1B1B' }}>{count}</span>
        <span style={{ fontSize:11, color:'#5A5A5A' }}>· {pct}%</span>
      </div>
      {themes.length === 0 ? (
        <div style={{ fontSize:10, color:'#8A8A8A' }}>{emptyHint}</div>
      ) : (
        <ul style={{ paddingLeft:14, margin:0, listStyleType:'disc' }}>
          {themes.map((t, i) => (
            <li key={i} style={{ fontSize:11, color:'#3A3A3A', lineHeight:1.5 }}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const box: React.CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', overflow:'hidden' };
const header: React.CSSProperties = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'#FAFAF7', border:'none', borderBottom:'1px solid #E6DFCC', cursor:'pointer', fontFamily:'inherit', textAlign:'left' };
const badgePill: React.CSSProperties = { display:'inline-block', padding:'4px 10px', fontSize:10, fontWeight:700, letterSpacing:'0.14em', color:'#FFFFFF', background:'#1B1B1B', borderRadius:99 };
const th: React.CSSProperties = { textAlign:'left', padding:'6px 8px', fontSize:10, fontWeight:600, color:'#5A5A5A', borderBottom:'1px solid #E6DFCC', letterSpacing:'0.06em', textTransform:'uppercase' };
const td: React.CSSProperties = { padding:'6px 8px', fontSize:12, color:'#1B1B1B', borderBottom:'1px solid #F0EBD9' };