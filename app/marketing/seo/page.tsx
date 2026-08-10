// app/marketing/seo/page.tsx
// Full 6-tab SEO area — DataForSEO pipeline (Rankings·Keywords·Competitors·Local·Technical·Overview)
import { DashboardPage, Container, type DashboardTab } from '@/app/(cockpit)/_design';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { MARKETING_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_M='#5A5A5A';const INK_F='#8A8A8A';
const GREEN='#084838';const AMBER='#C28F2C';const RED='#B03826';const BG='#FFFFFF';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RankRow { keyword_id:number; keyword:string; location_name:string;
  monthly_searches:number|null; keyword_difficulty:number|null; cpc_usd:number|null;
  snapshot_date:string|null; position:number|null; url:string|null; title:string|null;
  last_checked:string|null; prev_position:number|null; delta:number|null; }
interface SugRow { keyword:string; seed_keyword:string; monthly_searches:number|null;
  keyword_difficulty:number|null; cpc_usd:number|null; }
interface LocalRow { keyword:string; snapshot_date:string; our_position:number|null;
  result_count:number|null; items:any[]|null; }

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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function MarketingSeoPage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  const tab = searchParams?.tab ?? 'overview';
  const sb = getSupabaseAdmin();

  // Fetch data relevant to active tab (+ overview always needs rankings)
  const [rankRes, sugRes, localRes] = await Promise.all([
    sb.from('v_seo_rankings').select('*'),
    tab === 'keywords' ? sb.from('v_seo_keyword_suggestions').select('*').limit(50) : Promise.resolve({ data: [] }),
    tab === 'local' ? sb.from('v_seo_local_pack').select('*').order('snapshot_date', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
  ]);

  const rankings = (rankRes.data ?? []) as RankRow[];
  const suggestions = (sugRes.data ?? []) as SugRow[];
  const localPack = (localRes.data ?? []) as LocalRow[];

  const hasRankData = rankings.some(r => r.snapshot_date !== null);
  const withPos = rankings.filter(r => r.position !== null);
  const top3 = withPos.filter(r => (r.position ?? 99) <= 3);
  const top10 = withPos.filter(r => (r.position ?? 99) <= 10);
  const avgPos = withPos.length > 0 ? Math.round(withPos.reduce((s,r)=>s+(r.position??0),0)/withPos.length) : null;
  const totalVol = rankings.reduce((s,r)=>s+(r.monthly_searches??0),0);
  const lastSync = rankings.reduce((max:string|null,r)=>{ if(!r.last_checked)return max; return !max||r.last_checked>max?r.last_checked:max; },null);

  const marketingTabs: DashboardTab[] = MARKETING_SUBPAGES.map(s => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/marketing/seo',
  }));

  const SEO_TABS = [
    { key:'overview',   label:'Overview',     href:'?tab=overview'   },
    { key:'rankings',   label:'Rankings',     href:'?tab=rankings'   },
    { key:'keywords',   label:'Keywords',     href:'?tab=keywords'   },
    { key:'competitors',label:'Competitors',  href:'?tab=competitors'},
    { key:'local',      label:'Local Pack',   href:'?tab=local'      },
    { key:'technical',  label:'Technical',    href:'?tab=technical'  },
  ];

  return (
    <DashboardPage title="Marketing · SEO" subtitle="DataForSEO pipeline · Google organic · Laos geo" tabs={marketingTabs}>

      {/* SEO sub-tab strip */}
      <div style={{ gridColumn:'1 / -1', display:'flex', gap:0, borderBottom:'2px solid '+HAIR, marginBottom:4 }}>
        {SEO_TABS.map(t => (
          <a key={t.key} href={t.href}
            style={{ padding:'8px 16px', fontSize:12, fontWeight:600, textDecoration:'none',
              color: tab===t.key ? GREEN : INK_M,
              borderBottom: tab===t.key ? '2px solid '+GREEN : '2px solid transparent',
              marginBottom:-2, whiteSpace:'nowrap' as const }}>
            {t.label}
          </a>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div style={{ gridColumn:'1 / -1', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:8 }}>
            {[
              { l:'Keywords tracked', v:rankings.length,           fn:'Namkhan · Laos geo' },
              { l:'In top 3',         v:top3.length,               fn:hasRankData?'Google desktop':'pending', col:top3.length>0?GREEN:INK_F },
              { l:'In top 10',        v:top10.length,              fn:hasRankData?'Google desktop':'pending', col:top10.length>0?GREEN:INK_F },
              { l:'Avg position',     v:avgPos??'—',               fn:hasRankData?`${withPos.length} of ${rankings.length} ranked`:'' },
              { l:'Est. monthly vol', v:totalVol>0?`${(totalVol/1000).toFixed(1)}k`:'—', fn:'tracked keywords combined' },
              { l:'Last synced',      v:lastSync?lastSync.slice(0,10):'—', fn:'daily 06:00 UTC' },
            ].map((k,i) => (
              <div key={i} style={{ background:BG, border:'1px solid '+HAIR, borderRadius:6, padding:'12px 14px' }}>
                <div style={{ fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.13em', textTransform:'uppercase' as const, color:INK_F, marginBottom:4 }}>{k.l}</div>
                <div style={{ fontSize:24, fontWeight:700, color:k.col??INK, fontVariantNumeric:'tabular-nums', lineHeight:1 }}>{String(k.v)}</div>
                {k.fn && <div style={{ fontSize:10, color:INK_F, marginTop:4 }}>{k.fn}</div>}
              </div>
            ))}
          </div>

          {/* Top rankings summary */}
          <div style={{ gridColumn:'1 / -1' }}>
            <Container title="Top rankings" subtitle="Keywords where thenamkhan.com ranks in Google · desktop · Luang Prabang geo">
              {!hasRankData ? (
                <div style={{ padding:'32px 16px', textAlign:'center', color:INK_M }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>📡</div>
                  <div style={{ fontSize:13, fontWeight:600, color:INK }}>First fetch pending — daily at 06:00 UTC</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {withPos.slice(0,7).map(r => {
                    const pc = (r.position??99)<=3?GREEN:(r.position??99)<=10?AMBER:INK_M;
                    return (
                      <div key={r.keyword_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'7px 10px', background:BG, border:'1px solid '+HAIR, borderRadius:5, fontSize:12 }}>
                        <span style={{ fontFamily:'ui-monospace,monospace', fontWeight:700, color:pc, fontSize:16, minWidth:28, textAlign:'right' as const }}>{r.position}</span>
                        <span style={{ flex:1, color:INK, fontStyle:'italic' }}>{r.keyword}</span>
                        {r.monthly_searches != null && <span style={{ fontSize:10, color:INK_F, fontFamily:'ui-monospace,monospace' }}>{r.monthly_searches.toLocaleString()}/mo</span>}
                        {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:GREEN, fontFamily:'ui-monospace,monospace', textDecoration:'none' }}>{r.url.replace('https://www.thenamkhan.com','').slice(0,30)||'/'}</a>}
                      </div>
                    );
                  })}
                  {withPos.length > 7 && <div style={{ fontSize:11, color:INK_F, padding:'4px 10px' }}>+{withPos.length-7} more · <a href="?tab=rankings" style={{ color:GREEN }}>see all →</a></div>}
                </div>
              )}
            </Container>
          </div>

          {/* AI production loop */}
          <div style={{ gridColumn:'1 / -1' }}>
            <div style={{ fontSize:10, fontWeight:600, color:INK_F, marginBottom:8, fontFamily:'ui-monospace,monospace', letterSpacing:'0.13em', textTransform:'uppercase' as const }}>AI production loop</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))', gap:8 }}>
              {WORKFLOW.map(s => (
                <div key={s.step} style={{ background:BG, border:'1px solid '+HAIR, borderRadius:6, padding:'10px 12px' }}>
                  <div style={{ fontFamily:'ui-monospace,monospace', fontSize:10, letterSpacing:'0.16em', color:GREEN }}>{s.step}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:INK }}>{s.title}</div>
                  <div style={{ fontSize:11, color:INK_M, lineHeight:1.5, marginTop:2 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── RANKINGS TAB ─────────────────────────────────────────────────── */}
      {tab === 'rankings' && (
        <div style={{ gridColumn:'1 / -1' }}>
          <Container title="Keyword rankings" subtitle="thenamkhan.com · Google · desktop · Luang Prabang geo · daily 06:00 UTC"
            action={<span style={{ fontSize:11, color:INK_F, fontFamily:'ui-monospace,monospace' }}>{withPos.length} ranked · {rankings.length-withPos.length} outside top 30</span>}>
            {!hasRankData ? (
              <div style={{ padding:'40px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📡</div>
                <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>First fetch pending</div>
                <div style={{ fontSize:12, color:INK_M }}>Cron runs daily at 06:00 UTC</div>
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid '+HAIR }}>
                      {['Pos','Δ','Keyword','Location','Volume/mo','Difficulty','CPC','Ranked URL','Checked'].map(h=>(
                        <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600, whiteSpace:'nowrap' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map(r => {
                      const pos=r.position; const pc=pos===null?INK_F:pos<=3?GREEN:pos<=10?AMBER:INK_M;
                      const d=r.delta; const ds=d===null?'—':d>0?`↑${d}`:d<0?`↓${Math.abs(d)}`:'→';
                      const dc=d===null?INK_F:d>0?GREEN:d<0?RED:INK_M;
                      const kd=r.keyword_difficulty; const kdc=kd===null?INK_F:kd<=30?GREEN:kd<=60?AMBER:RED;
                      return (
                        <tr key={r.keyword_id} style={{ borderBottom:'1px solid '+HAIR }}>
                          <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', fontWeight:700, color:pc, fontSize:15, whiteSpace:'nowrap' as const }}>{pos??'—'}</td>
                          <td style={{ padding:'7px 8px', fontFamily:'ui-monospace,monospace', color:dc, fontSize:11, whiteSpace:'nowrap' as const }}>{ds}</td>
                          <td style={{ padding:'7px 8px', color:INK, fontStyle:'italic', maxWidth:200 }}>{r.keyword}</td>
                          <td style={{ padding:'7px 8px', color:INK_F, fontSize:11, whiteSpace:'nowrap' as const }}>{r.location_name}</td>
                          <td style={{ padding:'7px 8px', color:INK, fontFamily:'ui-monospace,monospace', fontSize:11, whiteSpace:'nowrap' as const }}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                          <td style={{ padding:'7px 8px', color:kdc, fontFamily:'ui-monospace,monospace', fontSize:11, whiteSpace:'nowrap' as const }}>{kd!=null?`${kd}%`:'—'}</td>
                          <td style={{ padding:'7px 8px', color:INK_F, fontFamily:'ui-monospace,monospace', fontSize:11, whiteSpace:'nowrap' as const }}>{r.cpc_usd!=null?`$${Number(r.cpc_usd).toFixed(2)}`:'—'}</td>
                          <td style={{ padding:'7px 8px', maxWidth:200 }}>
                            {r.url?<a href={r.url} target="_blank" rel="noopener noreferrer" title={r.title??undefined} style={{ color:GREEN, fontSize:10, textDecoration:'none', fontFamily:'ui-monospace,monospace' }}>{r.url.replace('https://','').slice(0,40)}{r.url.length>47?'…':''}</a>:<span style={{ color:INK_F, fontSize:11 }}>not in top 30</span>}
                          </td>
                          <td style={{ padding:'7px 8px', color:INK_F, fontSize:11, whiteSpace:'nowrap' as const }}>{r.last_checked?r.last_checked.slice(0,10):'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Container>
        </div>
      )}

      {/* ─── KEYWORDS TAB ─────────────────────────────────────────────────── */}
      {tab === 'keywords' && (
        <>
          <div style={{ gridColumn:'1 / -1' }}>
            <Container title="Tracked keywords" subtitle="Volume · difficulty · CPC from DataForSEO Labs (clickstream data)">
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ borderBottom:'2px solid '+HAIR }}>
                    {['Keyword','Volume/mo','Difficulty','CPC USD','Status'].map(h=>(
                      <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rankings.map(r => {
                      const kd=r.keyword_difficulty; const kdc=kd===null?INK_F:kd<=30?GREEN:kd<=60?AMBER:RED;
                      const kdLabel=kd===null?'—':kd<=30?'Easy':kd<=60?'Medium':'Hard';
                      return (
                        <tr key={r.keyword_id} style={{ borderBottom:'1px solid '+HAIR }}>
                          <td style={{ padding:'7px 8px', color:INK, fontStyle:'italic' }}>{r.keyword}</td>
                          <td style={{ padding:'7px 8px', color:INK, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                          <td style={{ padding:'7px 8px' }}>
                            {kd!=null?<span style={{ color:kdc, fontSize:11, fontFamily:'ui-monospace,monospace', fontWeight:600 }}>{kd}% · {kdLabel}</span>:<span style={{ color:INK_F, fontSize:11 }}>—</span>}
                          </td>
                          <td style={{ padding:'7px 8px', color:INK_F, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.cpc_usd!=null?`$${Number(r.cpc_usd).toFixed(2)}`:'—'}</td>
                          <td style={{ padding:'7px 8px' }}>
                            <span style={{ fontSize:10, fontFamily:'ui-monospace,monospace', color:r.position!=null?GREEN:INK_F, border:'1px solid', borderColor:r.position!=null?GREEN:HAIR, padding:'2px 6px', borderRadius:3 }}>
                              {r.position!=null?`#${r.position}`:'not ranked'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Container>
          </div>

          <div style={{ gridColumn:'1 / -1' }}>
            <Container title="Keyword suggestions" subtitle="Related keywords discovered from seed terms · DataForSEO Labs">
              {suggestions.length === 0 ? (
                <div style={{ padding:'24px 16px', textAlign:'center', color:INK_M }}>
                  <div style={{ fontSize:13, marginBottom:4 }}>Loading suggestions — first fetch running</div>
                  <div style={{ fontSize:11, color:INK_F }}>Data appears after the suggestions cron completes</div>
                </div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead><tr style={{ borderBottom:'2px solid '+HAIR }}>
                      {['Keyword','Seed','Volume/mo','Difficulty','CPC'].map(h=>(
                        <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:10, fontFamily:'ui-monospace,monospace', letterSpacing:'0.1em', textTransform:'uppercase' as const, color:INK_F, fontWeight:600 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {suggestions.map((r,i) => {
                        const kd=r.keyword_difficulty; const kdc=kd===null?INK_F:kd<=30?GREEN:kd<=60?AMBER:RED;
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid '+HAIR }}>
                            <td style={{ padding:'7px 8px', color:INK, fontStyle:'italic' }}>{r.keyword}</td>
                            <td style={{ padding:'7px 8px', color:INK_F, fontSize:10, fontFamily:'ui-monospace,monospace' }}>{r.seed_keyword}</td>
                            <td style={{ padding:'7px 8px', color:INK, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                            <td style={{ padding:'7px 8px', color:kdc, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{kd!=null?`${kd}%`:'—'}</td>
                            <td style={{ padding:'7px 8px', color:INK_F, fontFamily:'ui-monospace,monospace', fontSize:11 }}>{r.cpc_usd!=null?`$${Number(r.cpc_usd).toFixed(2)}`:'—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Container>
          </div>
        </>
      )}

      {/* ─── COMPETITORS TAB ──────────────────────────────────────────────── */}
      {tab === 'competitors' && (
        <div style={{ gridColumn:'1 / -1' }}>
          <Container title="Competitor analysis" subtitle="Who is taking the SERP slots we don't rank for">
            <div style={{ padding:'16px 0' }}>
              <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:12 }}>Tracked competitor domains</div>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8, marginBottom:24 }}>
                {['booking.com','agoda.com','tripadvisor.com','expedia.com','rosewoodhotels.com','sofitel.com','belmond.com'].map(d => (
                  <div key={d} style={{ fontSize:11, fontFamily:'ui-monospace,monospace', color:INK_M, border:'1px solid '+HAIR, padding:'4px 10px', borderRadius:4 }}>{d}</div>
                ))}
              </div>
              <div style={{ padding:'24px 16px', background:'#F9F6F0', borderRadius:6, textAlign:'center', color:INK_M, fontSize:12 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
                <div style={{ fontWeight:600, color:INK, marginBottom:4 }}>Domain Analytics fetch pending</div>
                <div style={{ fontSize:11 }}>Connect the Domain Analytics API to see which keywords competitors rank for<br/>that thenamkhan.com misses — the highest-value gap opportunities.</div>
                <div style={{ marginTop:12, fontFamily:'ui-monospace,monospace', fontSize:10, color:INK_F }}>
                  Endpoint: /v3/dataforseo_labs/google/competitors_domain/live
                </div>
              </div>
              {/* Keyword gap preview from our current data */}
              <div style={{ marginTop:24 }}>
                <div style={{ fontSize:13, fontWeight:600, color:INK, marginBottom:8 }}>Keywords we don't rank for yet (opportunities)</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {rankings.filter(r=>r.position===null).slice(0,8).map(r=>(
                    <div key={r.keyword_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'7px 10px', background:BG, border:'1px solid '+HAIR, borderRadius:5, fontSize:12 }}>
                      <span style={{ fontSize:18 }}>⚡</span>
                      <span style={{ flex:1, color:INK, fontStyle:'italic' }}>{r.keyword}</span>
                      <span style={{ fontSize:10, color:INK_F, fontFamily:'ui-monospace,monospace' }}>not in top 30</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Container>
        </div>
      )}

      {/* ─── LOCAL PACK TAB ───────────────────────────────────────────────── */}
      {tab === 'local' && (
        <div style={{ gridColumn:'1 / -1' }}>
          <Container title="Google Maps · Local pack" subtitle="Position in the local map results for hotel search queries · Luang Prabang">
            {localPack.length === 0 ? (
              <div style={{ padding:'40px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🗺️</div>
                <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>Local pack data loading</div>
                <div style={{ fontSize:12, color:INK_M }}>Fetching Google Maps results for 5 local keywords</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {localPack.map((r,i) => {
                  const pc=r.our_position===null?INK_F:r.our_position<=3?GREEN:r.our_position<=5?AMBER:RED;
                  return (
                    <div key={i} style={{ background:'#F9F6F0', borderRadius:6, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                        <span style={{ fontFamily:'ui-monospace,monospace', fontWeight:700, color:pc, fontSize:20, minWidth:36, textAlign:'center' as const }}>
                          {r.our_position!=null?`#${r.our_position}`:'—'}
                        </span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:INK, fontStyle:'italic' }}>{r.keyword}</div>
                          <div style={{ fontSize:11, color:INK_F }}>{r.result_count??0} results · {r.snapshot_date}</div>
                        </div>
                      </div>
                      {r.items && r.items.length > 0 && (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {(r.items as any[]).slice(0,3).map((it:any,j:number)=>(
                            <div key={j} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:INK_M }}>
                              <span style={{ fontFamily:'ui-monospace,monospace', minWidth:16, color:INK_F }}>#{it.pos}</span>
                              <span style={{ flex:1 }}>{it.title}</span>
                              {it.rating && <span style={{ color:AMBER }}>★ {it.rating}</span>}
                              {it.reviews && <span style={{ color:INK_F }}>({it.reviews})</span>}
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

      {/* ─── TECHNICAL TAB ────────────────────────────────────────────────── */}
      {tab === 'technical' && (
        <div style={{ gridColumn:'1 / -1' }}>
          <Container title="Technical SEO · On-page health" subtitle="thenamkhan.com · meta, titles, Core Web Vitals, page scores">
            <div style={{ padding:'32px 16px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔧</div>
              <div style={{ fontSize:14, fontWeight:600, color:INK, marginBottom:6 }}>On-page audit not yet run</div>
              <div style={{ fontSize:12, color:INK_M, marginBottom:16 }}>
                The On-Page API crawls thenamkhan.com and returns per-page scores,<br/>
                meta quality, heading structure, word count, and issue flags.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10, maxWidth:700, margin:'0 auto', textAlign:'left' as const }}>
                {[
                  { icon:'📄', title:'Page titles',  desc:'Length, duplicates, missing' },
                  { icon:'📝', title:'Meta descriptions', desc:'Length, missing, duplicates' },
                  { icon:'🔗', title:'Internal links', desc:'Broken, orphan pages' },
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
              <div style={{ marginTop:20, fontFamily:'ui-monospace,monospace', fontSize:10, color:INK_F }}>
                Endpoint: /v3/on_page/task_post · crawls up to 50 pages · runs weekly
              </div>
            </div>
          </Container>
        </div>
      )}

    </DashboardPage>
  );
}
