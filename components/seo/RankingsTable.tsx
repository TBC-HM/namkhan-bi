'use client';
// RankingsTable — interactive SEO rankings with:
// 1. Position trend sparkline per keyword
// 2. SERP feature badges
// 3. Top 5 competitor expand
// 4. Market cross-comparison
// 5. Quick-wins filter (pos 4-20)
// 6. By-page grouping

import { useState, useMemo } from 'react';

const HAIR='#E6DFCC'; const INK='#1B1B1B'; const INK_M='#5A5A5A'; const INK_F='#8A8A8A';
const GREEN='#084838'; const AMBER='#C28F2C'; const RED='#B03826'; const WHITE='#FFFFFF';

export interface RankRow {
  keyword_id: number; keyword: string; location_name: string; location_code: number;
  monthly_searches: number|null; keyword_difficulty: number|null; cpc_usd: number|null;
  snapshot_date: string|null; position: number|null; url: string|null; title: string|null;
  last_checked: string|null; prev_position: number|null; delta: number|null;
  serp_features: { items_returned?: number; top5?: Array<{pos:number;domain:string;title?:string}> }|null;
}

export interface HistoryRow {
  keyword_id: number; keyword: string; location_name: string; location_code: number;
  snapshot_date: string; position: number|null; serp_features: any;
}

export interface MarketRow {
  keyword: string; keyword_id: number; location_name: string; location_code: number;
  language_code: string; position: number|null; url: string|null; snapshot_date: string|null;
}

interface Props {
  rankings: RankRow[];
  history: HistoryRow[];
  marketData: MarketRow[];
}

const MARKET_FLAGS: Record<number, string> = {
  2418: '🇱🇦', 2276: '🇩🇪', 2826: '🇬🇧', 2840: '🇺🇸', 2250: '🇫🇷', 2036: '🇦🇺',
};

// ── Inline SVG sparkline (no dependencies) ────────────────────────────────
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const W = points.length * 14;
  const H = 28;
  const maxP = 30;
  const yOf = (p: number) => H - Math.round((Math.max(0, maxP - p) / maxP) * H * 0.9 + H * 0.05);
  const coords = points.map((p, i) => `${i * 14 + 7},${yOf(p)}`).join(' ');
  const latest = points[points.length - 1];
  const prev = points[points.length - 2];
  const color = prev == null ? AMBER : latest < prev ? GREEN : latest > prev ? RED : AMBER;
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * 14 + 7} cy={yOf(p)} r={i === points.length - 1 ? 3 : 1.5}
          fill={i === points.length - 1 ? color : WHITE} stroke={color} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ── SERP feature badges ──────────────────────────────────────────────────
function SerpBadges({ features }: { features: RankRow['serp_features'] }) {
  if (!features?.top5?.length) return null;
  const domains = features.top5.map(f => f.domain ?? '');
  const hasBooking = domains.some(d => d.includes('booking'));
  const hasTa = domains.some(d => d.includes('tripadvisor'));
  const hasAgoda = domains.some(d => d.includes('agoda'));
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' as const }}>
      {hasBooking && <span title="Booking.com in top 5" style={badge('#1A4FA0')}>BK</span>}
      {hasTa && <span title="TripAdvisor in top 5" style={badge('#00AF87')}>TA</span>}
      {hasAgoda && <span title="Agoda in top 5" style={badge('#E05B0E')}>AG</span>}
    </div>
  );
}
function badge(color: string): React.CSSProperties {
  return { fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
    background: color, color: WHITE, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.05em' };
}

export default function RankingsTable({ rankings, history, marketData }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [quickWins, setQuickWins] = useState(false);
  const [byPage, setByPage]     = useState(false);
  const [marketKw, setMarketKw] = useState<string | null>(null);

  // Build history map: keyword_id+location_code → sorted positions (oldest→newest)
  const historyMap = useMemo(() => {
    const m = new Map<string, number[]>();
    const sorted = [...history].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    for (const h of sorted) {
      if (h.position === null) continue;
      const key = `${h.keyword_id}-${h.location_code}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(h.position);
    }
    return m;
  }, [history]);

  // Apply filters
  let rows = rankings;
  if (quickWins) rows = rows.filter(r => r.position !== null && r.position >= 4 && r.position <= 20);

  // By-page grouping
  const pageGroups = useMemo(() => {
    if (!byPage) return null;
    const g = new Map<string, RankRow[]>();
    for (const r of rows) {
      const key = r.url ?? '(not ranking)';
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(r);
    }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, byPage]);

  // Market comparison for selected keyword
  const marketRows = useMemo(() =>
    marketKw ? marketData.filter(m => m.keyword === marketKw).sort((a, b) => (a.location_code ?? 0) - (b.location_code ?? 0)) : [],
  [marketKw, marketData]);

  const toggleExpand = (id: number) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const posColor = (p: number|null) => p===null?INK_F:p<=3?GREEN:p<=10?AMBER:INK_M;
  const kdColor  = (k: number|null) => k===null?INK_F:k<=30?GREEN:k<=60?AMBER:RED;
  const deltaStr = (d: number|null) => d===null?'—':d>0?`↑${d}`:d<0?`↓${Math.abs(d)}`:'→';
  const deltaCol = (d: number|null) => d===null?INK_F:d>0?GREEN:d<0?RED:INK_M;

  const th: React.CSSProperties = { padding:'6px 8px', textAlign:'left', fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600, whiteSpace:'nowrap' as const, borderBottom:`2px solid ${HAIR}` };
  const td: React.CSSProperties = { padding:'7px 8px', verticalAlign:'top' };
  const filterBtn = (active: boolean): React.CSSProperties => ({
    padding:'4px 12px', fontSize:11, fontWeight:600, cursor:'pointer', borderRadius:4, border:`1px solid ${active?GREEN:HAIR}`,
    background:active?GREEN:WHITE, color:active?WHITE:INK_M, transition:'all .15s',
  });

  const renderTable = (data: RankRow[]) => (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
      <thead><tr>
        {['','Pos','Δ','Trend','Keyword','Market','Competitors','Volume','Diff','URL','↗'].map((h,i)=>(
          <th key={i} style={th}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {data.map(r => {
          const histKey = `${r.keyword_id}-${r.location_code}`;
          const pts = historyMap.get(histKey) ?? [];
          const isExp = expanded.has(r.keyword_id * 10000 + (r.location_code ?? 0));
          const top5 = r.serp_features?.top5 ?? [];
          return (
            <>
              <tr key={`${r.keyword_id}-${r.location_code}`}
                style={{ borderBottom:`1px solid ${HAIR}`, cursor:'pointer', background:isExp?'#F9F6F0':WHITE }}
                onClick={() => toggleExpand(r.keyword_id * 10000 + (r.location_code ?? 0))}>
                <td style={{ ...td, width:20, color:INK_F, fontSize:12 }}>{isExp?'▼':'▶'}</td>
                <td style={{ ...td, fontFamily:'ui-monospace,monospace', fontWeight:700, color:posColor(r.position), fontSize:16, whiteSpace:'nowrap' as const }}>{r.position??'—'}</td>
                <td style={{ ...td, fontFamily:'ui-monospace,monospace', color:deltaCol(r.delta), fontSize:11, whiteSpace:'nowrap' as const }}>{deltaStr(r.delta)}</td>
                <td style={{ ...td, width:pts.length*14+8 }}>{pts.length >= 2 ? <Sparkline points={pts}/> : <span style={{ color:INK_F, fontSize:10 }}>—</span>}</td>
                <td style={{ ...td, color:INK, fontStyle:'italic' }}>{r.keyword}</td>
                <td style={{ ...td, whiteSpace:'nowrap' as const }}>
                  <button onClick={e=>{e.stopPropagation();setMarketKw(marketKw===r.keyword?null:r.keyword);}}
                    style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:16, padding:0 }}
                    title="Compare across markets">
                    {MARKET_FLAGS[r.location_code??2418]??'🌍'}
                  </button>
                </td>
                <td style={{ ...td }}><SerpBadges features={r.serp_features}/></td>
                <td style={{ ...td, fontFamily:'ui-monospace,monospace', fontSize:11, color:INK }}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                <td style={{ ...td, color:kdColor(r.keyword_difficulty), fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.keyword_difficulty!=null?`${r.keyword_difficulty}%`:'—'}</td>
                <td style={{ ...td, maxWidth:200 }}>
                  {r.url?<a href={r.url} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()}
                    style={{ color:GREEN, fontSize:10, textDecoration:'none', fontFamily:'ui-monospace,monospace', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                    {r.url.replace('https://www.thenamkhan.com','').replace('https://','') || '/'}
                  </a>:<span style={{ color:INK_F, fontSize:11 }}>not in top 30</span>}
                </td>
                <td style={{ ...td }}>
                  <span style={{ fontSize:9, fontFamily:'ui-monospace,monospace', color:INK_F }}>
                    {r.last_checked?r.last_checked.slice(5,10):'—'}
                  </span>
                </td>
              </tr>
              {/* ── Expanded row: top 5 competitors ── */}
              {isExp && (
                <tr style={{ borderBottom:`2px solid ${HAIR}`, background:'#F9F6F0' }}>
                  <td colSpan={11} style={{ padding:'10px 16px 12px 40px' }}>
                    {top5.length > 0 ? (
                      <div>
                        <div style={{ fontSize:10, fontWeight:700, color:INK_F, letterSpacing:'0.1em', textTransform:'uppercase' as const, marginBottom:6 }}>
                          Top 5 on SERP for &ldquo;{r.keyword}&rdquo; ({r.location_name})
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {top5.map((c, i) => {
                            const isUs = c.domain?.includes('thenamkhan');
                            return (
                              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12,
                                color:isUs?GREEN:INK, fontWeight:isUs?700:400 }}>
                                <span style={{ fontFamily:'ui-monospace,monospace', fontSize:11, minWidth:18, color:isUs?GREEN:INK_F }}>#{c.pos}</span>
                                <span style={{ fontFamily:'ui-monospace,monospace', fontSize:11, minWidth:160 }}>{c.domain}</span>
                                {c.title && <span style={{ color:INK_M, fontSize:11, fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, maxWidth:400 }}>{c.title}</span>}
                                {isUs && <span style={{ fontSize:10, background:GREEN, color:WHITE, padding:'1px 5px', borderRadius:3 }}>us</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize:11, color:INK_F }}>No competitor data stored — run SERP fetch to populate.</span>
                    )}
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' as const }}>
        <button style={filterBtn(quickWins)} onClick={() => setQuickWins(!quickWins)}>
          ⚡ Quick wins {quickWins ? `(${rows.length})` : '(pos 4–20)'}
        </button>
        <button style={filterBtn(byPage)} onClick={() => setByPage(!byPage)}>
          📄 By page
        </button>
        {quickWins && (
          <span style={{ fontSize:11, color:INK_M }}>Showing positions 4–20 — easiest moves to top 3</span>
        )}
        <span style={{ marginLeft:'auto', fontSize:11, color:INK_F, fontFamily:'ui-monospace,monospace' }}>
          {rows.length} keywords · click row to expand competitors · 🏳️ to compare markets
        </span>
      </div>

      {/* ── Market comparison panel ── */}
      {marketKw && (
        <div style={{ background:'#F0F7F4', border:`1px solid ${GREEN}`, borderRadius:8, padding:'12px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:GREEN, fontStyle:'italic' }}>&ldquo;{marketKw}&rdquo;</span>
            <span style={{ fontSize:11, color:INK_M }}>across all tracked markets</span>
            <button onClick={()=>setMarketKw(null)} style={{ marginLeft:'auto', background:'transparent', border:'none', cursor:'pointer', fontSize:16, color:INK_F }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:8 }}>
            {marketRows.map((m, i) => {
              const pc = posColor(m.position);
              return (
                <div key={i} style={{ background:WHITE, border:`1px solid ${HAIR}`, borderRadius:6, padding:'10px 12px', textAlign:'center' as const }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{MARKET_FLAGS[m.location_code??2418]??'🌍'}</div>
                  <div style={{ fontSize:11, color:INK_M, marginBottom:4, fontFamily:'ui-monospace,monospace' }}>
                    {m.location_name?.split(',').pop()?.trim()}
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, color:pc, fontVariantNumeric:'tabular-nums' }}>
                    {m.position != null ? `#${m.position}` : '—'}
                  </div>
                  {m.snapshot_date && <div style={{ fontSize:9, color:INK_F, marginTop:2 }}>{m.snapshot_date.slice(5)}</div>}
                </div>
              );
            })}
            {marketRows.length === 0 && (
              <div style={{ gridColumn:'1/-1', fontSize:11, color:INK_M }}>
                No data yet — run SERP tasks for this keyword across markets
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main table ── */}
      <div style={{ overflowX:'auto' }}>
        {byPage && pageGroups ? (
          pageGroups.map(([page, pageRows]) => (
            <div key={page} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:GREEN, fontFamily:'ui-monospace,monospace',
                padding:'6px 10px', background:'#F0F7F4', borderRadius:'4px 4px 0 0', borderBottom:`2px solid ${GREEN}` }}>
                📄 {page === '(not ranking)' ? page : page.replace('https://www.thenamkhan.com','') || '/'}
                <span style={{ fontWeight:400, color:INK_M, marginLeft:8 }}>{pageRows.length} keywords</span>
              </div>
              {renderTable(pageRows)}
            </div>
          ))
        ) : (
          renderTable(rows)
        )}
      </div>
    </div>
  );
}
