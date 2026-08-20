// app/marketing/seo/page.tsx
// Full 11-tab SEO area — DataForSEO pipeline + multi-market ranking
// Markets: Laos (home) · Germany · UK · US · France · Australia
import { DashboardPage, Container, type DashboardTab, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MARKETING_SUBPAGES } from '@/app/marketing/_subpages';
import SeoTriggerBtn from '@/components/seo/SeoTriggerBtn';
import RankingsTable, { type RankRow as RankRowFull, type HistoryRow, type MarketRow } from '@/components/seo/RankingsTable';
import SeoKeywordsManager from '@/components/seo/SeoKeywordsManager';
import SeoLlmResponseCard from '@/components/seo/SeoLlmResponseCard';
import SeoResearchBar from '@/components/seo/SeoResearchBar';

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

/** Per-tab context text shown beneath the sub-tab strip */
const tabContext = (locCity: string): Record<string, string> => ({
  overview:     'Rankings summary across all markets · Data from DataForSEO SERP tracking + your tracked keyword list',
  rankings:     'Google search positions per keyword + market · Updated by clicking ▶ Post tasks then ⬇ Fetch results',
  keywords:     'Your tracked keyword list · Add / dismiss keywords here to control what gets tracked across all tabs',
  research:     'Longtail keyword ideas from DataForSEO Labs + Google Trends 12-month interest · Enter a seed keyword or use your top 3 tracked keywords',
  backlinks:    'Link profile from DataForSEO · Authority score, referring domains, top linking pages',
  competitors:  "Real hotel competitors from your compset database · Gap shows keywords you don't rank for yet",
  local:        `Google Maps local pack positions for hotel keywords in ${locCity || 'your market'} · Data from DataForSEO Maps API`,
  technical:    'Per-page on-page audit · Schema health, titles, readability from DataForSEO instant_pages crawler',
  pages:        'Pages ranking in Google top 50 · From DataForSEO ranked_keywords + unranked pages from site audit',
  hotel:        'Google Business Profile for this property · Rating, reviews, info from Google via DataForSEO GBP API',
  'ai-web':     'AI search visibility across Google AI Overviews and ChatGPT · From DataForSEO LLM Mentions API',
});

export default async function MarketingSeoPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: { tab?: string; loc?: string; sub?: string };
}) {
  const tab = searchParams?.tab ?? 'overview';
  const locFilter = searchParams?.loc ?? 'all';
  const aiSub = searchParams?.sub ?? 'visibility';
  const overviewSub = searchParams?.sub ?? 'kpis';
  const locCode = MARKETS.find(m => m.code === locFilter)?.loc ?? null;

  const sb = getSupabaseAdmin();
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    return <div style={{padding:24,color:'#B03826'}}>Invalid property_id</div>;
  }
  const { data: propCfg } = await sb.from('v_seo_property_config').select('domain,hotel_search_kw,hotel_location_code,hotel_location_name,currency').eq('property_id', propertyId).maybeSingle();
  const propertyDomain = (propCfg as any)?.domain ?? '';
  const propertyLocFull = (propCfg as any)?.hotel_location_name ?? '';
  const propertyLocCity = propertyLocFull.split(',')[0].trim();
  const propertyLocCountry = propertyLocFull.split(',').pop()?.trim() ?? '';
  const propertyHotelKw = (propCfg as any)?.hotel_search_kw ?? '';
  const propertyLocCode = Number((propCfg as any)?.hotel_location_code) || 0;
  const tabCtx = tabContext(propertyLocCity);
  // R4: v_seo_ranking_history and v_seo_market_comparison carry no property_id column.
  // Scope them by this property's keyword_ids (from the property-filtered rankings view).
  const propKeywordIds: number[] = tab === 'rankings'
    ? (((await sb.from('v_seo_rankings').select('keyword_id').eq('property_id', propertyId)).data ?? []) as Array<{keyword_id:number}>).map(r => r.keyword_id).filter(Boolean)
    : [];
  const hasPropKeywords = propKeywordIds.length > 0;
  const [rankRes, localRes, historyRes, marketRes, onpageRes, llmRes, pagesRes, instantRes, questionsRes, hotelRes, mentionsRes, aiIntelRes, llmRespRes, competitorRes, researchRes, blSumRes, blRes, overlapRes, trendsRes] = await Promise.all([
    sb.from('v_seo_rankings').select('*').eq('property_id',propertyId),
    tab === 'local' ? sb.from('v_seo_local_pack').select('*').eq('property_id',propertyId).order('snapshot_date', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    tab === 'rankings' && hasPropKeywords ? sb.from('v_seo_ranking_history').select('keyword_id,keyword,location_name,location_code,snapshot_date,position,serp_features').in('keyword_id', propKeywordIds).limit(500) : Promise.resolve({ data: [] }),
    tab === 'rankings' && hasPropKeywords ? sb.from('v_seo_market_comparison').select('*').in('keyword_id', propKeywordIds) : Promise.resolve({ data: [] }),
    tab === 'technical' ? sb.from('v_seo_onpage').select('*').eq('property_id',propertyId).order('page_score', { ascending: true }).limit(50) : Promise.resolve({ data: [] }),
    tab === 'ai-web' ? sb.from('v_seo_llm_snapshots').select('*').eq('property_id', propertyId).order('snapshot_date', { ascending: false }).limit(1) : Promise.resolve({ data: [] }),
    tab === 'pages' ? sb.from('v_seo_ranked_pages').select('url,keyword,position,volume,search_intent').eq('property_id', propertyId).order('position', { ascending: true }).limit(500) : Promise.resolve({ data: [] }),
    (tab === 'technical' || tab === 'ai-web' || tab === 'pages') ? sb.from('v_seo_instant_pages').select('url,page_title,title_length,h1,h2s,word_count,readability,issues,crawl_date').eq('property_id', propertyId).order('crawl_date', { ascending: false }) : Promise.resolve({ data: [] }),
    tab === 'ai-web' ? sb.from('v_seo_llm_questions').select('keyword,llm,mention_date').eq('property_id', propertyId).order('id', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    tab === 'hotel' ? sb.from('v_seo_hotel_searches').select('position,hotel_title,stars,price_usd,rating_value,votes_count,search_keyword,is_our_property').eq('property_id', propertyId).order('snapshot_date', { ascending: false }).order('position').limit(20) : Promise.resolve({ data: [] }),
    tab === 'ai-web' ? sb.from('v_seo_llm_mentions').select('keyword,llm,snippet,mention_date').eq('property_id', propertyId).order('id', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
    tab === 'ai-web' ? sb.from('v_seo_ai_intel').select('intel_type,target_keyword,item_name,mentions,ai_search_volume').eq('property_id',propertyId).order('mentions',{ascending:false}).limit(30) : Promise.resolve({ data: [] }),
    tab === 'ai-web' ? sb.from('v_seo_llm_responses').select('prompt,response_text,our_domain_mentioned,platform,model,fetched_at').eq('property_id',propertyId).order('fetched_at',{ascending:false}).limit(20) : Promise.resolve({ data: [] }),
    tab === 'competitors' ? sb.from('v_seo_competitors').select('id,domain,label,active').eq('property_id',propertyId).order('active',{ascending:false}) : Promise.resolve({ data: [] }),
    tab === 'research' ? sb.from('v_seo_keyword_suggestions').select('*').eq('property_id',propertyId).order('monthly_searches',{ascending:false}).limit(200) : Promise.resolve({ data: [] }),
    tab === 'backlinks' ? sb.from('v_seo_backlinks_summary').select('*').eq('property_id',propertyId).order('fetched_at',{ascending:false}).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    tab === 'backlinks' ? sb.from('v_seo_backlinks').select('*').eq('property_id',propertyId).order('rank',{ascending:false}).limit(50) : Promise.resolve({ data: [] }),
    tab === 'competitors' ? sb.from('v_seo_competitor_overlap').select('*').eq('property_id',propertyId).order('competitor_position',{ascending:true}).limit(100) : Promise.resolve({ data: [] }),
    tab === 'research' ? sb.from('v_seo_trends').select('keyword,avg_interest,peak_month,interest_timeline,fetched_at').eq('property_id',propertyId).order('avg_interest',{ascending:false}).limit(10) : Promise.resolve({ data: [] }),
  ]);

  const allRankings = (rankRes.data ?? []) as RankRow[];
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
  const mentionsRows=(mentionsRes.data??[]) as Array<{keyword:string;llm:string;snippet:string|null;mention_date:string}>;
  type AiIntelRow={intel_type:string;target_keyword:string;item_name:string;mentions:number;ai_search_volume:number};
  type LlmRespRow={prompt:string;response_text:string|null;our_domain_mentioned:boolean;platform:string;model?:string|null;fetched_at:string};
  type CompRow={id:number;domain:string;label:string;active:boolean};
  const competitorRows=(competitorRes.data??[]) as CompRow[];
  type OverlapRow={competitor_domain:string;keyword:string;our_position:number|null;competitor_position:number;volume:number|null;location_code:number};
  const overlapRows=(overlapRes.data??[]) as OverlapRow[];
  type TrendRow={keyword:string;avg_interest:number|null;peak_month:string|null;interest_timeline:Array<{date:string;val:number}>|null;fetched_at:string};
  const trendsRows=(trendsRes.data??[]) as TrendRow[];
  type ResRow={id:string;seed_keyword:string;keyword:string;monthly_searches:number|null;keyword_difficulty:number|null;cpc_usd:number|null;competition:number|null;location_code:number;fetched_at?:string};
  const researchRows=(researchRes.data??[]) as ResRow[];
  type BlSumRow={total_backlinks:number;referring_domains:number;authority_score:number;dofollow_links:number;nofollow_links:number;fetched_at:string};
  const blSum=blSumRes.data as BlSumRow|null;
  type BlRow={url_from:string;domain_from:string;anchor:string|null;is_dofollow:boolean;rank:number|null;domain_from_rank:number|null;first_seen:string|null};
  const blRows=(blRes.data??[]) as BlRow[];
  const aiIntelRows=(aiIntelRes.data??[]) as AiIntelRow[];
  const llmRespRows=(llmRespRes.data??[]) as LlmRespRow[];
  const domainIntel=aiIntelRows.filter(r=>r.intel_type==='domain');
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

  const researchLastFetched = researchRows.length > 0
    ? ((researchRows[0] as any).fetched_at ?? (researchRows[0] as any).created_at ?? null)
    : null;

  const llmByPlatform = llmRespRows.reduce<Record<string, LlmRespRow[]>>((acc, r) => {
    const key = r.platform ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  const llmPlatforms = Object.keys(llmByPlatform).sort();

  const marketingTabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/seo',
  }));

  const SEO_TABS = [
    { key:'overview',   label:'Overview'   },{ key:'rankings',   label:'Rankings'   },
    { key:'keywords',   label:'Keywords'   },{ key:'competitors',label:'Competitors' },
    { key:'local',      label:'Local Pack' },{ key:'technical',  label:'Technical'  },{ key:'pages', label:'Pages' },{ key:'research', label:'Research' },{ key:'backlinks', label:'Backlinks' },{ key:'hotel', label:'Hotel Data' },{ key:'ai-web', label:'AI Intel' },
  ];

  const btnSt: React.CSSProperties = { padding:'3px 10px', fontSize:11, border:`1px solid ${HAIR}`, borderRadius:3, background:'#FAFAF7', cursor:'pointer', textDecoration:'none', color:INK_M, whiteSpace:'nowrap' };
  const btnActiveSt: React.CSSProperties = { ...btnSt, background:GREEN, color:'#fff', borderColor:GREEN };

  return (
    <DashboardPage title="Marketing · SEO" subtitle={`SERP rank tracker · ${allRankings.length} keywords · AI visibility`} tabs={marketingTabs}>

      {/* SEO sub-tabs */}
      <div style={{ gridColumn:'1/-1', display:'flex', gap:0, borderBottom:`2px solid ${HAIR}`, marginBottom:0 }}>
        {SEO_TABS.map(t=>(
          <a key={t.key} href={`?tab=${t.key}&loc=${locFilter}`}
            style={{ padding:'8px 16px', fontSize:12, fontWeight:600, textDecoration:'none',
              color:tab===t.key?GREEN:INK_M, borderBottom:tab===t.key?`2px solid ${GREEN}`:'2px solid transparent',
              marginBottom:-2, whiteSpace:'nowrap' as const }}>{t.label}</a>
        ))}
      </div>

      {/* Tab context text */}
      {tabCtx[tab] && (
        <div style={{ gridColumn:'1/-1', fontSize:11, color:INK_F, padding:'6px 2px 8px', lineHeight:1.5 }}>
          {tabCtx[tab]}
        </div>
      )}

      {/* Market filter */}
      {['overview','rankings','keywords'].includes(tab) && <div style={{ gridColumn:'1/-1', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' as const }}>
        <span style={{ fontSize:10, color:INK_F, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const }}>Market</span>
        {MARKETS.map(m=>(
          <a key={m.code} href={`?tab=${tab}&loc=${m.code}`} style={locFilter===m.code?btnActiveSt:btnSt}>
            {m.label}
          </a>
        ))}
        <span style={{ marginLeft:8, fontSize:11, color:INK_F }}>
          {rankings.length} keywords · {withPos.length} ranked
        </span>
      </div>}

      {/* ─── OVERVIEW ─────────────────────────────────────────────────────── */}
      {tab==='overview' && (
        <>
          {/* Sub-substripe — split scroll-heavy Overview into focused subtabs */}
          <div style={{ gridColumn:'1/-1', display:'flex', gap:4, borderBottom:`1px solid ${HAIR}`, paddingBottom:6, marginBottom:2 }}>
            {([
              { key:'kpis',    label:'KPIs' },
              { key:'markets', label:'Markets' },
              { key:'movers',  label:'Movers' },
            ] as Array<{key:string;label:string}>).map(s=>(
              <a key={s.key} href={`?tab=overview&loc=${locFilter}&sub=${s.key}`}
                style={{ padding:'5px 12px', fontSize:11, fontWeight:600, borderRadius:4, textDecoration:'none',
                  color:overviewSub===s.key?'#fff':INK_M, background:overviewSub===s.key?GREEN:'#FAFAF7',
                  border:`1px solid ${overviewSub===s.key?GREEN:HAIR}` }}>{s.label}</a>
            ))}
          </div>

          {overviewSub==='kpis' && (<>
          <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8 }}>
            {([
              { l:'Keywords', v:allRankings.length, sub:'All markets', col:INK },
              { l:'Ranked', v:withPos.length, sub:'Any position', col:withPos.length>0?GREEN:INK_F },
              { l:'Top 3', v:top3.length, sub:'Google desktop', col:top3.length>0?GREEN:INK_F },
              { l:'Top 10', v:top10.length, sub:'Google desktop', col:top10.length>0?GREEN:INK_F },
              { l:'Avg position', v:avgPos??'—', sub:withPos.length+' ranked kws', col:INK },
              { l:'Quick wins', v:allRankings.filter(r=>r.position!==null&&(r.position??99)>10&&(r.position??99)<=30).length, sub:'Positions 11–30', col:AMBER },
              { l:'Not ranking', v:allRankings.length-withPos.length, sub:'Below pos 30', col:(allRankings.length-withPos.length)>15?RED:INK_F },
              { l:'Last synced', v:lastSync?lastSync.slice(0,10):'—', sub:'SERP data', col:INK_F },
            ] as Array<{l:string;v:string|number;sub:string;col:string}>).map((k,i)=>(
              <div key={i} style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:INK_F, marginBottom:4 }}>{k.l}</div>
                <div style={{ fontSize:22, fontWeight:700, color:k.col, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{String(k.v)}</div>
                <div style={{ fontSize:10, color:INK_F, marginTop:3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          </>)}

          {overviewSub==='markets' && (
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:10, fontWeight:600, color:INK_F, fontFamily:'ui-monospace,monospace', letterSpacing:'0.12em', textTransform:'uppercase' as const, marginBottom:8 }}>Market breakdown</div>
            <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
              <thead><tr style={{ borderBottom:`2px solid ${HAIR}` }}>
                {['Market','Tracked','Ranked','Top 3','Top 10','Avg Pos'].map(h=>(
                  <th key={h} style={{ padding:'5px 8px', textAlign:'left' as const, fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.08em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {MARKETS.filter(m=>m.loc!==null).map(m=>{
                  const mr=allRankings.filter(r=>(r as any).location_code===m.loc);
                  if(!mr.length)return null;
                  const mwp=mr.filter(r=>r.position!==null);
                  const mt3=mwp.filter(r=>(r.position??99)<=3).length;
                  const mt10=mwp.filter(r=>(r.position??99)<=10).length;
                  const mavg=mwp.length>0?Math.round(mwp.reduce((s,r)=>s+(r.position??0),0)/mwp.length):null;
                  return(
                    <tr key={m.code} style={{ borderBottom:`1px solid ${HAIR}` }}>
                      <td style={{ padding:'6px 8px', fontWeight:600, color:INK }}>{m.label}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', color:INK_F }}>{mr.length}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', color:mwp.length>0?INK:INK_F }}>{mwp.length}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', color:mt3>0?GREEN:INK_F, fontWeight:mt3>0?700:400 }}>{mt3}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', color:mt10>0?GREEN:INK_F }}>{mt10}</td>
                      <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', color:mavg!==null&&mavg<=10?GREEN:mavg!==null&&mavg<=20?AMBER:INK_F }}>{mavg??'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}

          {overviewSub==='movers' && (
          <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:INK_F, fontFamily:'ui-monospace,monospace', letterSpacing:'0.12em', textTransform:'uppercase' as const, marginBottom:8 }}>Best ranked keywords</div>
              <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:11 }}>
                <thead><tr style={{ borderBottom:`1px solid ${HAIR}` }}>
                  {['Keyword','Market','Pos','Δ'].map(h=><th key={h} style={{ padding:'4px 6px', textAlign:'left' as const, fontSize:10, color:INK_F, fontWeight:600 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {[...withPos].sort((a,b)=>(a.position??99)-(b.position??99)).slice(0,10).map((r,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${HAIR}` }}>
                      <td style={{ padding:'5px 6px', color:INK, fontStyle:'italic', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.keyword}</td>
                      <td style={{ padding:'5px 6px', color:INK_F, fontSize:10 }}>{(r.location_name??'').split(',')[0]}</td>
                      <td style={{ padding:'5px 6px', fontFamily:'ui-monospace,monospace', fontWeight:700, color:(r.position??99)<=3?GREEN:(r.position??99)<=10?INK:AMBER }}>{'#'+(r.position??'?')}</td>
                      <td style={{ padding:'5px 6px', fontSize:10, color:r.delta&&r.delta>0?GREEN:r.delta&&r.delta<0?RED:INK_F }}>{r.delta?r.delta>0?('+'+r.delta):String(r.delta):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:600, color:INK_F, fontFamily:'ui-monospace,monospace', letterSpacing:'0.12em', textTransform:'uppercase' as const, marginBottom:8 }}>Quick wins (pos 11–30)</div>
              {withPos.filter(r=>(r.position??99)>10&&(r.position??99)<=30).length===0?(
                <div style={{ fontSize:12, color:INK_F, padding:'16px 0' }}>No quick wins yet — keep building content and backlinks.</div>
              ):(
                <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:11 }}>
                  <thead><tr style={{ borderBottom:`1px solid ${HAIR}` }}>
                    {['Keyword','Market','Pos','Vol/mo'].map(h=><th key={h} style={{ padding:'4px 6px', textAlign:'left' as const, fontSize:10, color:INK_F, fontWeight:600 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {withPos.filter(r=>(r.position??99)>10&&(r.position??99)<=30).sort((a,b)=>((b.monthly_searches??0)-(a.monthly_searches??0))||((a.position??99)-(b.position??99))).slice(0,8).map((r,i)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${HAIR}` }}>
                        <td style={{ padding:'5px 6px', color:INK, fontStyle:'italic', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{r.keyword}</td>
                        <td style={{ padding:'5px 6px', color:INK_F, fontSize:10 }}>{(r.location_name??'').split(',')[0]}</td>
                        <td style={{ padding:'5px 6px', fontFamily:'ui-monospace,monospace', color:AMBER }}>{'#'+(r.position??'?')}</td>
                        <td style={{ padding:'5px 6px', color:INK_F, fontFamily:'ui-monospace,monospace', fontSize:10 }}>{r.monthly_searches?.toLocaleString()??'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          )}

          {/* SERP sync CTA — visible on all Overview subtabs */}
          <div style={{ gridColumn:'1/-1', display:'flex', gap:8, alignItems:'center', padding:'10px 14px', background:'#F4EFE2', borderRadius:6 }}>
            <span style={{ fontSize:11, fontWeight:600, color:INK, marginRight:4 }}>SERP sync</span>
            <SeoTriggerBtn propertyId={propertyId} mode="post" label="▶ Post tasks" variant="secondary" />
            <SeoTriggerBtn propertyId={propertyId} mode="fetch" label="⬇ Fetch results" variant="secondary" />
            <SeoTriggerBtn propertyId={propertyId} mode="volume" label="📊 Volume" variant="secondary" />
            <span style={{ marginLeft:'auto', fontSize:11, color:INK_F }}>Last: {lastSync?lastSync.slice(0,10):'never'}</span>
          </div>
        </>
      )}

      {/* ─── RANKINGS ─────────────────────────────────────────────────────── */}
      {tab==='rankings' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Keyword rankings" subtitle="Click row → competitors · 🏳️ flag → market compare · ⚡ quick wins filter"
            action={
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <SeoTriggerBtn propertyId={propertyId} mode="post" label="▶ Post tasks" variant="secondary" />
                <SeoTriggerBtn propertyId={propertyId} mode="fetch" label="⬇ Fetch" variant="secondary" />
              </div>
            }>
            {/* Step-by-step guide */}
            <div style={{ padding:'10px 14px', background:'#F4EFE2', border:`1px solid ${HAIR}`, borderRadius:5, marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:INK, marginBottom:6 }}>How to get ranking data</div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' as const }}>
                {([
                  { n:'1', t:'Post SERP tasks', d:'Click ▶ Post tasks — queues all keywords in DataForSEO (takes seconds).' },
                  { n:'2', t:'Wait up to 1 hour', d:'DataForSEO crawls Google SERP. Most results are ready within 1 hour.' },
                  { n:'3', t:'Fetch results', d:'Click ⬇ Fetch — pulls completed tasks and writes positions to DB.' },
                ] as Array<{n:string;t:string;d:string}>).map(s=>(
                  <div key={s.n} style={{ display:'flex', gap:6, flex:'1 1 180px', minWidth:160 }}>
                    <span style={{ fontSize:16, fontWeight:900, color:GREEN, fontFamily:'ui-monospace,monospace', minWidth:18 }}>{s.n}</span>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:INK }}>{s.t}</div>
                      <div style={{ fontSize:11, color:INK_M }}>{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                <SeoTriggerBtn propertyId={propertyId} mode="volume" label="📊 Refresh volume" variant="secondary" />
                <SeoTriggerBtn propertyId={propertyId} mode="suggestions" label="💡 Get suggestions" variant="secondary" />
              </div>
            }>
<SeoKeywordsManager initialKeywords={rankings as any} propertyId={propertyId} />
          </Container>
        </div>
      )}

      {/* ─── COMPETITORS ──────────────────────────────────────────────────── */}
      {tab==='competitors' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Competitor gap analysis" subtitle="Who ranks for keywords we don't · DataForSEO Domain Analytics"
            action={<SeoTriggerBtn propertyId={propertyId} mode="competitors" label="▶ Fetch competitor data" description="DataForSEO Labs · keyword overlap" />}>
            <div style={{ padding:'16px 0' }}>
              <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:12 }}>Tracked competitor domains</div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8, marginBottom:24 }}>
                {competitorRows.filter(c=>c.active).map(c=>(
                  <div key={c.id} style={{ fontSize:11, fontFamily:'ui-monospace,monospace', color:INK_M, border:`1px solid ${HAIR}`, padding:'4px 10px', borderRadius:4 }}>
                    <span style={{fontWeight:600,color:INK}}>{c.label}</span>
                    <span style={{color:INK_F,marginLeft:6,fontSize:10}}>{c.domain}</span>
                  </div>
                ))}
                {competitorRows.filter(c=>!c.active).length>0&&(
                  <div style={{fontSize:10,color:INK_F,marginTop:4}}>+ {competitorRows.filter(c=>!c.active).length} inactive: {competitorRows.filter(c=>!c.active).map(c=>c.domain).join(', ')}</div>
                )}
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

              {/* Keyword overlap with competitors */}
              {overlapRows.length > 0 && (
                <div style={{ marginTop:28 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:4 }}>Keyword overlap — both this property and competitors rank for these</div>
                  <div style={{ fontSize:11, color:INK_F, marginBottom:10 }}>Outranked by competitors on these keywords — best opportunities to improve content or build backlinks.</div>
                  <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
                    <thead><tr style={{ borderBottom:`2px solid ${HAIR}` }}>
                      {['Competitor','Keyword','Their rank','Our rank','Vol/mo'].map(h=>(
                        <th key={h} style={{ padding:'5px 8px', textAlign:'left' as const, fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.08em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {overlapRows.slice(0,30).map((r,i)=>(
                        <tr key={i} style={{ borderBottom:`1px solid ${HAIR}` }}>
                          <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', fontSize:11, color:INK_F }}>{r.competitor_domain}</td>
                          <td style={{ padding:'6px 8px', color:INK, fontStyle:'italic' }}>{r.keyword}</td>
                          <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', fontWeight:700, color:r.competitor_position<=3?GREEN:r.competitor_position<=10?INK:INK_F }}>#{r.competitor_position}</td>
                          <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', color:r.our_position===null?RED:r.our_position<=3?GREEN:r.our_position<=10?INK:INK_F }}>{r.our_position===null?'—':'#'+r.our_position}</td>
                          <td style={{ padding:'6px 8px', fontFamily:'ui-monospace,monospace', fontSize:11, color:INK_F }}>{r.volume?.toLocaleString()??'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {overlapRows.length === 0 && (
                <div style={{ marginTop:20, padding:'12px 14px', background:'#F9F6F0', border:`1px solid ${HAIR}`, borderRadius:5, fontSize:12, color:INK_M }}>
                  No keyword overlap data yet — click <strong>▶ Fetch competitor data</strong> above to run the DataForSEO domain intersection analysis.
                </div>
              )}
            </div>
          </Container>
        </div>
      )}

      {/* ─── LOCAL PACK ───────────────────────────────────────────────────── */}
      {tab==='local' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Google Maps · Local pack" subtitle={`${propertyDomain} position in local map results · ${propertyLocCity} geo`}
            action={<SeoTriggerBtn propertyId={propertyId} mode="local" label="🔄 Refresh local data" description="5 keywords · DataForSEO Maps API" />}>
            {localPack.length===0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🗺️</div>
                <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>No local pack data yet</div>
                <div style={{ fontSize:12, color:INK_M, marginBottom:16 }}>Click Refresh to fetch Google Maps results for hotel keywords</div>
                <SeoTriggerBtn propertyId={propertyId} mode="local" label="🗺️ Fetch local pack now" />
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
          <Container title="Technical SEO · On-page audit" subtitle={`${propertyDomain} · meta, titles, Core Web Vitals, page scores`}
            action={
              <SeoTriggerBtn propertyId={propertyId} mode="onpage" label="🔍 Run On-Page Crawl" description="Up to 50 pages · DataForSEO" />
            }>
            <div style={{ padding:'16px 0' }}>
              {instantPages.length===0&&(
                <div style={{ padding:'32px 16px', textAlign:'center' as const, color:INK_M, fontSize:13 }}>
                  Click <strong>Run On-Page Crawl</strong> to audit all pages from ${propertyDomain} sitemap.
                </div>
              )}
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
            </div>
          </Container>
        </div>
      )}

      {tab==='pages' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Ranked Pages" subtitle={`${pagesArr.length} pages · ${pagesRows.length} keywords in Google top 50 · all markets`}
            action={<SeoTriggerBtn propertyId={propertyId} mode="ranked" label="🔄 Refresh page rankings" description="DataForSEO Labs · 6 markets" />}>
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

          {tab==='pages' && instantPages.length>0 && (()=>{
            const ranked=new Set(pagesArr.map((a:any)=>a.url));
            const unranked=instantPages.filter((p:any)=>!ranked.has(p.url));
            if(!unranked.length)return null;
            return(
              <div style={{marginTop:20}}>
                <div style={{fontSize:10,fontWeight:600,color:INK_F,fontFamily:'ui-monospace,monospace',letterSpacing:'0.12em',textTransform:'uppercase' as const,marginBottom:8}}>
                  {unranked.length} key pages — not yet ranking in Google top 50
                </div>
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                  <thead><tr style={{borderBottom:`2px solid ${HAIR}`}}>
                    {['Path','Title','Words','Schema'].map(h=>(<th key={h} style={{padding:'4px 8px',textAlign:'left' as const,fontSize:10,color:INK_F,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {unranked.map((p:any,i:number)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                        <td style={{padding:'5px 8px',fontFamily:'ui-monospace,monospace',fontSize:11,color:GREEN}}>{(p.url as string).replace(`https://${propertyDomain}`,'').replace(`https://www.${propertyDomain}`,'')}</td>
                        <td style={{padding:'5px 8px',color:INK,fontSize:11}}>{p.page_title??'—'}</td>
                        <td style={{padding:'5px 8px',fontFamily:'ui-monospace,monospace',fontSize:11,color:INK_F}}>{p.word_count??'—'}</td>
                        <td style={{padding:'5px 8px'}}>
                          <span style={{fontSize:10,padding:'1px 7px',borderRadius:99,background:p.issues?.schema_missing?'#FEE2E2':'#E6F4EA',color:p.issues?.schema_missing?RED:GREEN,fontWeight:600}}>
                            {p.issues?.schema_missing?'❌ Missing':'✅ Present'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{fontSize:10,color:AMBER,marginTop:8}}>
                  These pages need SEO content, backlinks, and keyword targeting to rank. Run On-Page Crawl in the Technical tab to audit more pages.
                </div>
              </div>
            );
          })()}
          </Container>
        </div>
      )}

      {tab==='research' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Keyword Research" subtitle="Longtail keyword ideas + Google Trends — save to tracking for blog + web team">
            <SeoResearchBar
              propertyId={propertyId}
              resultCount={researchRows.length}
              lastFetched={researchLastFetched ? String(researchLastFetched).slice(0, 10) : null}
            />
            {researchRows.length===0 ? (
              <div style={{padding:'24px 16px',textAlign:'center' as const,color:INK_M,fontSize:13}}>
                No research data — enter a seed keyword above and click <strong>🔍 Research keywords</strong> to discover longtail opportunities.
              </div>
            ) : (
              <div>
                <div style={{overflowX:'auto' as const}}>
                  <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                    <thead><tr style={{borderBottom:`2px solid ${HAIR}`}}>
                      {['Keyword','Seed','Vol/mo','Difficulty','CPC','Comp.',''].map(h=>(
                        <th key={h} style={{padding:'6px 8px',textAlign:'left' as const,fontSize:10,fontFamily:'ui-monospace,monospace',letterSpacing:'0.1em',textTransform:'uppercase' as const,color:INK_F,fontWeight:600}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {researchRows.map((r,i)=>{
                        const kd=r.keyword_difficulty; const kdc=kd===null?INK_F:kd<=30?GREEN:kd<=60?AMBER:RED;
                        return (
                          <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                            <td style={{padding:'7px 8px',color:INK,fontStyle:'italic'}}>{r.keyword}</td>
                            <td style={{padding:'7px 8px',color:INK_F,fontSize:10}}>{r.seed_keyword}</td>
                            <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace',fontSize:11}}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                            <td style={{padding:'7px 8px'}}>{kd!=null?<span style={{color:kdc,fontSize:11,fontFamily:'ui-monospace,monospace',fontWeight:600}}>{kd}% {kd<=30?'Easy':kd<=60?'Med':'Hard'}</span>:<span style={{color:INK_F,fontSize:11}}>—</span>}</td>
                            <td style={{padding:'7px 8px',color:INK_F,fontFamily:'ui-monospace,monospace',fontSize:11}}>{r.cpc_usd!=null?'$'+Number(r.cpc_usd).toFixed(2):'—'}</td>
                            <td style={{padding:'7px 8px',color:INK_F,fontSize:11}}>{r.competition!=null?(r.competition*100).toFixed(0)+'%':'—'}</td>
                            <td style={{padding:'7px 8px'}}>
                              <a href={`/marketing/seo?tab=keywords`} style={{fontSize:10,padding:'2px 8px',border:`1px solid ${GREEN}`,borderRadius:3,color:GREEN,textDecoration:'none',whiteSpace:'nowrap' as const}}>+ Add</a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{marginTop:10,fontSize:11,color:INK_M,padding:'8px 12px',background:'#F4EFE2',borderRadius:5}}>
                  💡 Sort by difficulty ≤30 (Easy) + volume &gt;100 for quick-win blog topics. Save to Keywords tab, then post SERP tasks to track rankings.
                </div>
              </div>
            )}

            {/* Google Trends section */}
            <div style={{marginTop:24,paddingTop:20,borderTop:`1px solid ${HAIR}`}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:600,color:INK}}>Google Trends — Search interest over time</div>
                <SeoTriggerBtn propertyId={propertyId} mode="trends" label="📈 Fetch Trends" description="DataForSEO Google Trends · top 5 keywords" variant="secondary" />
                {trendsRows.length>0&&<span style={{fontSize:10,color:INK_F,fontFamily:'ui-monospace,monospace'}}>Updated: {trendsRows[0]?.fetched_at?.slice(0,10)}</span>}
              </div>
              {trendsRows.length===0?(
                <div style={{fontSize:12,color:INK_M,padding:'16px 0'}}>
                  No trend data — click <strong>📈 Fetch Trends</strong> to load 12-month search interest for your top 5 tracked keywords.
                </div>
              ):(
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                  <thead><tr style={{borderBottom:`2px solid ${HAIR}`}}>
                    {['Keyword','Avg interest','Peak month','12-month trend'].map(h=>(
                      <th key={h} style={{padding:'5px 8px',textAlign:'left' as const,fontSize:10,fontFamily:'ui-monospace,monospace',letterSpacing:'0.08em',textTransform:'uppercase' as const,color:INK_F,fontWeight:600}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {trendsRows.map((r,i)=>{
                      const timeline=(r.interest_timeline??[]).slice(-12);
                      const max=Math.max(...timeline.map(t=>t.val),1);
                      return(
                        <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                          <td style={{padding:'7px 8px',color:INK,fontStyle:'italic'}}>{r.keyword}</td>
                          <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace',fontSize:12,color:r.avg_interest&&r.avg_interest>=50?GREEN:r.avg_interest&&r.avg_interest>=20?AMBER:INK_F,fontWeight:600}}>{r.avg_interest??'—'}<span style={{fontSize:10,color:INK_F,fontWeight:400}}>/100</span></td>
                          <td style={{padding:'7px 8px',color:INK_M,fontSize:11}}>{r.peak_month??'—'}</td>
                          <td style={{padding:'7px 8px'}}>
                            <div style={{display:'flex',gap:2,alignItems:'flex-end',height:24}}>
                              {timeline.map((t,j)=>(
                                <div key={j} title={`${t.date}: ${t.val}`} style={{width:8,borderRadius:2,background:GREEN,opacity:0.3+0.7*(t.val/max),height:Math.max(3,Math.round(24*(t.val/max)))}} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Container>
        </div>
      )}

      {tab==='backlinks' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Backlinks · Link profile" subtitle={`${propertyDomain} · referring domains, authority, anchor distribution`}
            action={
              <div style={{display:'flex',gap:8}}>
                <SeoTriggerBtn propertyId={propertyId} mode="backlinks" label="↻ Refresh backlinks" description="DataForSEO Backlinks API · top 50" />
              </div>
            }>
            {!blSum ? (
              <div style={{padding:'32px 16px',textAlign:'center' as const,color:INK_M,fontSize:13}}>
                No backlink data — click <strong>↻ Refresh backlinks</strong> to fetch link profile.
              </div>
            ) : (
              <div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,marginBottom:20}}>
                  {[
                    {l:'Authority Score',v:String(blSum.authority_score??'—'),col:blSum.authority_score>=30?GREEN:blSum.authority_score>=15?AMBER:RED},
                    {l:'Total Backlinks',v:(blSum.total_backlinks??0).toLocaleString(),col:INK},
                    {l:'Referring Domains',v:(blSum.referring_domains??0).toLocaleString(),col:INK},
                    {l:'DoFollow Links',v:blSum.total_backlinks>0?((blSum.dofollow_links/blSum.total_backlinks)*100).toFixed(0)+'%':'—',col:GREEN},
                  ].map((k,i)=>(
                    <div key={i} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'12px 14px',background:'#FFFFFF'}}>
                      <div style={{fontSize:22,fontWeight:700,color:k.col}}>{k.v}</div>
                      <div style={{fontSize:10,color:INK_F,marginTop:2,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{k.l}</div>
                    </div>
                  ))}
                </div>
                {blRows.length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:8}}>Top backlinks by domain rank</div>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr style={{borderBottom:`2px solid ${HAIR}`}}>
                        {['Source domain','Anchor','Page','DoFollow','Domain rank','First seen'].map(h=>(
                          <th key={h} style={{padding:'5px 8px',textAlign:'left' as const,fontSize:10,color:INK_F,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {blRows.map((r,i)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                            <td style={{padding:'5px 8px',fontFamily:'ui-monospace,monospace',fontSize:11,color:GREEN}}>{r.domain_from}</td>
                            <td style={{padding:'5px 8px',color:INK,fontStyle:'italic',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{r.anchor??'—'}</td>
                            <td style={{padding:'5px 8px',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}><a href={r.url_from} target="_blank" rel="noopener noreferrer" style={{color:INK_M,fontSize:10,textDecoration:'none'}}>{r.url_from?.replace(/^https?:\/\//,'').slice(0,40)}</a></td>
                            <td style={{padding:'5px 8px'}}><span style={{fontSize:10,padding:'1px 6px',borderRadius:99,background:r.is_dofollow?'#E6F4EA':'#FEE2E2',color:r.is_dofollow?GREEN:'#B03826',fontWeight:600}}>{r.is_dofollow?'DoFollow':'NoFollow'}</span></td>
                            <td style={{padding:'5px 8px',fontFamily:'ui-monospace,monospace',fontSize:11,color:INK_F}}>{r.domain_from_rank??'—'}</td>
                            <td style={{padding:'5px 8px',color:INK_F,fontSize:11}}>{r.first_seen?.slice(0,10)??'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{marginTop:12,padding:'10px 14px',background:'#F4EFE2',borderRadius:5,fontSize:11,color:INK_M,display:'flex',gap:16,flexWrap:'wrap' as const,alignItems:'center'}}>
                      <strong style={{color:INK}}>CTA options:</strong>
                      <a href={`mailto:?subject=Backlink+Outreach+—+${propertyDomain}&body=Hi,%0A%0AWe+noticed+you+link+to+similar+properties.+We+would+love+to+be+featured+in+your+content+too.%0A%0Ahttps://${propertyDomain}%0A%0ABest+regards`} style={{fontSize:11,padding:'4px 10px',border:`1px solid ${GREEN}`,borderRadius:4,color:GREEN,textDecoration:'none'}}>📧 Outreach template</a>
                      <span style={{fontSize:11,color:INK_F}}>Last updated: {blSum.fetched_at?.slice(0,10)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Container>
        </div>
      )}

      {tab==='hotel' && (
        <div style={{ gridColumn:'1/-1' }}>
          <Container title="Hotel Data · Google Hotels" subtitle="Competitive positioning + pricing in Google Hotels results"
            action={<SeoTriggerBtn propertyId={propertyId} mode="hotel" label="🏨 Refresh hotel data" description="business_data/google/hotel_searches · live" />}>
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

      {tab==='ai-web' && (
        <div style={{ gridColumn:'1/-1' }}>
          {/* AI Intel sub-tab navigation */}
          <div style={{display:'flex',gap:0,borderBottom:'2px solid '+HAIR,marginBottom:16}}>
            {([{key:'visibility',label:'AI Visibility'},{key:'intel',label:'Competitor Intel'},{key:'chat',label:'LLM Responses'},{key:'schema',label:'Schema & Fixes'}] as const).map(s=>(
              <a key={s.key} href={'?tab=ai-web&sub='+s.key} style={{
                padding:'7px 16px',fontSize:12,fontWeight:600,textDecoration:'none',
                color:aiSub===s.key?GREEN:INK_M,
                borderBottom:aiSub===s.key?'2px solid '+GREEN:'2px solid transparent',
                marginBottom:-2,whiteSpace:'nowrap' as const,
              }}>{s.label}</a>
            ))}
            <span style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,paddingBottom:6}}>
              {aiSub==='visibility'&&<SeoTriggerBtn propertyId={propertyId} mode="llm" label="↻ Refresh" variant="secondary" />}
              {aiSub==='intel'&&<SeoTriggerBtn propertyId={propertyId} mode="ai-domains" label="🏢 Update intel" variant="secondary" />}
              {aiSub==='chat'&&<SeoTriggerBtn propertyId={propertyId} mode="ai-query" label="💬 Ask ChatGPT" />}
              {aiSub==='schema'&&<SeoTriggerBtn propertyId={propertyId} mode="schema-sweep" label="🔍 Run audit" variant="secondary" />}
            </span>
          </div>

          {/* Visibility sub-tab */}
          {aiSub==='visibility' && (
            <div style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'16px 20px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:12 }}>{propertyDomain} in AI search — LLM Mentions</div>
              {llmSnapshot && llmSnapshot.total_mentions > 0 && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:8, marginBottom:16 }}>
                    {([['Total AI mentions',String(llmSnapshot.total_mentions),GREEN],['AI search volume',Number(llmSnapshot.ai_search_volume).toLocaleString(),INK],['Google AI Overview',String(llmSnapshot.google_mentions),GREEN],['ChatGPT',String(llmSnapshot.chatgpt_mentions),INK]] as [string,string,string][]).map(([l,v,c],i)=>(
                      <div key={i} style={{ background:'#F9F6F0',border:`1px solid ${HAIR}`,borderRadius:6,padding:'10px 14px' }}>
                        <div style={{ fontSize:10,fontFamily:'ui-monospace,monospace',textTransform:'uppercase' as const,color:INK_F,marginBottom:3 }}>{l}</div>
                        <div style={{ fontSize:22,fontWeight:700,color:c,fontVariantNumeric:'tabular-nums' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {(llmSnapshot.sources_raw as Array<{key:string;mentions:number}>|null)?.length?(
                    <>
                      <div style={{ fontSize:12,fontWeight:600,color:INK,marginBottom:8 }}>Top domains in AI answers</div>
                      <div style={{ display:'flex',flexWrap:'wrap' as const,gap:6,marginBottom:12 }}>
                        {(llmSnapshot.sources_raw as Array<{key:string;mentions:number}>).slice(0,8).map((s,i)=>(
                          <div key={i} style={{ fontSize:11,fontFamily:'ui-monospace,monospace',border:`1px solid ${HAIR}`,padding:'3px 10px',borderRadius:4,color:INK_M }}>{s.key} · {s.mentions}↗</div>
                        ))}
                      </div>
                    </>
                  ):null}
                  {questionsRows.length>0&&(
                    <>
                      <div style={{fontSize:12,fontWeight:600,color:INK,marginBottom:8}}>AI queries mentioning {propertyDomain}</div>
                      <div style={{display:'flex',flexWrap:'wrap' as const,gap:4,marginBottom:12}}>
                        {questionsRows.map((q,i)=>(<span key={i} style={{fontSize:11,border:'1px solid #E6DFCC',padding:'3px 10px',borderRadius:4,color:'#5A5A5A',background:'#F9F6F0'}}>{q.keyword}</span>))}
                      </div>
                    </>
                  )}
                  <div style={{ fontSize:10,color:INK_F }}>Last fetched: {llmSnapshot.snapshot_date} · {llmSnapshot.target}</div>
                </div>
              )}
              <div style={{ fontSize:12, fontWeight:700, color:INK, marginTop:16, marginBottom:12 }}>What AI says about {propertyDomain} — top 30 triggers</div>
              {mentionsRows.length===0?(
                <div style={{ fontSize:12, color:INK_M }}>Click <strong>↻ Refresh</strong> to fetch AI mention details.</div>
              ):(
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {mentionsRows.map((m,i)=>(
                    <div key={i} style={{ border:`1px solid ${HAIR}`, borderRadius:5, padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:INK, fontStyle:'italic' }}>{m.keyword}</span>
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:99, background:'#E8F0FE', color:'#1A56DB' }}>{m.llm}</span>
                        <span style={{ fontSize:10, color:INK_F, marginLeft:'auto' }}>{m.mention_date}</span>
                      </div>
                      {m.snippet&&<div style={{ fontSize:11, color:INK_M, lineHeight:1.5, fontStyle:'italic' }}>&quot;{m.snippet.replace(/!\[.*?\]\(.*?\)\n?/g,'').slice(0,200)}&quot;...</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Competitor Intel sub-tab */}
          {aiSub==='intel' && (
            <div style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'16px 20px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:12 }}>Who AI cites instead — competitor domains per keyword</div>
              {domainIntel.length === 0 ? (
                <div style={{ fontSize:12, color:INK_M, padding:'24px 0', textAlign:'center' as const }}>
                  No competitor AI intel data — click <strong>🏢 Update intel</strong> above.
                </div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                  <thead><tr style={{borderBottom:`1px solid ${HAIR}`}}>
                    {['Domain','Keyword','AI Mentions','AI Volume'].map(h=><th key={h} style={{padding:'4px 8px',textAlign:'left' as const,fontSize:10,color:INK_M,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {domainIntel.slice(0,20).map((r,i)=>(
                      <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                        <td style={{padding:'5px 8px',color:r.item_name.includes('namkhan')?GREEN:INK,fontFamily:'monospace',fontSize:11,fontWeight:r.item_name.includes('namkhan')?700:400}}>{r.item_name} {r.item_name.includes('namkhan')&&'✓'}</td>
                        <td style={{padding:'5px 8px',color:INK_M,fontSize:10,fontStyle:'italic'}}>{r.target_keyword}</td>
                        <td style={{padding:'5px 8px',fontFamily:'monospace',textAlign:'right' as const}}>{r.mentions}</td>
                        <td style={{padding:'5px 8px',color:INK_M,fontFamily:'monospace',textAlign:'right' as const}}>{r.ai_search_volume?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* LLM Responses — chat sub-tab */}
          {aiSub==='chat' && (
            <div style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'16px 20px', marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:4 }}>
                LLM responses to hotel queries — {llmRespRows.length} responses stored
              </div>
              <div style={{ fontSize:11, color:INK_F, marginBottom:16 }}>
                What ChatGPT / Perplexity / Gemini say when asked about hotels in {propertyLocCity || 'your market'} · Green border = {propertyDomain} mentioned
              </div>
              {llmRespRows.length === 0 ? (
                <div style={{ fontSize:12, color:INK_M, padding:'24px 0', textAlign:'center' as const }}>
                  No LLM responses stored — click <strong>💬 Ask ChatGPT</strong> above to query live.
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' as const, gap:28 }}>
                  {llmPlatforms.map(platform => {
                    const rows = llmByPlatform[platform] ?? [];
                    return (
                      <div key={platform}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:INK, letterSpacing:'0.05em', textTransform:'uppercase' as const }}>{platform}</div>
                          <div style={{ fontSize:10, color:INK_F, fontFamily:'ui-monospace,monospace' }}>
                            {rows.length} response{rows.length !== 1 ? 's' : ''} · {rows.filter(r => r.our_domain_mentioned).length} mention {propertyDomain}
                          </div>
                          <div style={{ flex:1, height:1, background:HAIR }} />
                        </div>
                        <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
                          {rows.map((r, i) => (
                            <SeoLlmResponseCard
                              key={`${platform}-${i}`}
                              prompt={r.prompt}
                              response_text={r.response_text}
                              our_domain_mentioned={r.our_domain_mentioned}
                              platform={r.platform}
                              model={r.model ?? null}
                              fetched_at={r.fetched_at}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Schema Health */}
          {aiSub==='schema' && (
            <>
              <div style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'16px 20px', marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:12 }}>Schema Markup Health (structured data for AI/Google)</div>
                {instantPages.length===0?(
                  <div style={{ fontSize:12, color:INK_M }}>Click <strong>🔍 Run audit</strong> to check schema on all key pages.</div>
                ):(
                  <table style={{ width:'100%', borderCollapse:'collapse' as const, fontSize:12 }}>
                    <thead><tr style={{ borderBottom:`2px solid ${HAIR}` }}>
                      {['Page','Schema','Title len','Words','Readability','Issues'].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left' as const, fontSize:10, fontFamily:'ui-monospace,monospace', textTransform:'uppercase' as const, color:INK_F }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{instantPages.map((p,i)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${HAIR}` }}>
                        <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', fontSize:11, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}><a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color:GREEN, textDecoration:'none' }}>{p.url.replace(/^https?:\/\/[^/]+/,'')}</a></td>
                        <td style={{ padding:'7px 8px' }}><span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, background:p.issues?.schema_missing?'#FEE2E2':'#E6F4EA', color:p.issues?.schema_missing?RED:GREEN, fontWeight:600 }}>{p.issues?.schema_missing?'❌ MISSING':'✅ Present'}</span></td>
                        <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', fontSize:11, color:p.title_length&&p.title_length>60?RED:GREEN }}>{p.title_length}ch</td>
                        <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', fontSize:11 }}>{p.word_count}</td>
                        <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', fontSize:11, color:p.readability&&p.readability>=60?GREEN:p.readability&&p.readability>=45?AMBER:RED }}>{p.readability?.toFixed(1)}</td>
                        <td style={{ padding:'7px 8px', fontSize:10 }}>{Object.entries(p.issues??{}).filter(([,v])=>!!v).map(([k])=><span key={k} style={{ marginRight:3, padding:'1px 5px', borderRadius:99, background:'#FEF3C7', color:AMBER }}>{k.replace(/_/g,' ')}</span>)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
                <div style={{ marginTop:12, padding:'10px 14px', background:'#FFF8E1', border:`1px solid ${AMBER}`, borderRadius:5, fontSize:11, color:'#5A5A5A' }}>
                  <strong>Fix required:</strong> Add <code>@type: Hotel</code> JSON-LD schema to {propertyDomain} homepage and <code>@type: Product</code> + <code>Offer</code> to each bookable room/experience page. Without this, Google AI cannot classify the site as a bookable hotel and won&apos;t surface it for commercial queries like &quot;{propertyHotelKw || 'hotel'}&quot;.
                </div>
              </div>
              <div style={{ background:'#FFFFFF', border:`1px solid ${HAIR}`, borderRadius:6, padding:'16px 20px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:INK, marginBottom:8 }}>Schema to implement on {propertyDomain} (copy to CMS &lt;head&gt;)</div>
                <pre style={{ background:'#1B1B1B', color:'#E6DFCC', padding:'14px 16px', borderRadius:6, fontSize:10, lineHeight:1.6, overflow:'auto', whiteSpace:'pre' as const }}>{`<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Hotel",
  "name": "<your property name>",
  "url": "https://www.${propertyDomain}",
  "description": "<one-sentence positioning line — what the property is and who it is for>",
  "starRating": { "@type": "Rating", "ratingValue": "5" },
  "priceRange": "$$$$",
  "address": { "@type": "PostalAddress", "addressLocality": "${propertyLocCity}", "addressCountry": "${propertyLocCountry}" },
  "checkInTime": "14:00", "checkOutTime": "12:00",
  "amenityFeature": [
    {"@type":"LocationFeatureSpecification","name":"Pool","value":true},
    {"@type":"LocationFeatureSpecification","name":"Spa","value":true},
    {"@type":"LocationFeatureSpecification","name":"Restaurant","value":true}
  ]
}
</script>`}</pre>
              </div>
            </>
          )}
        </div>
      )}

    </DashboardPage>
  );
}
