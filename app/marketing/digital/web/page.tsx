// app/marketing/digital/web/page.tsx
// Search Intelligence (GSC) + Website Intelligence (GA4) + Google Trends
// Rebuilt per brief: google-search-console-ga4-bi-views.md
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AnalyticsPullBtn from '@/components/analytics/AnalyticsPullBtn';
import TrendChart from '@/components/analytics/TrendChart';
import SourcesChart from '@/components/analytics/SourcesChart';

export const dynamic = 'force-dynamic';

const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_S='#5A5A5A';const INK_F='#8A8A8A';
const GREEN='#084838';const AMBER='#C28F2C';const RED='#B03826';

// ─── Types ────────────────────────────────────────────────────────────────────
type MetricRow={metricValues?:{value:string}[]};
type DimMetricRow={dimensionValues?:{value:string}[];metricValues?:{value:string}[]};
type GscRow={keys?:string[];clicks?:number;impressions?:number;ctr?:number;position?:number};

function mv(row:MetricRow,idx:number):number{return parseFloat(row.metricValues?.[idx]?.value??'0')||0;}
function fmt(n:number):string{if(n>=1_000_000)return(n/1_000_000).toFixed(1)+'M';if(n>=1_000)return(n/1_000).toFixed(1)+'k';return String(Math.round(n));}
function fmtDuration(s:number):string{if(s<60)return Math.round(s)+'s';return Math.floor(s/60)+'m '+String(Math.round(s%60)).padStart(2,'0')+'s';}
function posColor(p:number){return p<=3?GREEN:p<=10?INK:p<=20?AMBER:RED;}

// ─── Query → intent category (all 13 from brief) ─────────────────────────────
// Categories: Brand · Destination · Hotel · Rooms · Wellness · Spa · Retreats
//             Activities · Restaurant · Family · Groups/Weddings · Sustainability · Competitor · Other
const CATEGORY_ORDER=['Brand','Hotel','Rooms','Spa','Wellness','Retreats','Activities','Restaurant','Family','Groups/Weddings','Destination','Sustainability','Competitor','Other'];
function classifyQuery(q:string):string{
  const l=q.toLowerCase();
  if(/namkhan|nam khan|namshan/.test(l)) return 'Brand';
  if(/agoda|booking\.com|expedia|tripadvisor|hostelworld|klook|viator/.test(l)) return 'Competitor';
  if(/room|suite|villa|bungalow|cabin|bed|accommodation|stay/.test(l)) return 'Rooms';
  if(/wedding|group event|private event|incentive|corporate/.test(l)) return 'Groups/Weddings';
  if(/family|kids|children|child|baby/.test(l)) return 'Family';
  if(/spa|massage|treatment|body/.test(l)) return 'Spa';
  if(/yoga|wellness retreat|meditation|mindfulness|healing|detox retreat/.test(l)) return 'Wellness';
  if(/retreat|detox/.test(l)) return 'Retreats';
  if(/cooking class|cooking school|laos cooking|culinary/.test(l)) return 'Activities';
  if(/gym|fitness|beach in |kayak|cycling|bike|trekking|hiking|elephant/.test(l)) return 'Activities';
  if(/restaurant|dining|food|eat|cafe|cuisine/.test(l)) return 'Restaurant';
  if(/eco|sustain|green|organic|environmental|responsible/.test(l)) return 'Sustainability';
  if(/hotel|resort|lodge|accommodation|luxury|glamping/.test(l)) return 'Hotel';
  if(/laos|luang prabang|lao |lp |vientiane/.test(l)) return 'Destination';
  return 'Other';
}

// ─── Page → content category ──────────────────────────────────────────────────
function classifyPage(url:string):string{
  if(/thenamkhan\.com\/?$/.test(url)) return 'Homepage';
  if(/\/spa|\/wellness/.test(url)) return 'Spa & Wellness';
  if(/\/retreats/.test(url)) return 'Retreats';
  if(/\/dining|\/cooking|\/restaurant/.test(url)) return 'Dining';
  if(/\/blog/.test(url)) return 'Blog';
  if(/\/facilities/.test(url)) return 'Facilities';
  if(/\/glamping/.test(url)) return 'Glamping';
  if(/\/experiences|\/activities/.test(url)) return 'Activities';
  if(/\/offers/.test(url)) return 'Offers';
  if(/\/private-events|\/weddings/.test(url)) return 'Events';
  if(/\/about|\/location/.test(url)) return 'About';
  if(/\/i-mekong/.test(url)) return 'i-Mekong';
  return 'Other';
}

// ─── Channel grouping ─────────────────────────────────────────────────────────
function channelGroup(source:string,medium:string):string{
  if(source==='(direct)'||medium==='(none)') return 'Direct';
  if(medium==='cpc'||medium==='paid'||medium==='paidsearch') return 'Paid Search';
  if(medium==='organic') return 'Organic Search';
  if(medium==='email') return 'Email';
  if(/social|instagram|facebook|tiktok|pinterest/.test(medium)||/social|instagram|facebook/.test(source)) return 'Organic Social';
  if(medium==='referral') return 'Referral';
  return 'Other';
}

const GA4_REQUESTS=[
  {endpoint:'/api/marketing/analytics/ga4',body:{mode:'report',report_type:'overview',date_range:'30d'}},
  {endpoint:'/api/marketing/analytics/ga4',body:{mode:'report',report_type:'pages',date_range:'30d'}},
  {endpoint:'/api/marketing/analytics/ga4',body:{mode:'report',report_type:'sources',date_range:'30d'}},
  {endpoint:'/api/marketing/analytics/ga4',body:{mode:'report',report_type:'trend',date_range:'30d'}},
];
const GSC_REQUESTS=[
  {endpoint:'/api/marketing/analytics/gsc',body:{mode:'queries',date_range:'30d'}},
  {endpoint:'/api/marketing/analytics/gsc',body:{mode:'pages',date_range:'30d'}},
];
const TRENDS_REQUESTS=[
  {endpoint:'/api/marketing/seo/trigger',body:{mode:'trends',property_id:260955}},
];

export default async function DigitalWebPage({searchParams}:{searchParams?:{tab?:string}}) {
  // Keep old tab keys (analytics/gsc) + support new keys (web/search/trends)
  const rawTab=searchParams?.tab??'search';
  const activeTab=rawTab==='analytics'?'web':rawTab==='gsc'?'search':rawTab;
  const cfg=DEPT_CFG.marketing;
  const tabs:DashboardTab[]=(cfg.subPages??[]).map(s=>({key:s.href,label:s.label,href:s.href,active:s.href==='/marketing/digital'}));
  const sb=getSupabaseAdmin();

  const isSearch=activeTab==='search';
  const isWeb=activeTab==='web';
  const isTrends=activeTab==='trends';

  const [ovRes,pgRes,srcRes,trendRes,qRes,gscPgRes,trendsRes]=await Promise.all([
    isWeb?sb.from('v_ga4_reports').select('rows,totals,date_range,fetched_at').eq('report_type','overview').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isWeb?sb.from('v_ga4_reports').select('rows').eq('report_type','pages').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isWeb?sb.from('v_ga4_reports').select('rows').eq('report_type','sources').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isWeb?sb.from('v_ga4_reports').select('rows').eq('report_type','trend').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isSearch?sb.from('v_gsc_reports').select('rows,totals,date_range,fetched_at').eq('report_type','queries').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isSearch?sb.from('v_gsc_reports').select('rows,totals').eq('report_type','pages').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isTrends?sb.from('v_seo_trends').select('keyword,avg_interest,peak_month,interest_timeline,related_queries,fetched_at').eq('property_id',260955).order('avg_interest',{ascending:false}).limit(10):Promise.resolve({data:[]}),
  ]);

  // ── GA4 data processing ─────────────────────────────────────────────────────
  const ov=(ovRes.data?.rows as any[])?.[0] as MetricRow|null;
  const pageRows=(pgRes.data?.rows??[]) as DimMetricRow[];
  const srcRows=(srcRes.data?.rows??[]) as DimMetricRow[];
  const trendRows=(trendRes.data?.rows??[]) as DimMetricRow[];

  const sessions=ov?mv(ov,0):0;
  const users=ov?mv(ov,1):0;
  const newUsers=ov?mv(ov,2):0;
  const pageviews=ov?mv(ov,3):0;
  const engagementRate=ov?mv(ov,4):0;
  const avgEngageSec=ov?mv(ov,5):0;
  const bounceRate=ov?mv(ov,6):0;

  const trendData=trendRows.map(r=>({
    date:(r.dimensionValues?.[0]?.value??'').slice(4),
    sessions:Math.round(mv(r,0)),
    pageviews:Math.round(mv(r,1)),
  }));

  // Channel grouping
  type ChannelRow={channel:string;sessions:number;engaged:number;events:number};
  const channelMap=new Map<string,ChannelRow>();
  for(const r of srcRows){
    const src=r.dimensionValues?.[0]?.value??'';
    const med=r.dimensionValues?.[1]?.value??'';
    const ch=channelGroup(src,med);
    const existing=channelMap.get(ch)??{channel:ch,sessions:0,engaged:0,events:0};
    channelMap.set(ch,{channel:ch,sessions:existing.sessions+Math.round(mv(r,0)),engaged:existing.engaged+Math.round(mv(r,1)),events:existing.events+Math.round(mv(r,2))});
  }
  const channelData=[...channelMap.values()].sort((a,b)=>b.sessions-a.sessions);
  const sourcesData=channelData.map(c=>({source:c.channel,sessions:c.sessions}));

  // ── GSC data processing ─────────────────────────────────────────────────────
  const gscTotals=gscPgRes.data?.totals as {clicks:number;impressions:number;ctr:number;position:number}|null;
  const qRows=(qRes.data?.rows??[]) as GscRow[];
  const gscPgRows=(gscPgRes.data?.rows??[]) as GscRow[];
  const gscFetched=(qRes.data as any)?.fetched_at as string|null;

  // Brand vs non-brand split
  const brandRows=qRows.filter(r=>/namkhan|nam khan|namshan/.test((r.keys?.[0]??'').toLowerCase()));
  const brandImpr=brandRows.reduce((s,r)=>s+(r.impressions??0),0);
  const brandClicks=brandRows.reduce((s,r)=>s+(r.clicks??0),0);
  const totalImprFromQ=qRows.reduce((s,r)=>s+(r.impressions??0),0);
  const totalClicksFromQ=qRows.reduce((s,r)=>s+(r.clicks??0),0);
  const nonBrandImpr=totalImprFromQ-brandImpr;
  const nonBrandClicks=totalClicksFromQ-brandClicks;

  // Query intent classification
  type CategoryBucket={cat:string;impressions:number;clicks:number;queries:number};
  const catMap=new Map<string,CategoryBucket>();
  for(const cat of CATEGORY_ORDER) catMap.set(cat,{cat,impressions:0,clicks:0,queries:0});
  for(const r of qRows){
    const cat=classifyQuery(r.keys?.[0]??'');
    const existing=catMap.get(cat)??{cat,impressions:0,clicks:0,queries:0};
    catMap.set(cat,{cat,impressions:existing.impressions+(r.impressions??0),clicks:existing.clicks+(r.clicks??0),queries:existing.queries+1});
  }
  const categoryBuckets=[...catMap.values()].filter(b=>b.queries>0).sort((a,b)=>b.impressions-a.impressions);
  const maxCatImpr=Math.max(...categoryBuckets.map(b=>b.impressions),1);

  // SEO Opportunity Map: position 4–30, sorted by impressions desc
  const avgCtrAll=qRows.length?qRows.reduce((s,r)=>s+(r.ctr??0),0)/qRows.length:0;
  const opportunityRows=qRows
    .filter(r=>(r.position??99)>=4&&(r.position??99)<=30&&(r.impressions??0)>10)
    .sort((a,b)=>(b.impressions??0)-(a.impressions??0))
    .slice(0,15);

  // Page performance with category
  type PagePerf={url:string;path:string;category:string;clicks:number;impressions:number;ctr:number;position:number};
  const pagePerf:PagePerf[]=gscPgRows.map(r=>({
    url:r.keys?.[0]??'',
    path:(r.keys?.[0]??'/').replace('https://www.thenamkhan.com','').replace('http://www.thenamkhan.com','').replace('https://thenamkhan.com','').replace('http://thenamkhan.com','')||'/',
    category:classifyPage(r.keys?.[0]??''),
    clicks:r.clicks??0,impressions:r.impressions??0,ctr:r.ctr??0,position:r.position??0,
  }));

  // ── Google Trends data processing ──────────────────────────────────────────
  type TrendKw={keyword:string;avg_interest:number|null;peak_month:string|null;interest_timeline:Array<{date:string;val:number}>|null;related_queries:string[]|null;fetched_at:string|null};
  const trendsData=(trendsRes.data??[]) as TrendKw[];
  const trendsLastFetch=trendsData[0]?.fetched_at?.slice(0,10)??null;
  const maxInterest=Math.max(...trendsData.map(t=>t.avg_interest??0),1);

  const SUBTABS=[
    {key:'search',label:'🔍 Search Intelligence (GSC)'},
    {key:'web',label:'📊 Website Intelligence (GA4)'},
    {key:'trends',label:'📈 Google Trends'},
  ];

  const th=(label:string,right=false)=>(
    <th key={label} style={{padding:'5px 8px',textAlign:right?'right' as const:'left' as const,fontSize:10,fontWeight:600,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',borderBottom:`2px solid ${HAIR}`}}>{label}</th>
  );

  const SectionHeader=({title,sub}:{title:string;sub:string})=>(
    <div style={{paddingBottom:6,borderBottom:`2px solid ${HAIR}`,marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:INK}}>{title}</div>
      <div style={{fontSize:11,color:INK_F,marginTop:2}}>{sub}</div>
    </div>
  );

  const ComingSoon=({title,reason}:{title:string;reason:string})=>(
    <div style={{padding:'16px 20px',border:`1px dashed ${HAIR}`,borderRadius:6,background:'#FAFAF7'}}>
      <div style={{fontSize:12,fontWeight:600,color:INK_S,marginBottom:4}}>{title}</div>
      <div style={{fontSize:11,color:INK_F}}>{reason}</div>
    </div>
  );

  return (
    <DashboardPage title="Marketing · Search & Web Intelligence" subtitle="thenamkhan.com — search demand · website performance · commercial signals" tabs={tabs}>
      <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:24}}>

        {/* Sub-tab nav */}
        <div style={{display:'flex',gap:0,borderBottom:`2px solid ${HAIR}`,marginBottom:-8}}>
          {SUBTABS.map(t=>(
            <a key={t.key} href={'?tab='+t.key} style={{
              padding:'8px 20px',fontSize:12,fontWeight:600,textDecoration:'none',
              color:activeTab===t.key?GREEN:INK_S,
              borderBottom:activeTab===t.key?`2px solid ${GREEN}`:'2px solid transparent',
              marginBottom:-2,whiteSpace:'nowrap' as const,
            }}>{t.label}</a>
          ))}
          <span style={{marginLeft:'auto',display:'flex',alignItems:'center',paddingBottom:8,gap:8}}>
            {isSearch&&<AnalyticsPullBtn requests={GSC_REQUESTS} label="↻ Pull GSC" variant="secondary" />}
            {isWeb&&<AnalyticsPullBtn requests={GA4_REQUESTS} label="↻ Pull GA4" variant="secondary" />}
          </span>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SEARCH INTELLIGENCE — GSC                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isSearch&&(
          gscTotals?(
            <>
              {/* 1 · ORGANIC DEMAND PULSE */}
              <div>
                <SectionHeader
                  title="1 · Organic Demand Pulse"
                  sub="Google organic search visibility · last 30 days · thenamkhan.com"
                />
                {/* Site-level KPIs from pages report totals */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
                  {[
                    {l:'Clicks',v:fmt(gscTotals.clicks),sub:'Organic visits from Google',col:GREEN},
                    {l:'Impressions',v:fmt(gscTotals.impressions),sub:'Times shown in Google',col:INK},
                    {l:'CTR',v:(gscTotals.ctr*100).toFixed(1)+'%',sub:'Click-through rate',col:INK},
                    {l:'Avg Position',v:'#'+Math.round(gscTotals.position),sub:'Average SERP ranking',col:gscTotals.position<=10?GREEN:gscTotals.position<=20?AMBER:RED},
                    {l:'Brand share',v:Math.round(brandClicks/Math.max(totalClicksFromQ,1)*100)+'%',sub:'Clicks on brand queries',col:AMBER},
                  ].map((k,i)=>(
                    <div key={i} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'12px 14px',background:'#FFFFFF'}}>
                      <div style={{fontSize:11,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:4,fontFamily:'ui-monospace,monospace'}}>{k.l}</div>
                      <div style={{fontSize:24,fontWeight:700,color:k.col,fontVariantNumeric:'tabular-nums',lineHeight:1}}>{k.v}</div>
                      <div style={{fontSize:10,color:INK_F,marginTop:4}}>{k.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Brand vs Non-Brand split */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  {[
                    {label:'Brand search',clicks:brandClicks,impr:brandImpr,desc:'Queries containing "namkhan"',color:GREEN},
                    {label:'Non-brand search',clicks:nonBrandClicks,impr:nonBrandImpr,desc:'Destination, wellness, activities, hotel queries',color:INK},
                  ].map((b,i)=>(
                    <div key={i} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'12px 16px',background:'#FFFFFF',display:'flex',gap:16,alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:b.color}}>{b.label}</div>
                        <div style={{fontSize:10,color:INK_F,marginTop:2}}>{b.desc}</div>
                      </div>
                      <div style={{marginLeft:'auto',textAlign:'right' as const}}>
                        <div style={{fontSize:18,fontWeight:700,color:INK,fontVariantNumeric:'tabular-nums'}}>{fmt(b.clicks)} <span style={{fontSize:11,color:INK_F,fontWeight:400}}>clicks</span></div>
                        <div style={{fontSize:11,color:INK_F}}>{fmt(b.impr)} impr.</div>
                      </div>
                    </div>
                  ))}
                </div>
                <ComingSoon
                  title="16-month trend chart — coming when extended sync is enabled"
                  reason="The daily GSC trend report (date dimension over 16 months) needs to be added to the gsc-sync edge function. Once enabled, this section shows a line chart of impressions and clicks over time with YoY comparison."
                />
                {gscFetched&&<div style={{fontSize:10,color:INK_F,marginTop:8,fontFamily:'ui-monospace,monospace'}}>Data: 30-day snapshot · fetched {gscFetched?.slice(0,10)}</div>}
              </div>

              {/* 2 · GUEST SEARCH INTENT */}
              <div>
                <SectionHeader
                  title="2 · Guest Search Intent"
                  sub="What potential guests search for on Google · classified by demand theme"
                />
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                  {/* Category bars */}
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Impressions by intent category</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {categoryBuckets.map((b,i)=>(
                        <div key={i}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:11,color:b.cat==='Brand'?AMBER:INK,fontWeight:b.cat==='Brand'?700:400}}>{b.cat}</span>
                            <span style={{fontSize:11,color:INK_F,fontFamily:'ui-monospace,monospace'}}>{fmt(b.impressions)} impr · {b.queries} quer.</span>
                          </div>
                          <div style={{height:6,background:HAIR,borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:6,background:b.cat==='Brand'?AMBER:GREEN,borderRadius:3,width:Math.round(b.impressions/maxCatImpr*100)+'%'}} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Category breakdown table */}
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Click performance by category</div>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr>{[th('Category'),th('Clicks',true),th('Impr.',true),th('CTR',true)]}</tr></thead>
                      <tbody>
                        {categoryBuckets.map((b,i)=>{
                          const ctr=b.impressions>0?(b.clicks/b.impressions*100).toFixed(1)+'%':'—';
                          return(
                            <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                              <td style={{padding:'5px 8px',color:b.cat==='Brand'?AMBER:INK,fontWeight:b.cat==='Brand'?700:400}}>{b.cat}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace'}}>{fmt(b.clicks)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmt(b.impressions)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:b.clicks/Math.max(b.impressions,1)>avgCtrAll?GREEN:INK_F}}>{ctr}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{marginTop:10,fontSize:10,color:INK_F,padding:'6px 10px',background:'#F4EFE2',borderRadius:4}}>
                      Non-brand demand (Spa · Wellness · Retreats · Activities) represents the growth signal. A strong brand share means the site ranks well for its own name — non-brand is where new guest discovery happens.
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 · SEO OPPORTUNITY MAP */}
              <div>
                <SectionHeader
                  title="3 · SEO Opportunity Map"
                  sub="Queries with high impressions + position 4–30 · low CTR = priority improvement targets"
                />
                {opportunityRows.length===0?(
                  <div style={{padding:'20px',color:INK_F,fontSize:12}}>No queries in position 4–30 with sufficient impressions. Run SERP tasks to build ranking data.</div>
                ):(
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr>
                        {[th('Query'),th('Position',true),th('Impressions',true),th('Clicks',true),th('CTR',true),th('Priority',true)]}
                      </tr></thead>
                      <tbody>
                        {opportunityRows.map((r,i)=>{
                          const pos=r.position??99;
                          const ctr=r.ctr??0;
                          const impr=r.impressions??0;
                          const isLowCtr=ctr<avgCtrAll*0.7;
                          const priority=pos<=10&&isLowCtr?'High':pos<=20?'Medium':'Low';
                          const priCol=priority==='High'?RED:priority==='Medium'?AMBER:INK_F;
                          return(
                            <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                              <td style={{padding:'5px 8px',color:INK,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{r.keys?.[0]??'—'}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:posColor(pos),fontWeight:pos<=10?600:400}}>#{Math.round(pos)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace'}}>
                                <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
                                  <div style={{width:Math.round(impr/Math.max(...opportunityRows.map(x=>x.impressions??0),1)*50),height:4,background:HAIR,borderRadius:2,minWidth:2}}/>
                                  {fmt(impr)}
                                </div>
                              </td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace'}}>{r.clicks??0}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:isLowCtr?RED:INK_F}}>{(ctr*100).toFixed(1)}%</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const}}>
                                <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:priority==='High'?'#FEE2E2':priority==='Medium'?'#FEF3C7':'#F4F4F5',color:priCol,fontWeight:600}}>{priority}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{marginTop:10,fontSize:10,color:INK_F,padding:'6px 10px',background:'#F4EFE2',borderRadius:4}}>
                      High priority = page 1 position but CTR well below average. Improve title tag and meta description to lift clicks without needing better ranking.
                    </div>
                  </div>
                )}
              </div>

              {/* 4 · LANDING PAGE PERFORMANCE */}
              <div>
                <SectionHeader
                  title="4 · Landing Page Performance"
                  sub="Which hotel pages generate organic Google visibility and traffic"
                />
                <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                  <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                    <thead><tr>{[th('Page'),th('Category'),th('Clicks',true),th('Impressions',true),th('CTR',true),th('Avg Position',true)]}</tr></thead>
                    <tbody>
                      {pagePerf.map((p,i)=>(
                        <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                          <td style={{padding:'5px 8px',fontFamily:'ui-monospace,monospace',fontSize:10,color:GREEN,maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>
                            <a href={p.url} target="_blank" rel="noopener noreferrer" style={{color:GREEN,textDecoration:'none'}}>{p.path}</a>
                          </td>
                          <td style={{padding:'5px 8px',fontSize:10,color:INK_F}}>{p.category}</td>
                          <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',fontWeight:600}}>{p.clicks}</td>
                          <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmt(p.impressions)}</td>
                          <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:(p.ctr*100)>5?GREEN:INK_F}}>{(p.ctr*100).toFixed(1)}%</td>
                          <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:posColor(p.position),fontWeight:p.position<=10?600:400}}>#{Math.round(p.position)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{marginTop:10,fontSize:10,color:INK_F}}>
                    Pages with high impressions but low CTR have visibility without traffic — title and meta description optimisation is the lever.
                  </div>
                </div>
              </div>

              {/* 5 · TOP QUERIES detail */}
              <div>
                <SectionHeader
                  title="5 · Top Queries"
                  sub="All 50 queries ranked by impressions · colour = Google position"
                />
                <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                  <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                    <thead><tr>{[th('Query'),th('Category'),th('Clicks',true),th('Impressions',true),th('CTR',true),th('Position',true)]}</tr></thead>
                    <tbody>
                      {[...qRows].sort((a,b)=>(b.impressions??0)-(a.impressions??0)).map((r,i)=>{
                        const pos=r.position??99;
                        const cat=classifyQuery(r.keys?.[0]??'');
                        return(
                          <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                            <td style={{padding:'4px 8px',color:cat==='Brand'?AMBER:INK,fontStyle:cat!=='Brand'?'italic' as const:'normal' as const,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{r.keys?.[0]??'—'}</td>
                            <td style={{padding:'4px 8px',fontSize:10,color:INK_F}}>{cat}</td>
                            <td style={{padding:'4px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',fontWeight:600}}>{r.clicks??0}</td>
                            <td style={{padding:'4px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmt(r.impressions??0)}</td>
                            <td style={{padding:'4px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{((r.ctr??0)*100).toFixed(1)}%</td>
                            <td style={{padding:'4px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:posColor(pos),fontWeight:pos<=10?600:400}}>#{Math.round(pos)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6 · COMING SECTIONS */}
              <div>
                <SectionHeader
                  title="6 · Search Demand by Market + Search → Booking Funnel"
                  sub="Requires extended data sync — see below"
                />
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <ComingSoon
                    title="Search demand by country (GSC)"
                    reason="Add country dimension to gsc-sync edge function. Shows which markets (Germany, UK, US, Australia, France) are gaining or losing Google search interest before bookings appear."
                  />
                  <ComingSoon
                    title="Search → Booking Funnel"
                    reason="Requires joining GSC clicks + GA4 sessions + booking engine visit events + PMS reservations. Enable GA4 booking engine event tracking first."
                  />
                </div>
              </div>
            </>
          ):(
            <div style={{padding:40,textAlign:'center' as const,color:INK_S,fontSize:12,border:`1px dashed ${HAIR}`,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <div style={{fontSize:32}}>🔍</div>
              <div style={{fontSize:14,fontWeight:600,color:INK}}>No Search Console data yet</div>
              <div style={{color:INK_F,marginBottom:8}}>Add the service account to GSC as Full user, then pull data</div>
              <AnalyticsPullBtn requests={GSC_REQUESTS} label="↻ Pull GSC data" />
            </div>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* WEBSITE INTELLIGENCE — GA4                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isWeb&&(
          ov?(
            <>
              {/* 1 · WEBSITE DEMAND PULSE */}
              <div>
                <SectionHeader
                  title="1 · Website Demand Pulse"
                  sub="thenamkhan.com · qualified website demand · last 30 days"
                />
                <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8,marginBottom:16}}>
                  {[
                    {l:'Sessions',v:fmt(sessions),col:INK},
                    {l:'Users',v:fmt(users),col:INK},
                    {l:'New Users',v:fmt(newUsers),col:INK},
                    {l:'Pageviews',v:fmt(pageviews),col:INK},
                    {l:'Engagement',v:(engagementRate*100).toFixed(1)+'%',col:engagementRate>=0.5?GREEN:AMBER},
                    {l:'Avg Duration',v:fmtDuration(avgEngageSec),col:avgEngageSec>=120?GREEN:INK_F},
                    {l:'Bounce Rate',v:(bounceRate*100).toFixed(1)+'%',col:bounceRate<=0.4?GREEN:bounceRate<=0.6?AMBER:RED},
                  ].map((k,i)=>(
                    <div key={i} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'12px 14px',background:'#FFFFFF'}}>
                      <div style={{fontSize:10,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:4,fontFamily:'ui-monospace,monospace'}}>{k.l}</div>
                      <div style={{fontSize:20,fontWeight:700,color:k.col,fontVariantNumeric:'tabular-nums',lineHeight:1}}>{k.v}</div>
                    </div>
                  ))}
                </div>
                {trendData.length>0&&(
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Sessions + Pageviews — 30-day trend</div>
                    <TrendChart data={trendData} />
                    <div style={{marginTop:10,fontSize:10,color:INK_F}}>
                      Engaged sessions = sessions lasting &gt;10s or viewing 2+ pages or triggering a key event. A rising engaged session curve with flat total sessions = quality improving.
                    </div>
                  </div>
                )}
                <div style={{marginTop:12}}>
                  <ComingSoon
                    title="12–18 month historical trend + YoY comparison"
                    reason="Requires pulling GA4 trend data with extended date range (16 months back). Update the ga4-sync edge function date_range parameter and add YoY period fetch."
                  />
                </div>
              </div>

              {/* 2 · ACQUISITION / CHANNEL PERFORMANCE */}
              <div>
                <SectionHeader
                  title="2 · Acquisition · Channel Performance"
                  sub="Which channels bring useful visitors · engagement quality not just volume"
                />
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Sessions by channel</div>
                    <SourcesChart data={sourcesData} />
                  </div>
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Channel engagement quality</div>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr>{[th('Channel'),th('Sessions',true),th('Engaged',true),th('Eng. rate',true),th('Events',true)]}</tr></thead>
                      <tbody>
                        {channelData.map((c,i)=>{
                          const er=c.sessions>0?c.engaged/c.sessions:0;
                          return(
                            <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                              <td style={{padding:'5px 8px',color:INK}}>{c.channel}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace'}}>{fmt(c.sessions)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmt(c.engaged)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:er>=0.5?GREEN:er>=0.3?AMBER:RED,fontWeight:600}}>{(er*100).toFixed(0)}%</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmt(c.events)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{marginTop:10,fontSize:10,color:INK_F,padding:'6px 10px',background:'#F4EFE2',borderRadius:4}}>
                      Organic Search should have the highest engagement rate — these are people with genuine intent. Paid Search volume with low engagement = ad targeting mismatch.
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 · SOURCE MARKET WEBSITE DEMAND */}
              <div>
                <SectionHeader
                  title="3 · Source-Market Website Demand"
                  sub="Which countries are visiting thenamkhan.com"
                />
                <ComingSoon
                  title="Country-level website demand — coming when country sync is enabled"
                  reason="Add a country-dimension GA4 report to the ga4-sync edge function (dimensions: country, metrics: sessions/activeUsers/engagedSessions/keyEvents). Once enabled: ranked bar chart showing top source markets by sessions + engagement rate, with GSC country impressions alongside for combined signal."
                />
              </div>

              {/* 4 · CONTENT / LANDING PAGE PERFORMANCE */}
              <div>
                <SectionHeader
                  title="4 · Content · Landing Page Performance"
                  sub="Which hotel pages attract and engage potential guests"
                />
                {pageRows.length>0?(
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr>{[th('Page'),th('Sessions',true),th('Pageviews',true),th('Eng. rate',true),th('Avg Duration',true)]}</tr></thead>
                      <tbody>
                        {pageRows.slice(0,20).map((row,i)=>{
                          const path=(row.dimensionValues?.[0]?.value??'/').replace('https://www.thenamkhan.com','').replace('http://www.thenamkhan.com','')||'/';
                          const sess=Math.round(mv(row,0));
                          const views=Math.round(mv(row,1));
                          const er=mv(row,2);
                          const dur=mv(row,3);
                          return(
                            <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                              <td style={{padding:'5px 8px',fontFamily:'ui-monospace,monospace',fontSize:10,color:GREEN,maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{path}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace'}}>{fmt(sess)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmt(views)}</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:er>=0.5?GREEN:er>=0.3?AMBER:RED,fontWeight:600}}>{(er*100).toFixed(0)}%</td>
                              <td style={{padding:'5px 8px',textAlign:'right' as const,fontFamily:'ui-monospace,monospace',color:INK_F}}>{fmtDuration(dur)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{marginTop:10,fontSize:10,color:INK_F}}>
                      Pages with high sessions but low engagement rate = traffic not connecting with content. Pages with high engagement but low sessions = strong content with weak SEO or discovery.
                    </div>
                  </div>
                ):(
                  <div style={{padding:20,color:INK_F,fontSize:12}}>No page data — pull GA4 to load.</div>
                )}
              </div>

              {/* 5 · WEBSITE CONVERSION JOURNEY */}
              <div>
                <SectionHeader
                  title="5 · Website Conversion Journey"
                  sub="Where visitors move toward booking and where they drop"
                />
                <ComingSoon
                  title="Conversion funnel — requires GA4 booking engine event tracking"
                  reason="Required events: booking_engine_click · availability_search · booking_start · purchase. Once instrumented in GA4: shows the funnel from session → room page → booking engine → search → booking started → completed. This is the highest-value GA4 view for hotel commercial intelligence."
                />
              </div>

              {/* 6 · CAMPAIGN & COMMERCIAL INTENT */}
              <div>
                <SectionHeader
                  title="6 · Campaign & Commercial Intent Performance"
                  sub="Which campaigns generate booking intent, not merely traffic"
                />
                <ComingSoon
                  title="Campaign performance — requires campaign dimension sync"
                  reason="Add campaign/source/medium dimension to ga4-sync. Shows which paid campaigns, newsletter sends, and partner referrals generate booking-engine interactions vs passive browsing. Requires UTM parameters on all outbound links."
                />
              </div>
            </>
          ):(
            <div style={{padding:40,textAlign:'center' as const,color:INK_S,fontSize:12,border:`1px dashed ${HAIR}`,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <div style={{fontSize:32}}>📊</div>
              <div style={{fontSize:14,fontWeight:600,color:INK}}>No GA4 data yet</div>
              <div style={{color:INK_F,marginBottom:8}}>Pull the last 30 days from GA4</div>
              <AnalyticsPullBtn requests={GA4_REQUESTS} label="↻ Pull GA4 data" />
            </div>
          )
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* GOOGLE TRENDS                                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {isTrends&&(
          <>
            {/* Pull button + last fetch */}
            <div style={{display:'flex',gap:12,alignItems:'center',padding:'10px 14px',background:'#F4EFE2',borderRadius:6}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:INK}}>Google Trends · Search interest over time</div>
                <div style={{fontSize:11,color:INK_S,marginTop:2}}>
                  DataForSEO Google Trends API · 12-month interest (0–100 scale) · top 5 tracked keywords · US market
                </div>
              </div>
              <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center'}}>
                {trendsLastFetch&&<span style={{fontSize:10,color:INK_F,fontFamily:'ui-monospace,monospace'}}>Last fetch: {trendsLastFetch}</span>}
                <AnalyticsPullBtn requests={TRENDS_REQUESTS} label="📈 Fetch Trends" />
              </div>
            </div>

            {trendsData.length===0?(
              <div style={{padding:48,textAlign:'center' as const,border:`1px dashed ${HAIR}`,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
                <div style={{fontSize:40}}>📈</div>
                <div style={{fontSize:15,fontWeight:700,color:INK}}>No Google Trends data yet</div>
                <div style={{fontSize:12,color:INK_S,maxWidth:480,lineHeight:1.6}}>
                  Click <strong>📈 Fetch Trends</strong> above. The system will pull 12-month search interest from DataForSEO Google Trends for your top 5 ranked keywords (US market) and store them here.
                </div>
                <div style={{fontSize:11,color:INK_F,marginTop:4}}>
                  Make sure SERP tasks have been posted and fetched first (Rankings tab) — Trends pulls from your tracked keywords list.
                </div>
              </div>
            ):(
              <>
                {/* 1 · KEYWORD INTEREST OVERVIEW */}
                <div>
                  <div style={{paddingBottom:6,borderBottom:`2px solid ${HAIR}`,marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:INK}}>1 · Keyword Search Interest Overview</div>
                    <div style={{fontSize:11,color:INK_F,marginTop:2}}>12-month average interest score (0–100) · Google web search · US market</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {trendsData.map((kw,i)=>{
                      const timeline=kw.interest_timeline??[];
                      const maxVal=Math.max(...timeline.map(t=>t.val),1);
                      const barW=Math.round((kw.avg_interest??0)/maxInterest*100);
                      const intColor=(kw.avg_interest??0)>=50?GREEN:(kw.avg_interest??0)>=25?AMBER:INK_F;
                      return(
                        <div key={i} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'14px 18px',background:'#FFFFFF'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:16,alignItems:'center',marginBottom:10}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:700,color:INK,fontStyle:'italic'}}>{kw.keyword}</div>
                              {kw.peak_month&&<div style={{fontSize:10,color:INK_F,marginTop:2}}>Peak: <span style={{color:AMBER,fontWeight:600}}>{kw.peak_month}</span></div>}
                            </div>
                            <div style={{textAlign:'right' as const}}>
                              <div style={{fontSize:28,fontWeight:700,color:intColor,fontVariantNumeric:'tabular-nums',lineHeight:1}}>{kw.avg_interest??'—'}</div>
                              <div style={{fontSize:10,color:INK_F}}>avg / 100</div>
                            </div>
                          </div>
                          {/* Interest bar */}
                          <div style={{height:6,background:HAIR,borderRadius:3,marginBottom:12,overflow:'hidden'}}>
                            <div style={{height:6,width:barW+'%',background:intColor,borderRadius:3,transition:'width 0.3s'}} />
                          </div>
                          {/* 12-month sparkline */}
                          {timeline.length>0&&(
                            <div>
                              <div style={{fontSize:10,color:INK_F,marginBottom:6,fontFamily:'ui-monospace,monospace'}}>12-month trend</div>
                              <div style={{display:'flex',gap:3,alignItems:'flex-end',height:40}}>
                                {timeline.slice(-12).map((t,j)=>{
                                  const h=Math.max(3,Math.round(40*(t.val/Math.max(maxVal,1))));
                                  const col=t.val>=50?GREEN:t.val>=25?AMBER:INK_F;
                                  return(
                                    <div key={j} style={{flex:1,display:'flex',flexDirection:'column' as const,alignItems:'center',gap:2}}>
                                      <div title={`${t.date}: ${t.val}`} style={{width:'100%',borderRadius:2,background:col,opacity:0.3+0.7*(t.val/Math.max(maxVal,1)),height:h}} />
                                      <div style={{fontSize:7,color:INK_F,whiteSpace:'nowrap' as const}}>{t.date?.slice(-2)}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {/* Related queries */}
                          {kw.related_queries&&(kw.related_queries as string[]).length>0&&(
                            <div style={{marginTop:10,display:'flex',flexWrap:'wrap' as const,gap:4}}>
                              <span style={{fontSize:10,color:INK_F,marginRight:4}}>Related:</span>
                              {(kw.related_queries as string[]).slice(0,6).map((rq,j)=>(
                                <span key={j} style={{fontSize:10,padding:'2px 8px',background:'#F4EFE2',borderRadius:99,color:INK_S}}>{rq}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2 · BRAND VS NON-BRAND TREND SIGNAL */}
                <div>
                  <div style={{paddingBottom:6,borderBottom:`2px solid ${HAIR}`,marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:INK}}>2 · Brand vs Non-Brand Interest Signal</div>
                    <div style={{fontSize:11,color:INK_F,marginTop:2}}>Compare interest in brand name ("namkhan") vs destination + product keywords</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    {['Brand','Non-Brand'].map(type=>{
                      const isB=type==='Brand';
                      const kws=trendsData.filter(k=>/namkhan|nam khan/.test(k.keyword.toLowerCase())===isB);
                      const avg=kws.length>0?Math.round(kws.reduce((s,k)=>s+(k.avg_interest??0),0)/kws.length):null;
                      return(
                        <div key={type} style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 18px',background:'#FFFFFF'}}>
                          <div style={{fontSize:12,fontWeight:700,color:isB?AMBER:GREEN,marginBottom:8}}>{type} search interest</div>
                          {kws.length===0?(
                            <div style={{fontSize:11,color:INK_F}}>No {type.toLowerCase()} keywords in tracked list yet.</div>
                          ):(
                            <>
                              <div style={{fontSize:28,fontWeight:700,color:isB?AMBER:GREEN,marginBottom:4}}>{avg??'—'}<span style={{fontSize:12,fontWeight:400,color:INK_F}}>/100</span></div>
                              <div style={{fontSize:10,color:INK_F,marginBottom:10}}>Average across {kws.length} keyword{kws.length!==1?'s':''}</div>
                              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                {kws.map((k,i)=>(
                                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}>
                                    <span style={{color:INK,fontStyle:'italic'}}>{k.keyword}</span>
                                    <span style={{fontFamily:'ui-monospace,monospace',color:isB?AMBER:GREEN,fontWeight:600}}>{k.avg_interest??'—'}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{marginTop:12,padding:'10px 14px',background:'#F4EFE2',borderRadius:5,fontSize:11,color:INK_S}}>
                    A rising non-brand interest trend (destination, wellness, activities) is a leading signal for new guest demand before it appears in bookings. Brand interest confirms existing awareness.
                  </div>
                </div>

                {/* 3 · PEAK SEASON CALENDAR */}
                <div>
                  <div style={{paddingBottom:6,borderBottom:`2px solid ${HAIR}`,marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:700,color:INK}}>3 · Search Demand Seasonality</div>
                    <div style={{fontSize:11,color:INK_F,marginTop:2}}>Peak search months per keyword — useful for content and campaign timing</div>
                  </div>
                  <div style={{border:`1px solid ${HAIR}`,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr>
                        <th style={{padding:'5px 8px',textAlign:'left' as const,fontSize:10,fontWeight:600,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',borderBottom:`2px solid ${HAIR}`}}>Keyword</th>
                        <th style={{padding:'5px 8px',textAlign:'center' as const,fontSize:10,fontWeight:600,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',borderBottom:`2px solid ${HAIR}`}}>Avg Interest</th>
                        <th style={{padding:'5px 8px',textAlign:'left' as const,fontSize:10,fontWeight:600,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',borderBottom:`2px solid ${HAIR}`}}>Peak Month</th>
                        <th style={{padding:'5px 8px',textAlign:'left' as const,fontSize:10,fontWeight:600,color:INK_F,textTransform:'uppercase' as const,letterSpacing:'0.06em',borderBottom:`2px solid ${HAIR}`}}>Signal</th>
                      </tr></thead>
                      <tbody>
                        {trendsData.map((kw,i)=>{
                          const ai=kw.avg_interest??0;
                          const signal=ai>=50?'Strong demand':ai>=25?'Moderate demand':'Low / niche';
                          const sigCol=ai>=50?GREEN:ai>=25?AMBER:INK_F;
                          return(
                            <tr key={i} style={{borderBottom:`1px solid ${HAIR}`}}>
                              <td style={{padding:'6px 8px',color:INK,fontStyle:'italic'}}>{kw.keyword}</td>
                              <td style={{padding:'6px 8px',textAlign:'center' as const,fontFamily:'ui-monospace,monospace',fontWeight:700,color:sigCol}}>{kw.avg_interest??'—'}</td>
                              <td style={{padding:'6px 8px',color:AMBER,fontFamily:'ui-monospace,monospace'}}>{kw.peak_month??'—'}</td>
                              <td style={{padding:'6px 8px'}}><span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:ai>=50?'#E6F4EA':ai>=25?'#FEF3C7':'#F4F4F5',color:sigCol,fontWeight:600}}>{signal}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{marginTop:10,fontSize:10,color:INK_F}}>
                      Schedule content publishing and paid campaigns 6–8 weeks before peak search months. Google Trends search interest typically leads booking intent by 4–10 weeks.
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </DashboardPage>
  );
}
