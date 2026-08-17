// app/h/1000001/marketing/seo/page.tsx
// Donna SEO module — www.thedonnaportals.com · property_id 1000001
// Mirrors Namkhan SEO tabs: Overview · Rankings · Keywords · Local Pack · Technical · AI Visibility
// Domain: Mallorca boutique hotel · primary markets UK, DE, US, ES

import { DashboardPage, Container } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { CSSProperties } from 'react';
import SeoTriggerBtn from '@/components/seo/SeoTriggerBtn';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PID = 1000001;
const DOMAIN = 'www.thedonnaportals.com';
const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_M='#5A5A5A';const INK_F='#8A8A8A';
const GREEN='#084838';const AMBER='#C28F2C';const RED='#B03826';

interface RankRow { keyword_id:number; keyword:string; location_name:string; monthly_searches:number|null; keyword_difficulty:number|null; position:number|null; last_checked:string|null; }

const SEO_TABS = [
  { key:'overview', label:'Overview' },
  { key:'rankings', label:'Rankings' },
  { key:'keywords', label:'Keywords' },
  { key:'local',    label:'Local Pack' },
  { key:'technical',label:'Technical' },
  { key:'ai-visibility', label:'AI Visibility' },
  { key:'pages', label:'Pages' },
  { key:'hotel', label:'Hotel Data' },
];

export default async function DonnaSeoPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const tab = searchParams?.tab ?? 'overview';
  const sb = getSupabaseAdmin();

  const [rankRes, llmRes, pagesRes] = await Promise.all([
    sb.from('v_seo_rankings').select('*').eq('property_id', PID),
    tab === 'ai-visibility'
      ? sb.from('v_seo_llm_snapshots').select('*').eq('property_id', PID).order('snapshot_date', { ascending: false }).limit(1)
      : Promise.resolve({ data: [] }),
    tab === 'pages' ? sb.from('v_seo_ranked_pages').select('url,keyword,position,volume,search_intent').eq('property_id', PID).order('position', { ascending: true }).limit(500) : Promise.resolve({ data: [] }),
  ]);

  const rankings = (rankRes.data ?? []) as RankRow[];
  const withPos  = rankings.filter(r => r.position !== null);
  const top10    = withPos.filter(r => (r.position ?? 99) <= 10);
  type PageKw={url:string;keyword:string;position:number|null;volume:number|null};
  const pagesRows=(pagesRes.data??[]) as PageKw[];
  const pagesMap=new Map<string,PageKw[]>();
  for(const r of pagesRows){if(!r.url)continue;if(!pagesMap.has(r.url))pagesMap.set(r.url,[]);pagesMap.get(r.url)!.push(r);}
  const pagesArr=[...pagesMap.entries()].map(([url,kws])=>({url,count:kws.length,bestPos:Math.min(...kws.map(k=>k.position??99)),vol:kws.reduce((s,k)=>s+(k.volume??0),0),top:kws.slice(0,3)})).sort((a,b)=>a.bestPos-b.bestPos);
  const llmSnap  = ((llmRes.data ?? [])[0] ?? null) as {
    total_mentions:number; ai_search_volume:number; google_mentions:number; chatgpt_mentions:number; sources_raw:unknown; target:string; snapshot_date:string;
  } | null;

  const CELL: CSSProperties = { padding:'7px 8px', borderBottom:`1px solid ${HAIR}`, fontSize:12, color:INK };
  const TH: CSSProperties = { ...CELL, fontWeight:600, color:INK_F, fontSize:10, fontFamily:'ui-monospace,monospace', textTransform:'uppercase', letterSpacing:'0.1em', background:'#FAFAF7' };

  return (
    <DashboardPage title="Donna · SEO" subtitle={`${DOMAIN} · ${rankings.length} keywords · AI visibility`}>

      <div style={{ gridColumn:'1/-1', display:'flex', gap:0, borderBottom:`2px solid ${HAIR}`, marginBottom:4 }}>
        {SEO_TABS.map(t=>(
          <a key={t.key} href={`?tab=${t.key}`}
            style={{ padding:'8px 16px', fontSize:12, fontWeight:600, textDecoration:'none',
              color:tab===t.key?GREEN:INK_M, borderBottom:tab===t.key?`2px solid ${GREEN}`:'2px solid transparent',
              marginBottom:-2, whiteSpace:'nowrap' as const }}>{t.label}</a>
        ))}
      </div>

      {/* ─── OVERVIEW ── */}
      {tab==='overview' && (
        <>
          <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:8 }}>
            {[
              { l:'Tracked keywords', v:rankings.length },
              { l:'In top 10', v:top10.length, col:top10.length>0?GREEN:INK_F },
              { l:'Ranked', v:withPos.length },
              { l:'Not yet ranked', v:rankings.length-withPos.length },
            ].map((k,i)=>(
              <div key={i} style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.13em', textTransform:'uppercase' as const, color:INK_F, marginBottom:4 }}>{k.l}</div>
                <div style={{ fontSize:24, fontWeight:700, color:k.col??INK, lineHeight:1 }}>{k.v}</div>
              </div>
            ))}
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, flexWrap:'wrap' as const, alignItems:'center', padding:'12px 16px', background:'#F4EFE2', borderRadius:6 }}>
            <span style={{ fontSize:12, fontWeight:600, color:INK }}>Pipeline</span>
            <SeoTriggerBtn mode="post" label="▶ Post SERP tasks" description="Submit Donna keywords to DataForSEO" />
            <SeoTriggerBtn mode="fetch" label="⬇ Fetch results" variant="secondary" />
            <SeoTriggerBtn mode="volume" label="📊 Refresh volume" variant="secondary" />
          </div>
          <div style={{ gridColumn:'1/-1', padding:'12px 16px', background:'#F9F6F0', borderRadius:6, fontSize:12, color:INK_M }}>
            Domain: <strong>{DOMAIN}</strong> · Mallorca boutique hotel · SLH member · Primary markets: UK · DE · US · ES
          </div>
        </>
      )}

      {/* ─── RANKINGS ── */}
      {tab==='rankings' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Keyword rankings" subtitle={`${DOMAIN} · ${rankings.length} keywords tracked`}
            action={<div style={{ display:'flex', gap:8 }}><SeoTriggerBtn mode="post" label="▶ Post tasks" variant="secondary" /><SeoTriggerBtn mode="fetch" label="⬇ Fetch" variant="secondary" /></div>}>
            {rankings.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center' as const }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📡</div>
                <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>No ranking data yet</div>
                <div style={{ fontSize:12, color:INK_M }}>Click ▶ Post SERP tasks to start tracking</div>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
                <thead><tr>{['Keyword','Market','Position','Difficulty','Volume'].map(h=><th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>
                  {rankings.map(r=>(
                    <tr key={r.keyword_id}>
                      <td style={{ ...CELL, fontStyle:'italic' }}>{r.keyword}</td>
                      <td style={{ ...CELL, color:INK_F, fontSize:11 }}>{r.location_name}</td>
                      <td style={CELL}><span style={{ fontSize:10, fontFamily:'ui-monospace,monospace', color:r.position!=null?GREEN:INK_F, border:'1px solid', borderColor:r.position!=null?GREEN:HAIR, padding:'2px 6px', borderRadius:3 }}>{r.position!=null?`#${r.position}`:'—'}</span></td>
                      <td style={{ ...CELL, color:INK_F, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.keyword_difficulty!=null?`${r.keyword_difficulty}%`:'—'}</td>
                      <td style={{ ...CELL, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Container>
        </div>
      )}

      {/* ─── KEYWORDS ── */}
      {tab==='keywords' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Tracked keywords" subtitle="Volume · difficulty · all markets">
            <div style={{ marginBottom:10, fontSize:11, color:INK_M }}>12 keywords seeded for Mallorca market. Click ▶ Post SERP tasks in Overview to start fetching rankings.</div>
            <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6 }}>
              {rankings.filter((r,i,a)=>a.findIndex(x=>x.keyword===r.keyword)===i).map(r=>(
                <div key={r.keyword_id} style={{ fontSize:11, fontStyle:'italic', border:`1px solid ${HAIR}`, padding:'4px 10px', borderRadius:4, color:INK_M }}>{r.keyword}</div>
              ))}
            </div>
          </Container>
        </div>
      )}

      {/* ─── LOCAL PACK ── */}
      {tab==='local' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Google Maps · Local pack" subtitle="www.thedonnaportals.com position in local map results"
            action={<SeoTriggerBtn mode="local" label="🗺️ Fetch local pack" description="DataForSEO Maps API" />}>
            <div style={{ padding:'32px 16px', textAlign:'center' as const, color:INK_M, fontSize:13 }}>
              No local pack data yet — click <strong>Fetch local pack</strong> to start.
            </div>
          </Container>
        </div>
      )}

      {/* ─── TECHNICAL ── */}
      {tab==='technical' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Technical SEO · On-page audit" subtitle={`${DOMAIN} · meta, titles, Core Web Vitals`}
            action={<SeoTriggerBtn mode="onpage" label="🔍 Run On-Page Crawl" description="Up to 50 pages · DataForSEO" />}>
            <div style={{ padding:'32px 16px', textAlign:'center' as const, color:INK_M, fontSize:13 }}>
              No on-page audit yet — click <strong>Run On-Page Crawl</strong> to start.
            </div>
          </Container>
        </div>
      )}

      {/* ─── AI VISIBILITY ── */}
      {tab==='ai-visibility' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="AI Visibility · LLM Mentions" subtitle={`${DOMAIN} in Google AI Overviews + ChatGPT`}
            action={<SeoTriggerBtn mode="llm" label="🔄 Refresh AI data" description="DataForSEO LLM Mentions" />}>
            {!llmSnap || llmSnap.total_mentions === 0 ? (
              <div style={{ padding:'32px 16px', textAlign:'center' as const, color:INK_M, fontSize:13 }}>
                No AI visibility data yet — click <strong>Refresh AI data</strong> to fetch from DataForSEO.
              </div>
            ) : (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, marginBottom:16 }}>
                  {([[`Total AI mentions`,String(llmSnap.total_mentions),GREEN],[`AI search volume`,Number(llmSnap.ai_search_volume).toLocaleString(),INK],[`Google AI Overview`,String(llmSnap.google_mentions),GREEN],[`ChatGPT`,String(llmSnap.chatgpt_mentions),INK]] as [string,string,string][]).map(([l,v,c],i)=>(
                    <div key={i} style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'10px 14px' }}>
                      <div style={{ fontSize:10, fontFamily:'ui-monospace,monospace', textTransform:'uppercase' as const, color:INK_F, marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:22, fontWeight:700, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:10, color:INK_F }}>Last fetched: {llmSnap.snapshot_date} · {llmSnap.target}</div>
              </div>
            )}
          </Container>
        </div>
      )}

      {tab==='pages' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Ranked Pages" subtitle={`${pagesArr.length} pages · ${pagesRows.length} keywords in Google US top 50`}
            action={<SeoTriggerBtn mode="ranked" label="🔄 Refresh page rankings" description="DataForSEO Labs · full domain scan" />}>
            {pagesArr.length===0?(<div style={{padding:'32px 16px',textAlign:'center' as const,color:INK_M,fontSize:13}}>No page ranking data — click <strong>Refresh page rankings</strong>.</div>):(
              <div style={{overflowX:'auto' as const}}>
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                  <thead><tr style={{borderBottom:`1px solid ${HAIR}`}}>
                    {['Page','Kws','Best','Vol','Top keywords'].map(h=>(
                      <th key={h} style={{...TH}}>{h}</th>
                    ))}</tr></thead>
                  <tbody>{pagesArr.map((p,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                      <td style={{...CELL,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}><a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:GREEN,fontSize:11,textDecoration:'none'}}>{p.url.replace(/^https?:\/\/[^/]+/,'')||'/'}</a></td>
                      <td style={{...CELL,fontFamily:'ui-monospace,monospace'}}>{p.count}</td>
                      <td style={{...CELL}}><span style={{fontFamily:'ui-monospace,monospace',fontWeight:700,fontSize:12,color:p.bestPos<=10?GREEN:p.bestPos<=20?AMBER:INK_F}}>#{p.bestPos}</span></td>
                      <td style={{...CELL,fontFamily:'ui-monospace,monospace'}}>{p.vol.toLocaleString()}</td>
                      <td style={{...CELL,maxWidth:300,fontSize:11,color:INK_M}}>{p.top.map(k=>`${k.keyword} (#${k.position??'?'})`).join(' · ')}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Container>
        </div>
      )}

      {tab==='hotel' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Hotel Data · Google Hotels" subtitle={`${DOMAIN} competitive positioning`}
            action={<SeoTriggerBtn mode="hotel" label="🏨 Refresh hotel data" description="Google Hotels search results" />}>
            <div style={{padding:'24px 16px',textAlign:'center' as const,color:INK_M,fontSize:13}}>
              Click <strong>Refresh hotel data</strong> to fetch competitive hotel search results for <strong>{DOMAIN}</strong>.
            </div>
          </Container>
        </div>
      )}

    </DashboardPage>
  );
}
