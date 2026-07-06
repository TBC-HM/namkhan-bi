'use client';
// app/guest/reputation/_components/SentimentContainer.tsx
// Analyses all local-sample reviews (existing + any that land in future — data is re-computed on every page load).
import { useState } from 'react';

type Review = {
  id: number; source: string; rating_norm: number | string | null;
  title: string | null; body: string | null;
};

// Word themes → tokens to hunt in review titles+bodies (case-insensitive).
// Grouped into positive vs negative buckets so complaints get flagged distinctly.
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
  Food_neg:    ['bland','expensive food','overpriced','limited menu','breakfast poor'],
  Price:       ['overpriced','expensive','pricey'],
};

function tokenize(s: string): string {
  return s.toLowerCase();
}
function countThemes(reviews: Review[], themeMap: Record<string, string[]>) {
  const counts = new Map<string, number>();
  for (const theme of Object.keys(themeMap)) counts.set(theme, 0);
  for (const r of reviews) {
    const hay = tokenize((r.title ?? '') + ' ' + (r.body ?? ''));
    for (const [theme, needles] of Object.entries(themeMap)) {
      if (needles.some(n => hay.includes(n))) counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).filter(([,n]) => n > 0).sort((a,b) => b[1] - a[1]);
}

export default function SentimentContainer({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState(true);

  // Overall sentiment split by normalised rating (0-5 scale)
  const bucket = { pos: 0, neu: 0, neg: 0, unknown: 0 };
  for (const r of reviews) {
    const n = Number(r.rating_norm);
    if (!Number.isFinite(n)) { bucket.unknown++; continue; }
    if (n >= 4)      bucket.pos++;
    else if (n >= 3) bucket.neu++;
    else             bucket.neg++;
  }
  const total = bucket.pos + bucket.neu + bucket.neg;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  // Per-source split
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
  const negativeReviews = reviews.filter(r => Number(r.rating_norm) < 3);
  const topPraise    = countThemes(positiveReviews, POSITIVE_THEMES).slice(0, 6);
  const topComplaints = countThemes(negativeReviews, NEGATIVE_THEMES).slice(0, 6);

  return (
    <div style={box}>
      <button onClick={() => setExpanded(!expanded)} style={header}>
        <span>💬 Sentiment analysis</span>
        <span style={{ fontSize:11, color:'#5A5A5A', fontWeight:400 }}>
          {total} reviews · {pct(bucket.pos)}% positive · {pct(bucket.neu)}% neutral · {pct(bucket.neg)}% negative
        </span>
        <span style={{ marginLeft:'auto', fontSize:14 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ padding:14 }}>
          {/* Overall bar */}
          <div style={{ display:'flex', height:12, borderRadius:6, overflow:'hidden', marginBottom:14, background:'#EEE' }}>
            <div style={{ width: pct(bucket.pos)+'%', background:'#4A8A5F' }} title={`Positive: ${bucket.pos}`} />
            <div style={{ width: pct(bucket.neu)+'%', background:'#D4A866' }} title={`Neutral: ${bucket.neu}`} />
            <div style={{ width: pct(bucket.neg)+'%', background:'#B04A2F' }} title={`Negative: ${bucket.neg}`} />
          </div>

          {/* Per-source table */}
          <div style={{ fontSize:11, fontWeight:600, color:'#5A5A5A', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>By source</div>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>Source</th>
                <th style={{ ...th, textAlign:'right' }}>Total</th>
                <th style={{ ...th, textAlign:'right', color:'#4A8A5F' }}>Positive</th>
                <th style={{ ...th, textAlign:'right', color:'#D4A866' }}>Neutral</th>
                <th style={{ ...th, textAlign:'right', color:'#B04A2F' }}>Negative</th>
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

          {/* Themes */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:14 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#4A8A5F', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>What guests praise</div>
              {topPraise.length === 0 && <div style={{ fontSize:11, color:'#5A5A5A' }}>No clear themes yet.</div>}
              {topPraise.map(([theme, n]) => (
                <div key={theme} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid #F0EBD9' }}>
                  <span>{theme}</span>
                  <span style={{ color:'#5A5A5A' }}>{n}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'#B04A2F', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:6 }}>What guests complain</div>
              {topComplaints.length === 0 && <div style={{ fontSize:11, color:'#5A5A5A' }}>No complaints found in local sample.</div>}
              {topComplaints.map(([theme, n]) => (
                <div key={theme} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid #F0EBD9' }}>
                  <span>{theme}</span>
                  <span style={{ color:'#5A5A5A' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', overflow:'hidden' };
const header: React.CSSProperties = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'#FAFAF7', border:'none', borderBottom:'1px solid #E6DFCC', fontSize:12, fontWeight:600, color:'#1B1B1B', cursor:'pointer', fontFamily:'inherit', textAlign:'left' };
const tbl: React.CSSProperties = { borderCollapse:'collapse', width:'100%' };
const th: React.CSSProperties = { textAlign:'left', padding:'6px 8px', fontSize:11, fontWeight:600, color:'#5A5A5A', borderBottom:'1px solid #E6DFCC' };
const td: React.CSSProperties = { padding:'6px 8px', fontSize:12, color:'#1B1B1B', borderBottom:'1px solid #F0EBD9' };