// app/marketing/seo/page.tsx
// Full 6-tab SEO area — DataForSEO pipeline + multi-market ranking
// Markets: Laos (home) · Germany · UK · US · France · Australia
import { DashboardPage, Container, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MARKETING_SUBPAGES } from '../_subpages';
import SeoTriggerBtn from '@/components/seo/SeoTriggerBtn';
import RankingsTable, { type RankRow as RankRowFull, type HistoryRow, type MarketRow } from '@/components/seo/RankingsTable';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_M='#5A5A5A';const INK_F='#8A8A8A';
const GREEN='#084838';const AMBER='#C28F2C';const RED='#B03826';

interface RankRow {
  keyword_id:number; property_id:number; keyword:string; location_name:string;
  monthly_searches:number|null; keyword_difficulty:number|null; cpc_usd:number|null;
  snapshot_date:string|null; position:number|null; url:string|null; title:string|null;
  last_checked:string|null; prev_position:number|null; delta:number|null;
}
interface LocalRow { keyword:string; snapshot_date:string; our_position:number|null; result_count:number|null; items:any[]|null; }

const MARKETS = [
  { code: 'all',  label: 'All',         loc: null   },
  { code: '2418', label: '🇱🇦 Laos',    loc: 2418   },
  { code: '2276', label: '🇩🇪 Germany',  loc: 2276   },
  { code: '2826', label: '🇬🇧 UK',       loc: 2826   },
  { code: '2840', label: '🇺🇸 US',       loc: 2840   },
  { code: '2250', label: '🇫🇷 France',   loc: 2250   },
  { code: '2036', label: '🇦🇺 AU',       loc: 2036   },
];

const WORKFLOW=[
  {step:'01',title:'Research',desc:'Keyword clusters, intent groups, seasonal trends.'},
  {step:'02',title:'Reason',desc:'AI decides commercial value vs SEO noise.'},
  {step:'03',title:'Structure',desc:'Outline, entities, FAQs, CTAs, internal links.'},
  {step:'04',title:'Write',desc:'Multilingual article variants with localized nuance.'},
  {step:'05',title:'Review',desc:'Human + reality agent validate claims and tone.'},
  {step:'06',title:'Publish',desc:'Push to CMS, sitemap, schema, social.'},
  {step:'07',title:'Analyze',desc:'Track rankings, CTR, traffic, leads, decay.'},
  {step:'08',title:'Refine',desc:'AI refreshes weak pages, expands clusters.'},
];

export default async function MarketingSeoPage({
  searchParams,
}: {
  searchParams?: { tab?: string; loc?: string };
}) {
  const tab = searchParams?.tab ?? 'overview';
  const locFilter = searchParams?.loc ?? 'all';
  const locCode = MARKETS.find(m => m.code === locFilter)?.loc ?? null;

  const sb = getSupabaseAdmin();
  let rankQuery = sb.from('v_seo_rankings').select('*');
  if (locCode) rankQuery = rankQuery.eq('location_name', MARKETS.find(m=>m.loc===locCode)?.label ?? '');

  const [rankRes, localRes, historyRes, marketRes, onpageRes, llmRes, pagesRes, instantRes, questionsRes, hotelRes] = await Promise.all([
    sb.from('v_seo_rankings').select('*'),
    tab === 'local' ? sb.from('v_seo_local_pack').select('*').order('snapshot_date', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    tab === 'rankings' ? sb.from('v_seo_ranking_history').select('keyword_id,keyword,location_name,location_code,snapshot_date,position,serp_features').limit(500) : Promise.resolve({ data: [] }),
    tab === 'rankings' ? sb.from('v_seo_market_comparison').select('*') : Promise.resolve({ data: [] }),
    tab === 'technical' ? sb.from('v_seo_onpage').select('*').order('page_score', { ascending: true }).limit(50) : Promise.resolve({ data: [] }),
    tab === 'ai-visibility' ? sb.from('v_seo_llm_snapshots').select('*').eq('property_id', 260955).order('snapshot_date', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    tab === 'pages' ? sb.from('v_seo_ranked_pages').select('url,keyword,position,volume,search_intent').eq('property_id', 260955).order('position', { ascending: true }).limit(500) : Promise.resolve({ data: [] }),
    tab === 'technical' ? sb.from('v_seo_instant_pages').select('url,page_title,title_length,h1,h2s,word_count,readability,issues,crawl_date').eq('property_id', 260955).order('crawl_date', { ascending: false }) : Promise.resolve({ data: [] }),
    tab === 'ai-visibility' ? sb.from('v_seo_llm_questions').select('keyword,llm,mention_date').eq('property_id', 260955).order('id', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    tab === 'hotel' ? sb.from('v_seo_hotel_searches').select('position,hotel_title,stars,price_usd,rating_value,votes_count,search_keyword,is_our_property').eq('property_id', 260955).order('snapshot_date', { ascending: false }).order('position').limit(20) : Promise.resolve({ data: [] }),
  ]);

  const allRankings = (rankRes.data ?? []) as RankRow[];
  // Apply location filter client-side on the data
  const rankings = locCode
    ? allRankings.filter(r => (r as any).location_code === locCode)
    : allRankings;
  const localPack = (localRes.data ?? []) as LocalRow[];
  const history = (historyRes.data ?? []) as HistoryRow[];
  const marketData = (marketRes.data ?? []) as MarketRow[];
  const onpageRows = (onpageRes.data ?? []) as Array<{url:string;page_title:string|null;title_length:number|null;meta_length:number|null;page_score:number|null;h1:string|null;word_count:number|null;crawl_date:string|null}>;
  type LlmSnap={total_mentions:number;ai_search_volume:number;google_mentions:number;chatgpt_mentions:number;platform_raw:unknown;sources_raw:unknown;target:string;snapshot_date:string};
  const llmSnapshot=((llmRes.data??[])[0]??null) as LlmSnap|null;
  type PageKw={url:string;keyword:string;position:number|null;volume:number|null;search_intent:string|null};
  const pagesRows=(pagesRes.data??[]) as PageKw[];
  const questionsRows=(questionsRes.data??[]) as Array<{keyword:string;llm:string;mention_date:string}>;
  const hotelRows=(hotelRes.data??[]) as Array<{position:number;hotel_title:string;stars:number|null;price_usd:number|null;rating_value:number|null;votes_count:number|null;search_keyword:string;is_our_property:boolean}>;
  type InstantPage={url:string;page_title:string|null;title_length:number|null;h1:string|null;h2s:string[]|null;word_count:number|null;readability:number|null;issues:Record<string,boolean>|null;crawl_date:string|null};
  const instantPages=(instantRes.data??[]) as InstantPage[];
  const pagesMap=new Map<string,PageKw[]>();
  for(const r of pagesRows){if(!r.url)continue;if(!pagesMap.has(r.url))pagesMap.set(r.url,[]);pagesMap.get(r.url)!.push(r);}
  const pagesArr=[...pagesMap.entries()].map(([url,kws])=>({url,count:kws.length,bestPos:Math.min(...kws.map(k=>k.position??99)),vol:kws.reduce((s,k)=>s+(k.volume??0),0),top:kws.slice(0,3)})).sort((a,b)=>a.bestPos-b.bestPos);

  const hasData = rankings.some(r => r.snapshot_date !== null);
  const withPos = rankings.filter(r => r.position !== null);
  const top3 = withPos.filter(r => (r.position ?? 99) <= 3);
  const top10 = withPos.filter(r => (r.position ?? 99) <= 10);
  const avgPos = withPos.length > 0 ? Math.round(withPos.reduce((s,r)=>s+(r.position??0),0)/withPos.length) : null;
  const lastSync = allRankings.reduce((max:string|null,r)=>{ if(!r.last_checked)return max; return !max||r.last_checked>max?r.last_checked:max; },null);

  const marketingTabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/seo',
  }));

  const SEO_TABS = [
    { key:'overview',   label:'Overview'   },{ key:'rankings',   label:'Rankings'   },
    { key:'keywords',   label:'Keywords'   },{ key:'competitors',label:'Competitors' },
    { key:'local',      label:'Local Pack' },{ key:'technical',  label:'Technical'  },{ key:'ai-visibility', label:'AI Visibility' },{ key:'pages', label:'Pages' },{ key:'hotel', label:'Hotel Data' },
  ];

  const btnSt: React.CSSProperties = { padding:'3px 10px', fontSize:11, border:`1px solid ${HAIR}`, borderRadius:3, background:'#FAFAF7', cursor:'pointer', textDecoration:'none', color:INK_M, whiteSpace:'nowrap' };
  const btnActiveSt: React.CSSProperties = { ...btnSt, background:GREEN, color:'#fff', borderColor:GREEN };

  return (
    <DashboardPage title="Marketing · SEO" subtitle={`SERP rank tracker · ${allRankings.length} keywords · AI visibility`} tabs={marketingTabs}>

      {/* SEO sub-tabs */}
      <div style={{ gridColumn:'1/-1', display:'flex', gap:0, borderBottom:`2px solid ${HAIR}`, marginBottom:4 }}>
        {SEO_TABS.map(t=>(
          <a key={t.key} href={`?tab=${t.key}&loc=${locFilter}`}
            style={{ padding:'8px 16px', fontSize:12, fontWeight:600, textDecoration:'none',
              color:tab===t.key?GREEN:INK_M, borderBottom:tab===t.key?`2px solid ${GREEN}`:'2px solid transparent',
              marginBottom:-2, whiteSpace:'nowrap' as const }}>{t.label}</a>
        ))}
      </div>

      {/* Market filter */}
      <div style={{ gridColumn:'1/-1', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' as const }}>
        <span style={{ fontSize:10, color:INK_F, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const }}>Market</span>
        {MARKETS.map(m=>(
          <a key={m.code} href={`?tab=${tab}&loc=${m.code}`} style={locFilter===m.code?btnActiveSt:btnSt}>
            {m.label}
          </a>
        ))}
        <span style={{ marginLeft:8, fontSize:11, color:INK_F }}>
          {rankings.length} keywords · {withPos.length} ranked
        </span>
      </div>

      {/* ─── OVERVIEW ─────────────────────────────────────────────────────── */}
      {tab==='overview' && (
        <>
          <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:8 }}>
            {[
              { l:'Total keywords', v:allRankings.length, fn:'All markets combined' },
              { l:'In top 3',  v:top3.length,  fn:'Google desktop', col:top3.length>0?GREEN:INK_F },
              { l:'In top 10', v:top10.length, fn:'Google desktop', col:top10.length>0?GREEN:INK_F },
              { l:'Avg position', v:avgPos??'—', fn:`${withPos.length} of ${rankings.length} ranked` },
              { l:'Outside top 30', v:rankings.length-withPos.length, fn:'not in top 30', col:(rankings.length-withPos.length)>10?RED:INK_F },
              { l:'Last synced', v:lastSync?lastSync.slice(0,10):'—', fn:'daily 06:00 UTC' },
            ].map((k,i)=>(
              <div key={i} style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.13em', textTransform:'uppercase' as const, color:INK_F, marginBottom:4 }}>{k.l}</div>
                <div style={{ fontSize:24, fontWeight:700, color:k.col??INK, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{String(k.v)}</div>
                {k.fn&&<div style={{ fontSize:10, color:INK_F, marginTop:4 }}>{k.fn}</div>}
              </div>
            ))}
          </div>
          <div style={{ gridColumn:'1/-1', display:'flex', gap:10, flexWrap:'wrap' as const, alignItems:'center', padding:'12px 16px', background:'#F4EFE2', borderRadius:6 }}>
            <span style={{ fontSize:12, fontWeight:600, color:INK }}>Pipeline actions</span>
            <SeoTriggerBtn mode="post" label="▶ Post SERP tasks" description="Submit all active keywords to DataForSEO queue" />
            <SeoTriggerBtn mode="fetch" label="⬇ Fetch results" description="Download ready SERP results" variant="secondary" />
            <SeoTriggerBtn mode="volume" label="📊 Refresh volume" description="Update keyword difficulty + volume" variant="secondary" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:10, fontWeight:600, color:INK_F, marginBottom:8, fontFamily:'ui-monospace,monospace', letterSpacing:'0.13em', textTransform:'uppercase' as const }}>AI production loop</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:8 }}>
              {WORKFLOW.map(s=>(
                <div key={s.step} style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'10px 12px' }}>
                  <div style={{ fontFamily:'ui-monospace,monospace', fontSize:10, letterSpacing:'0.16em', color:GREEN }}>{s.step}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:INK }}>{s.title}</div>
                  <div style={{ fontSize:11, color:INK_M, lineHeight:1.5, marginTop:2 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── RANKINGS ─────────────────────────────────────────────────────── */}
      {tab==='rankings' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Keyword rankings" subtitle="Click row → competitors · 🏳️ flag → market compare · ⚡ quick wins filter"
            action={
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <SeoTriggerBtn mode="post" label="▶ Post tasks" variant="secondary" />
                <SeoTriggerBtn mode="fetch" label="⬇ Fetch" variant="secondary" />
              </div>
            }>
            {rankings.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📡</div>
                <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>No keywords for this market yet</div>
                <div style={{ fontSize:12, color:INK_M, marginBottom:16 }}>Switch to All to see all tracked keywords</div>
              </div>
            ) : (
              <>
                {!hasData && (
                  <div style={{ padding:'10px 14px', background:'#FFF8E1', border:'1px solid #C28F2C', borderRadius:5, marginBottom:10, fontSize:11, color:'#5A5A5A' }}>
                    No SERP data yet for this market — click <strong>▶ Post tasks</strong> above to fetch rankings from DataForSEO
                  </div>
                )}
                <RankingsTable
                  rankings={rankings as any}
                  history={history}
                  marketData={marketData}
                />
              </>
            )}
          </Container>
        </div>
      )}

      {/* ─── KEYWORDS ─────────────────────────────────────────────────────── */}
      {tab==='keywords' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Tracked keywords" subtitle="Volume · difficulty · CPC · all markets"
            action={
              <div style={{ display:'flex', gap:8 }}>
                <SeoTriggerBtn mode="volume" label="📊 Refresh volume" variant="secondary" />
                <SeoTriggerBtn mode="suggestions" label="💡 Get suggestions" variant="secondary" />
              </div>
            }>
            <div style={{ marginBottom:12, fontSize:11, color:INK_M }}>
              Volume data note: Laos keywords have very low/no Google Ads data — volume shows as — for niche markets. International keywords (DE/UK/US) will have volume data.
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead><tr style={{ borderBottom:`2px solid ${HAIR}` }}>
                  {['Keyword','Market','Volume/mo','Difficulty','CPC','Position'].map(h=>(
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rankings.map(r=>{
                    const kd=r.keyword_difficulty; const kdc=kd===null?INK_F:kd<=30?GREEN:kd<=60?AMBER:RED;
                    const kdLabel=kd===null?'—':kd<=30?'Easy':kd<=60?'Medium':'Hard';
                    return (
                      <tr key={r.keyword_id} style={{ borderBottom:`1px solid ${HAIR}` }}>
                        <td style={{ padding:'7px 8px', color:INK, fontStyle:'italic' }}>{r.keyword}</td>
                        <td style={{ padding:'7px 8px', color:INK_F, fontSize:11, whiteSpace:'nowrap' as const }}>{r.location_name}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                        <td style={{ padding:'7px 8px' }}>{kd!=null?<span style={{ color:kdc, fontSize:11, fontFamily:'ui-monospace,monospace', fontWeight:600 }}>{kd}% · {kdLabel}</span>:<span style={{ color:INK_F, fontSize:11 }}>—</span>}</td>
                        <td style={{ padding:'7px 8px', color:INK_F, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.cpc_usd!=null?`$${Number(r.cpc_usd).toFixed(2)}`:'—'}</td>
                        <td style={{ padding:'7px 8px' }}><span style={{ fontSize:10, fontFamily:'ui-monospace,monospace', color:r.position!=null?GREEN:INK_F, border:'1px solid', borderColor:r.position!=null?GREEN:HAIR, padding:'2px 6px', borderRadius:3 }}>{r.position!=null?`#${r.position}`:'not ranked'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </div>
      )}

      {/* ─── COMPETITORS ──────────────────────────────────────────────────── */}
      {tab==='competitors' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Competitor gap analysis" subtitle="Who ranks for keywords we don't · DataForSEO Domain Analytics"
            action={<SeoTriggerBtn mode="post" label="▶ Fetch competitor data" description="Requires DataForSEO Labs plan upgrade" />}>
            <div style={{ padding:'16px 0' }}>
              <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:12 }}>Tracked competitor domains</div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8, marginBottom:24 }}>
                {['booking.com','agoda.com','tripadvisor.com','expedia.com','rosewoodhotels.com','sofitel.com','belmond.com'].map(d=>(
                  <div key={d} style={{ fontSize:11, fontFamily:'ui-monospace,monospace', color:INK_M, border:`1px solid ${HAIR}`, padding:'4px 10px', borderRadius:4 }}>{d}</div>
                ))}
              </div>
              <div style={{ padding:'24px 16px', background:'#F9F6F0', borderRadius:6, marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:6 }}>API endpoint ready · DataForSEO Labs plan needed</div>
                <div style={{ fontSize:12, color:INK_M, lineHeight:1.6 }}>
                  Endpoint: <code style={{ fontFamily:'ui-monospace,monospace', fontSize:11 }}>/dataforseo_labs/google/competitors_domain/live</code><br/>
                  Will show: which keywords competitors rank for that we miss · overlap score · quick-win opportunities (position 4–10, high volume)
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Keywords we don&apos;t rank for yet (current gap)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {rankings.filter(r=>r.position===null).slice(0,10).map(r=>(
                  <div key={r.keyword_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'7px 10px', background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:5, fontSize:12 }}>
                    <span style={{ fontSize:16 }}>⚡</span>
                    <span style={{ flex:1, color:INK, fontStyle:'italic' }}>{r.keyword}</span>
                    <span style={{ color:INK_F, fontSize:10, fontFamily:'ui-monospace,monospace' }}>{r.location_name}</span>
                    <span style={{ color:INK_F, fontSize:11 }}>not in top 30</span>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </div>
      )}

      {/* ─── LOCAL PACK ───────────────────────────────────────────────────── */}
      {tab==='local' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Google Maps · Local pack" subtitle="thenamkhan.com position in local map results · Luang Prabang geo"
            action={<SeoTriggerBtn mode="local" label="🔄 Refresh local data" description="5 keywords · DataForSEO Maps API" />}>
            {localPack.length===0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🗺️</div>
                <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>No local pack data yet</div>
                <div style={{ fontSize:12, color:INK_M, marginBottom:16 }}>Click Refresh to fetch Google Maps results for hotel keywords</div>
                <SeoTriggerBtn mode="local" label="🗺️ Fetch local pack now" />
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {localPack.map((r,i)=>{
                  const pc=r.our_position===null?INK_F:r.our_position<=3?GREEN:r.our_position<=5?AMBER:RED;
                  return (
                    <div key={i} style={{ background:'#F9F6F0', borderRadius:6, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                        <span style={{ fontFamily:'ui-monospace,monospace', fontWeight:700, color:pc, fontSize:20, minWidth:36, textAlign:'center' as const }}>{r.our_position!=null?`#${r.our_position}`:'—'}</span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:INK, fontStyle:'italic' }}>{r.keyword}</div>
                          <div style={{ fontSize:11, color:INK_F }}>{r.result_count??0} results · {r.snapshot_date}</div>
                        </div>
                      </div>
                      {r.items&&(r.items as any[]).length>0&&(
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {(r.items as any[]).slice(0,3).map((it:any,j:number)=>(
                            <div key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:INK_M }}>
                              <span style={{ fontFamily:'ui-monospace,monospace', minWidth:16, color:INK_F }}>#{it.pos}</span>
                              <span style={{ flex:1 }}>{it.title}</span>
                              {it.rating&&<span style={{ color:AMBER }}>★ {it.rating}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Container>
        </div>
      )}

      {/* ─── TECHNICAL ────────────────────────────────────────────────────── */}
      {tab==='technical' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Technical SEO · On-page audit" subtitle="thenamkhan.com · meta, titles, Core Web Vitals, page scores"
            action={
              <SeoTriggerBtn mode="onpage" label="🔍 Run On-Page Crawl" description="Up to 50 pages · DataForSEO" />
            }>
            <div style={{ padding:'24px 16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginBottom:24 }}>
                {[
                  { icon:'📄', title:'Page titles', desc:'Length, duplicates, missing titles' },
                  { icon:'📝', title:'Meta descriptions', desc:'Length, quality, missing' },
                  { icon:'🔗', title:'Internal links', desc:'Broken links, orphan pages' },
                  { icon:'⚡', title:'Core Web Vitals', desc:'LCP, CLS, FID per page' },
                  { icon:'🖼️', title:'Image alt text', desc:'Missing alt attributes' },
                  { icon:'📱', title:'Mobile ready', desc:'Viewport, tap targets' },
                ].map((it,i)=>(
                  <div key={i} style={{ background:'#F9F6F0', borderRadius:6, padding:'12px 14px', display:'flex', gap:10 }}>
                    <span style={{ fontSize:20 }}>{it.icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:INK }}>{it.title}</div>
                      <div style={{ fontSize:11, color:INK_M }}>{it.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              {instantPages.length>0&&(
                <div style={{marginTop:8,display:'flex',flexDirection:'column' as const,gap:6}}>
                  <div style={{fontSize:10,fontWeight:600,color:INK_F,fontFamily:'ui-monospace,monospace',letterSpacing:'0.12em',textTransform:'uppercase' as const,marginBottom:4}}>{instantPages.length} pages audited — on-page keyword structure</div>
                  {instantPages.map((p,i)=>(
                    <div key={i} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'10px 14px'}}>
                      <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:4}}>
                        <div style={{flex:1}}>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:GREEN,textDecoration:'none',fontFamily:'ui-monospace,monospace'}}>{p.url}</a>
                          <div style={{fontSize:12,fontWeight:600,color:INK,marginTop:2}}>{p.page_title??'—'} <span style={{fontSize:10,color:p.title_length&&p.title_length>60?RED:p.title_length&&p.title_length<35?AMBER:GREEN,fontFamily:'ui-monospace,monospace'}}>({p.title_length} chars)</span></div>
                          {p.h1&&<div style={{fontSize:11,color:INK_M,marginTop:2}}><span style={{color:INK_F,fontFamily:'ui-monospace,monospace',fontSize:10,marginRight:4}}>H1</span>{p.h1}</div>}
                        </div>
                        <div style={{display:'flex',gap:3,flexWrap:'wrap' as const,maxWidth:180,justifyContent:'flex-end' as const}}>
                          {p.issues?.title_too_long&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:99,background:'#FEE2E2',color:RED}}>Title long</span>}
                          {p.issues?.title_too_short&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:99,background:'#FEF3C7',color:AMBER}}>Title short</span>}
                          {p.issues?.readability_low&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:99,background:'#FEF3C7',color:AMBER}}>Low readability</span>}
                          {p.issues?.thin_content&&<span style={{fontSize:9,padding:'1px 5px',borderRadius:99,background:'#FEF3C7',color:AMBER}}>Thin content</span>}
                        </div>
                      </div>
                      {p.h2s&&(p.h2s as string[]).length>0&&(
                        <div style={{display:'flex',flexWrap:'wrap' as const,gap:4,marginTop:4}}>
                          <span style={{fontSize:9,fontFamily:'ui-monospace,monospace',color:INK_F,marginRight:2}}>H2</span>
                          {(p.h2s as string[]).slice(0,5).map((h,j)=><span key={j} style={{fontSize:10,background:'#F4EFE2',padding:'2px 7px',borderRadius:4,color:INK_M}}>{h}</span>)}
                        </div>
                      )}
                      <div style={{fontSize:10,color:INK_F,fontFamily:'ui-monospace,monospace',marginTop:4}}>{p.word_count} words · Readability <span style={{color:p.readability&&p.readability>=60?GREEN:p.readability&&p.readability>=45?AMBER:RED}}>{p.readability?.toFixed(1)}</span> · {p.crawl_date}</div>
                    </div>
                  ))}
                </div>
              )}
              {instantPages.length===0&&onpageRows.length===0&&<div style={{padding:'16px 0',textAlign:'center' as const,color:INK_M,fontSize:13}}>Click <strong>Run On-Page Crawl</strong> above to start.</div>}
            </div>
          </Container>
        </div>
      )}

      {tab==='ai-visibility' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="AI Visibility · LLM Mentions" subtitle="thenamkhan.com presence in Google AI Overviews + ChatGPT"
            action={<SeoTriggerBtn mode="llm" label="🔄 Refresh AI data" description="DataForSEO LLM Mentions · live" />}>
            {!llmSnapshot||llmSnapshot.total_mentions===0?(
              <div style={{ padding:'32px 16px', textAlign:'center' as const, color:INK_M, fontSize:13 }}>No AI visibility data — click <strong>Refresh AI data</strong>.</div>
            ):(
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, marginBottom:16 }}>
                  {([[ 'Total AI mentions',String(llmSnapshot.total_mentions),GREEN],['AI search volume',Number(llmSnapshot.ai_search_volume).toLocaleString(),INK],['Google AI Overview',String(llmSnapshot.google_mentions),GREEN],['ChatGPT',String(llmSnapshot.chatgpt_mentions),INK]] as [string,string,string][]).map(([l,v,c],i)=>(
                    <div key={i} style={{ background:'#FFFFFF',border:`1px solid ${HAIR}`,borderRadius:6,padding:'10px 14px' }}>
                      <div style={{ fontSize:10,fontFamily:'ui-monospace,monospace',textTransform:'uppercase' as const,color:INK_F,marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:22,fontWeight:700,color:c,fontVariantNumeric:'tabular-nums' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {(llmSnapshot.sources_raw as Array<{key:string;mentions:number}>|null)?.length?(
                  <>
                    <div style={{ fontSize:12,fontWeight:600,color:INK,marginBottom:8 }}>Top domains in AI answers</div>
                    <div style={{ display:'flex',flexWrap:'wrap' as const,gap:6 }}>
                      {(llmSnapshot.sources_raw as Array<{key:string;mentions:number}>).slice(0,8).map((s,i)=>(
                        <div key={i} style={{ fontSize:11,fontFamily:'ui-monospace,monospace',border:`1px solid ${HAIR}`,padding:'3px 10px',borderRadius:4,color:INK_M }}>{s.key} · {s.mentions}↗</div>
                      ))}
                    </div>
                  </>
                ):null}
                {questionsRows.length>0&&(
                  <>
                    <div style={{fontSize:12,fontWeight:600,color:INK,marginTop:16,marginBottom:8}}>Questions triggering AI answers mentioning thenamkhan.com</div>
                    <div style={{display:'flex',flexWrap:'wrap' as const,gap:4}}>
                      {questionsRows.map((q,i)=>(<span key={i} style={{fontSize:11,border:'1px solid #E6DFCC',padding:'3px 10px',borderRadius:4,color:'#5A5A5A',background:'#F9F6F0'}}>{q.keyword}</span>))}
                    </div>
                  </>
                )}
                <div style={{ fontSize:10,color:INK_F,marginTop:12 }}>Last fetched: {llmSnapshot.snapshot_date} · {llmSnapshot.target}</div>
              </div>
            )}
          </Container>
        </div>
      )}

      {tab==='pages' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Ranked Pages" subtitle={`${pagesArr.length} pages · ${pagesRows.length} keywords in Google US top 50`}
            action={<SeoTriggerBtn mode="ranked" label="🔄 Refresh page rankings" description="DataForSEO Labs · domain full scan" />}>
            {pagesArr.length===0?(<div style={{padding:'32px 16px',textAlign:'center' as const,color:INK_M,fontSize:13}}>No page ranking data — click <strong>Refresh page rankings</strong>.</div>):(
              <div style={{overflowX:'auto' as const}}>
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                  <thead><tr style={{borderBottom:`2px solid ${HAIR}`}}>
                    {['Page','Keywords','Best pos','Vol/mo','Top keywords'].map(h=>(
                      <th key={h} style={{padding:'6px 8px',textAlign:'left' as const,fontSize:10,fontFamily:'ui-monospace,monospace',letterSpacing:'0.1em',textTransform:'uppercase' as const,color:INK_F}}>{h}</th>
                    ))}</tr></thead>
                  <tbody>{pagesArr.map((p,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                      <td style={{padding:'7px 8px',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}><a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:GREEN,fontSize:11,textDecoration:'none'}}>{p.url.replace(/^https?:\/\/[^/]+/,'')||'/'}</a></td>
                      <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace',fontSize:11}}>{p.count}</td>
                      <td style={{padding:'7px 8px'}}><span style={{fontFamily:'ui-monospace,monospace',fontWeight:700,fontSize:12,color:p.bestPos<=10?GREEN:p.bestPos<=20?AMBER:INK_F}}>#{p.bestPos}</span></td>
                      <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace',fontSize:11}}>{p.vol.toLocaleString()}</td>
                      <td style={{padding:'7px 8px',maxWidth:300,fontSize:11,color:INK_M}}>{p.top.map(k=>`${k.keyword} (#${k.position??'?'})`).join(' · ')}</td>
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
          <Container title="Hotel Data · Google Hotels" subtitle="Competitive positioning + pricing in Google Hotels results"
            action={<SeoTriggerBtn mode="hotel" label="🏨 Refresh hotel data" description="business_data/google/hotel_searches · live" />}>
            <div style={{padding:'24px 16px',textAlign:'center' as const,color:INK_M,fontSize:13}}>
              {hotelRows.length>0?(
                <div style={{overflowX:'auto' as const,marginTop:8}}>
                  <div style={{fontSize:11,color:'#5A5A5A',marginBottom:8}}>Showing results for: <strong>{hotelRows[0]?.search_keyword}</strong> · Google Hotels US market</div>
                  <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                    <thead><tr style={{borderBottom:'2px solid #E6DFCC'}}>{['#','Hotel','Stars','Rating','Reviews','Price/night'].map(h=>(<th key={h} style={{padding:'6px 8px',textAlign:'left' as const,fontSize:10,fontFamily:'ui-monospace,monospace',textTransform:'uppercase' as const,color:'#8A8A8A'}}>{h}</th>))}</tr></thead>
                    <tbody>{hotelRows.map((h,i)=>(<tr key={i} style={{borderBottom:'1px solid #E6DFCC'}}>
                      <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace',color:'#8A8A8A'}}>{h.position}</td>
                      <td style={{padding:'7px 8px',fontWeight:600}}>{h.hotel_title}</td>
                      <td style={{padding:'7px 8px',color:'#8A8A8A'}}>{h.stars??'—'}</td>
                      <td style={{padding:'7px 8px',color:'#084838',fontWeight:600}}>{h.rating_value??'—'}</td>
                      <td style={{padding:'7px 8px',color:'#8A8A8A'}}>{h.votes_count??'—'}</td>
                      <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace'}}>{h.price_usd?`$${h.price_usd}`:'—'}</td>
                    </tr>))}</tbody>
                  </table>
                </div>
              ):(<span>Note: Google Hotels does not index Luang Prabang boutique hotels. Click <strong>Refresh hotel data</strong> to load competitive eco-resort data from global market.</span>)}
            </div>
          </Container>
        </div>
      )}

    </DashboardPage>
  );
}
