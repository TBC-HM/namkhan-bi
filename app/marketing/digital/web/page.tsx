// app/marketing/digital/web/page.tsx
import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import AnalyticsPullBtn from '@/components/analytics/AnalyticsPullBtn';
import TrendChart from '@/components/analytics/TrendChart';
import SourcesChart from '@/components/analytics/SourcesChart';

export const dynamic = 'force-dynamic';

const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_S='#5A5A5A';

type MetricRow={metricValues?:{value:string}[]};
type DimMetricRow={dimensionValues?:{value:string}[];metricValues?:{value:string}[]};
type GscRow={keys?:string[];clicks?:number;impressions?:number;ctr?:number;position?:number};

function mv(row:MetricRow,idx:number):number{return parseFloat(row.metricValues?.[idx]?.value??'0')||0;}
function fmt(n:number,dec=0):string{if(n>=1_000_000)return(n/1_000_000).toFixed(1)+'M';if(n>=1_000)return(n/1_000).toFixed(1)+'K';return n.toFixed(dec);}
function posColor(p:number){return p<=3?'#16A34A':p<=10?INK:'#DC2626';}

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

export default async function DigitalWebPage({searchParams}:{searchParams?:{tab?:string}}) {
  const activeTab=searchParams?.tab??'analytics';
  const cfg=DEPT_CFG.marketing;
  const tabs:DashboardTab[]=(cfg.subPages??[]).map(s=>({key:s.href,label:s.label,href:s.href,active:s.href==='/marketing/digital'}));
  const sb=getSupabaseAdmin();

  const isAnalytics=activeTab==='analytics';
  const isGsc=activeTab==='gsc';

  const [ovRes,pgRes,srcRes,trendRes,qRes,gscPgRes]=await Promise.all([
    isAnalytics?sb.from('v_ga4_reports').select('rows,totals,date_range,fetched_at').eq('report_type','overview').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isAnalytics?sb.from('v_ga4_reports').select('rows').eq('report_type','pages').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isAnalytics?sb.from('v_ga4_reports').select('rows').eq('report_type','sources').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isAnalytics?sb.from('v_ga4_reports').select('rows').eq('report_type','trend').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isGsc?sb.from('v_gsc_reports').select('rows,date_range,fetched_at').eq('report_type','queries').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    isGsc?sb.from('v_gsc_reports').select('rows').eq('report_type','pages').order('fetched_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
  ]);

  const ov=(ovRes.data?.totals??((ovRes.data?.rows as any[])?.[0]??null)) as MetricRow|null;
  const pageRows=(pgRes.data?.rows??[]) as DimMetricRow[];
  const srcRows=(srcRes.data?.rows??[]) as DimMetricRow[];
  const trendRows=(trendRes.data?.rows??[]) as DimMetricRow[];
  const qRows=(qRes.data?.rows??[]) as GscRow[];
  const gscPgRows=(gscPgRes.data?.rows??[]) as GscRow[];

  // Pre-format for charts (plain objects — safe to pass to client components)
  const trendData=trendRows.map(r=>({
    date:(r.dimensionValues?.[0]?.value??'').slice(4),
    sessions:Math.round(mv(r,0)),
    pageviews:Math.round(mv(r,1)),
  }));
  const sourcesData=srcRows.slice(0,8).map(r=>({
    source:((r.dimensionValues?.[0]?.value??'')+' / '+(r.dimensionValues?.[1]?.value??'')).slice(0,28),
    sessions:Math.round(mv(r,0)),
  }));

  const kpis=ov?[
    {label:'Sessions',value:fmt(mv(ov,0))},
    {label:'Users',value:fmt(mv(ov,1))},
    {label:'New Users',value:fmt(mv(ov,2))},
    {label:'Pageviews',value:fmt(mv(ov,3))},
    {label:'Engagement',value:(mv(ov,4)*100).toFixed(1)+'%'},
    {label:'Bounce Rate',value:(mv(ov,6)*100).toFixed(1)+'%'},
  ]:[];

  const totalClicks=qRows.reduce((s,r)=>s+(r.clicks??0),0);
  const totalImpr=qRows.reduce((s,r)=>s+(r.impressions??0),0);
  const avgCtr=qRows.length?qRows.reduce((s,r)=>s+(r.ctr??0),0)/qRows.length:0;
  const avgPos=qRows.length?qRows.reduce((s,r)=>s+(r.position??0),0)/qRows.length:0;

  const th=(label:string,right=false)=>(
    <th key={label} style={{padding:'4px 8px',textAlign:right?'right':'left',fontSize:10,fontWeight:600,color:INK_S,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{label}</th>
  );

  const SUBTABS=[{key:'analytics',label:'GA4 Analytics'},{key:'gsc',label:'Search Console'}];

  return (
    <DashboardPage title="Marketing · Analytics" subtitle="thenamkhan.com — website performance" tabs={tabs}>
      <div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:20}}>

        {/* Sub-tab nav */}
        <div style={{display:'flex',gap:0,borderBottom:'2px solid '+HAIR,marginBottom:4}}>
          {SUBTABS.map(t=>(
            <a key={t.key} href={'?tab='+t.key} style={{
              padding:'8px 20px',fontSize:13,fontWeight:600,textDecoration:'none',
              color:activeTab===t.key?'#084838':INK_S,
              borderBottom:activeTab===t.key?'2px solid #084838':'2px solid transparent',
              marginBottom:-2,whiteSpace:'nowrap' as const,
            }}>{t.label}</a>
          ))}
          <span style={{marginLeft:'auto',display:'flex',alignItems:'center',paddingBottom:8}}>
            {isAnalytics&&<AnalyticsPullBtn requests={GA4_REQUESTS} label="↻ Pull GA4" variant="secondary" />}
            {isGsc&&<AnalyticsPullBtn requests={GSC_REQUESTS} label="↻ Pull GSC" variant="secondary" />}
          </span>
        </div>

        {/* ── GA4 Analytics ── */}
        {isAnalytics&&(
          kpis.length>0?(
            <>
              {/* KPI strip */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8}}>
                {kpis.map(k=>(
                  <div key={k.label} style={{border:'1px solid '+HAIR,borderRadius:6,padding:'12px 14px',background:'#FFFFFF'}}>
                    <div style={{fontSize:22,fontWeight:700,color:INK}}>{k.value}</div>
                    <div style={{fontSize:10,color:INK_S,marginTop:2,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
                <div style={{border:'1px solid '+HAIR,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                  <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Sessions vs Pageviews — 30 days</div>
                  <TrendChart data={trendData} />
                </div>
                <div style={{border:'1px solid '+HAIR,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                  <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Traffic sources</div>
                  <SourcesChart data={sourcesData} />
                </div>
              </div>

              {/* Top pages */}
              {pageRows.length>0&&(
                <div style={{border:'1px solid '+HAIR,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                  <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Top pages</div>
                  <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                    <thead><tr style={{borderBottom:'1px solid '+HAIR}}>{[th('Page'),th('Sessions',true),th('Views',true),th('Engagement',true),th('Avg Duration',true)]}</tr></thead>
                    <tbody>
                      {pageRows.slice(0,15).map((row,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid '+HAIR}}>
                          <td style={{padding:'5px 8px',color:INK,fontFamily:'monospace',fontSize:11}}>{row.dimensionValues?.[0]?.value??'-'}</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{fmt(mv(row,0))}</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{fmt(mv(row,1))}</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{(mv(row,2)*100).toFixed(1)}%</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{fmt(mv(row,3)/60,1)}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ):(
            <div style={{padding:32,textAlign:'center',color:INK_S,fontSize:12,border:'1px dashed '+HAIR,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <span>No GA4 data yet — click to pull the last 30 days</span>
              <AnalyticsPullBtn requests={GA4_REQUESTS} label="↻ Pull GA4 data" />
            </div>
          )
        )}

        {/* ── Search Console ── */}
        {isGsc&&(
          qRows.length>0?(
            <>
              {/* GSC KPI strip */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {[
                  {label:'Total Clicks',value:fmt(totalClicks)},
                  {label:'Impressions',value:fmt(totalImpr)},
                  {label:'Avg CTR',value:(avgCtr*100).toFixed(1)+'%'},
                  {label:'Avg Position',value:'#'+Math.round(avgPos)},
                ].map(k=>(
                  <div key={k.label} style={{border:'1px solid '+HAIR,borderRadius:6,padding:'12px 14px',background:'#FFFFFF'}}>
                    <div style={{fontSize:22,fontWeight:700,color:INK}}>{k.value}</div>
                    <div style={{fontSize:10,color:INK_S,marginTop:2,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Queries + Pages side by side */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div style={{border:'1px solid '+HAIR,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                  <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Top queries</div>
                  <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                    <thead><tr style={{borderBottom:'1px solid '+HAIR}}>{[th('Query'),th('Clicks',true),th('Impr.',true),th('CTR',true),th('Pos.',true)]}</tr></thead>
                    <tbody>
                      {qRows.slice(0,20).map((row,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid '+HAIR}}>
                          <td style={{padding:'5px 8px',color:INK}}>{row.keys?.[0]??'-'}</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{row.clicks??0}</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{fmt(row.impressions??0)}</td>
                          <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{((row.ctr??0)*100).toFixed(1)}%</td>
                          <td style={{padding:'5px 8px',textAlign:'right',color:posColor(row.position??99),fontWeight:(row.position??99)<=10?600:400}}>
                            {'#'+Math.round(row.position??0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {gscPgRows.length>0&&(
                  <div style={{border:'1px solid '+HAIR,borderRadius:6,padding:'16px 20px',background:'#FFFFFF'}}>
                    <div style={{fontSize:11,fontWeight:600,color:INK,marginBottom:12}}>Top pages (search)</div>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
                      <thead><tr style={{borderBottom:'1px solid '+HAIR}}>{[th('Page'),th('Clicks',true),th('Impr.',true),th('Pos.',true)]}</tr></thead>
                      <tbody>
                        {gscPgRows.slice(0,15).map((row,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid '+HAIR}}>
                            <td style={{padding:'5px 8px',color:INK,fontFamily:'monospace',fontSize:10}}>
                              {(row.keys?.[0]??'/').replace('https://www.thenamkhan.com','')}
                            </td>
                            <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{row.clicks??0}</td>
                            <td style={{padding:'5px 8px',color:INK,textAlign:'right'}}>{fmt(row.impressions??0)}</td>
                            <td style={{padding:'5px 8px',textAlign:'right',color:posColor(row.position??99),fontWeight:(row.position??99)<=10?600:400}}>
                              {'#'+Math.round(row.position??0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ):(
            <div style={{padding:32,textAlign:'center',color:INK_S,fontSize:12,border:'1px dashed '+HAIR,borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
              <span>No Search Console data — add service account to GSC, then pull</span>
              <AnalyticsPullBtn requests={GSC_REQUESTS} label="↻ Pull GSC data" />
            </div>
          )
        )}

      </div>
    </DashboardPage>
  );
}
