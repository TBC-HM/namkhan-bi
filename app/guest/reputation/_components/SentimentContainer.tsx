'use client';
// app/guest/reputation/_components/SentimentContainer.tsx
// PBS 2026-07-06 v3: word-cloud style — negative words (red) at top, positive (green) at bottom.
// Font size scales with word frequency. Fully dynamic — recomputed on every page load from live reviews.
import { useMemo, useState } from 'react';

type Review = {
  id: number; source: string; rating_norm: number | string | null;
  title: string | null; body: string | null;
};

// Stopwords + junk tokens to strip before counting.
const STOP = new Set([
  'the','a','an','and','or','but','if','then','of','to','in','for','on','at','by','with','from',
  'we','us','our','ours','you','your','yours','they','them','their','it','its','this','that','these','those',
  'is','are','was','were','be','been','being','am','has','have','had','do','does','did','done',
  'not','no','yes','so','as','also','just','than','too','very','more','most','some','any','all',
  'i','me','my','mine','he','she','him','her','his','hers','one','two','three',
  'up','down','out','over','under','again','further','once','here','there','when','where','why','how',
  'what','which','who','whom','can','will','would','should','could','may','might','shall','must',
  'about','into','onto','through','during','before','after','above','below','between','including',
  '+','-',
  'namkhan','the-namkhan',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[\d]/g, ' ')
    .replace(/[^a-z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && w.length < 20 && !STOP.has(w));
}

export default function SentimentContainer({ reviews }: { reviews: Review[] }) {
  const [expanded, setExpanded] = useState(true);

  const cloud = useMemo(() => {
    // Global counts + counts within positive/negative buckets, so we can tell which side each word leans.
    const posCounts = new Map<string, number>();
    const negCounts = new Map<string, number>();
    for (const r of reviews) {
      const n = Number(r.rating_norm);
      const text = (r.title ?? '') + ' ' + (r.body ?? '');
      const words = tokenize(text);
      const target = n >= 4 ? posCounts : (n < 3 ? negCounts : null);
      if (!target) continue;   // neutral reviews don't contribute
      for (const w of words) target.set(w, (target.get(w) ?? 0) + 1);
    }
    // Merge: each word gets total count + bias (positive share) → determines colour
    const merged = new Map<string, { total: number; posShare: number }>();
    for (const [w, c] of posCounts) merged.set(w, { total: c, posShare: 1 });
    for (const [w, c] of negCounts) {
      const cur = merged.get(w);
      if (cur) merged.set(w, { total: cur.total + c, posShare: cur.total / (cur.total + c) });
      else     merged.set(w, { total: c, posShare: 0 });
    }
    // Filter noise + sort by frequency desc
    const rows = Array.from(merged.entries())
      .filter(([,v]) => v.total >= 1)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 60);
    if (rows.length === 0) return { pos: [] as Array<[string, number]>, neg: [] as Array<[string, number]> };
    const maxCount = Math.max(...rows.map(([, v]) => v.total));
    const pos: Array<[string, number]> = [];
    const neg: Array<[string, number]> = [];
    for (const [w, v] of rows) {
      const size = 12 + Math.round((v.total / maxCount) * 30); // 12-42px font
      if (v.posShare >= 0.5) pos.push([w, size]);
      else                    neg.push([w, size]);
    }
    return { pos, neg };
  }, [reviews]);

  const totalPos = reviews.filter(r => Number(r.rating_norm) >= 4).length;
  const totalNeg = reviews.filter(r => Number(r.rating_norm) < 3).length;
  const totalNeu = reviews.filter(r => { const n = Number(r.rating_norm); return n >= 3 && n < 4; }).length;

  return (
    <div style={box}>
      <button onClick={() => setExpanded(!expanded)} style={header}>
        <span style={badgePill}>SENTIMENT · WORD CLOUD</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'#5A5A5A', fontWeight:400 }}>
          + {totalPos} pos · {totalNeu} neu · {totalNeg} neg
        </span>
        <span style={{ fontSize:14 }}>{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div style={{ padding:16 }}>
          {/* POSITIVE words — top, green */}
          <div style={{
            minHeight: 100,
            display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center',
            gap:'6px 10px',
            padding:'16px 8px',
            lineHeight:1.15,
          }}>
            {cloud.pos.length === 0 && cloud.neg.length === 0 && (
              <div style={{ fontSize:12, color:'#8A8A8A' }}>No words yet — scrape reviews to populate the cloud.</div>
            )}
            {cloud.pos.length === 0 && cloud.neg.length > 0 && (
              <div style={{ fontSize:11, color:'#8A8A8A' }}>No positive-review vocabulary yet.</div>
            )}
            {cloud.pos.map(([w, size], i) => (
              <span key={'pos-'+i} style={{
                fontSize: size, color: '#2D6A4F', fontWeight: size > 24 ? 700 : 500,
                fontFamily:'Georgia, "Times New Roman", serif',
              }}>{w}</span>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop:'1px dashed #E6DFCC', margin:'8px 0' }} />

          {/* NEGATIVE words — bottom, red */}
          <div style={{
            minHeight: 100,
            display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'center',
            gap:'6px 10px',
            padding:'16px 8px',
            lineHeight:1.15,
          }}>
            {cloud.neg.length === 0 && (
              <div style={{ fontSize:11, color:'#8A8A8A', fontStyle:'italic' }}>No negative-review vocabulary — all reviews are 4★+.</div>
            )}
            {cloud.neg.map(([w, size], i) => (
              <span key={'neg-'+i} style={{
                fontSize: size, color: '#B04A2F', fontWeight: size > 24 ? 700 : 500,
                fontFamily:'Georgia, "Times New Roman", serif',
              }}>{w}</span>
            ))}
          </div>

          {/* Sub-footer */}
          <div style={{
            marginTop:14, paddingTop:10, borderTop:'1px solid #F0EBD9',
            display:'flex', justifyContent:'space-between', fontSize:10, color:'#8A8A8A',
          }}>
            <span>Word size = frequency across {reviews.length} reviews.</span>
            <span>Green = ★4+ reviews · Red = ★{'<'}3 reviews.</span>
          </div>
        </div>
      )}
    </div>
  );
}

const box: React.CSSProperties = { border:'1px solid #E6DFCC', borderRadius:6, background:'#FFFFFF', overflow:'hidden' };
const header: React.CSSProperties = { display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'#FAFAF7', border:'none', borderBottom:'1px solid #E6DFCC', cursor:'pointer', fontFamily:'inherit', textAlign:'left' };
const badgePill: React.CSSProperties = { display:'inline-block', padding:'4px 10px', fontSize:10, fontWeight:700, letterSpacing:'0.14em', color:'#FFFFFF', background:'#1B1B1B', borderRadius:99 };