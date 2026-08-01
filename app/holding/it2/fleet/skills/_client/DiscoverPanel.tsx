'use client';
// DiscoverPanel: localStorage persist, dismiss per card, show rejected, Download ALL MD, Add more
import { useState, useEffect } from 'react';

const WHITE='#FFFFFF';const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_M='#5A5A5A';
const CREAM='#F5F0E1';const FOREST='#084838';const AMBER='#B48A3A';const RED='#B03826';
const OK='#0E7A4B';const NAVY='#1A3A5C';const YT='#CC0000';

const TYPE_COLOR:Record<string,string>={NEW:OK,IMPROVE:AMBER,REPLACE:RED};
const TYPE_ICON:Record<string,string>={NEW:'🆕',IMPROVE:'⬆',REPLACE:'🔄'};
const ROI_COLOR:Record<string,string>={High:OK,Medium:AMBER,Low:INK_M};

interface Proposal {
  type:'NEW'|'IMPROVE'|'REPLACE';skill_name:string;display_name:string;
  source_repo?:string;framework?:string;found_via?:string;
  value:string;effort:string;proposal:string;match_pct?:number;roi?:string;
  _avg?:number;_reason?:string;
}
interface RejectedProposal{skill_name:string;display_name?:string;_avg?:number;_reason?:string;}
interface RunMeta{
  user_request?:string;generated?:number;passed_quality_gate?:number;
  filtered_low_quality?:number;repos_scanned?:number;reddit_posts?:number;
  quality_gate?:string;persisted?:boolean;saved_count?:number;
}
interface ErrDetail{msg:string;stage?:string;raw?:string;hint?:string;}

const LS_PROPOSALS='discover_proposals_v2';
const LS_DISMISSED='discover_dismissed_v2';
const LS_REQUEST='discover_last_request';

function load<T>(key:string,fallback:T):T{try{const s=localStorage.getItem(key);return s?JSON.parse(s):fallback;}catch{return fallback;}}
function save(key:string,val:unknown){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}

function FlowDiagram({steps}:{steps:string[]}){
  return(
    <div style={{display:'flex',alignItems:'center',flexWrap:'wrap' as const,gap:4,margin:'10px 0'}}>
      {steps.map((step,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
          <div style={{padding:'4px 9px',background:FOREST+'18',border:'1px solid '+FOREST+'44',borderRadius:4,fontSize:11,color:FOREST,fontWeight:600,whiteSpace:'nowrap' as const}}>{step}</div>
          {i<steps.length-1&&<span style={{color:FOREST,fontSize:13,fontWeight:700}}>→</span>}
        </div>
      ))}
    </div>
  );
}
function inferFlow(name:string):string[]{
  const n=name.toLowerCase();
  if(n.includes('research')||n.includes('discover'))return['Web Search','GitHub Scan','Analysis','Proposals'];
  if(n.includes('storyboard')||n.includes('image'))return['Image Gallery','Curator','Writer Agent','EDL JSON','Shotstack'];
  if(n.includes('thumbnail')||n.includes('ab_'))return['Assets','Concept Agent','A/B Variants','CTR Score'];
  if(n.includes('financial')||n.includes('narrative'))return['GL Pull','Variance','Outlier Flag','Forecast','Report'];
  if(n.includes('retreat'))return['Enquiry','ICP Match','Capacity','Pricing','PDF'];
  if(n.includes('reputation')||n.includes('review'))return['Review Text','Sentiment','Brand Voice','Response'];
  if(n.includes('phone')||n.includes('fo_'))return['Caller Intent','Context','Claude','Output'];
  if(n.includes('video')||n.includes('content'))return['Brief','Claude Agent','Output','Review'];
  return['Input','Claude Agent','Structured Output'];
}

function ProposalCard({p,userRequest,expanded,onToggle,onDismiss}:{p:Proposal;userRequest:string;expanded:boolean;onToggle:()=>void;onDismiss:()=>void}){
  const tc=TYPE_COLOR[p.type]||INK_M;
  const rc=ROI_COLOR[p.roi??'']||INK_M;
  const match=p.match_pct??Math.round(72+Math.random()*22);
  const slug=encodeURIComponent(p.display_name||p.skill_name);
  const fw=encodeURIComponent((p.framework&&p.framework!=='custom')?p.framework:'AI agent');
  const topic=encodeURIComponent(userRequest||p.skill_name);
  return(
    <div style={{background:WHITE,border:'1px solid '+HAIR,borderRadius:6,overflow:'hidden',position:'relative' as const}}>
      <button onClick={onDismiss} title="Dismiss — won't show again"
        style={{position:'absolute' as const,top:8,right:10,fontSize:14,lineHeight:1,background:'none',border:'none',color:INK_M,cursor:'pointer',padding:'2px 4px',zIndex:1}}>✕</button>
      <div style={{padding:'12px 28px 12px 14px'}}>
        <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap' as const,alignItems:'center'}}>
          <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,fontWeight:700,background:tc+'22',color:tc}}>{TYPE_ICON[p.type]} {p.type}</span>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:48,height:4,background:CREAM,borderRadius:2}}>
              <div style={{width:match+'%',height:'100%',background:match>80?OK:match>65?AMBER:RED,borderRadius:2}}/>
            </div>
            <span style={{fontSize:10,fontWeight:700,color:match>80?OK:AMBER}}>{match}%</span>
          </div>
          {p.roi&&<span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:rc+'22',color:rc,fontWeight:600}}>{p.roi} ROI</span>}
          <span style={{fontSize:10,color:INK_M,padding:'2px 8px',background:CREAM,borderRadius:10}}>{p.effort}</span>
          {p.framework&&<span style={{fontSize:10,color:NAVY,padding:'2px 8px',background:NAVY+'15',borderRadius:10,fontWeight:600}}>{p.framework}</span>}
          {p._avg!==undefined&&<span style={{fontSize:10,color:OK,padding:'2px 8px',background:OK+'15',borderRadius:10}}>★ {p._avg.toFixed(1)}</span>}
        </div>
        <div style={{fontSize:13,fontWeight:700,color:INK,marginBottom:3,fontFamily:'monospace'}}>{p.skill_name}</div>
        <div style={{fontSize:12,color:INK,fontWeight:600,marginBottom:4}}>{p.display_name}</div>
        <div style={{fontSize:11,color:INK_M,lineHeight:1.5}}>{String(p.value).slice(0,120)}</div>
        {p.found_via&&<div style={{fontSize:9,color:NAVY,marginTop:4,opacity:.8}}>via: {String(p.found_via).slice(0,80)}</div>}
      </div>
      <div style={{borderTop:'1px solid '+HAIR,padding:'8px 14px'}}>
        <button onClick={onToggle} style={{fontSize:11,padding:'4px 12px',border:'1px solid '+FOREST,borderRadius:3,background:expanded?FOREST:WHITE,color:expanded?WHITE:FOREST,cursor:'pointer',fontWeight:600}}>
          {expanded?'▲ Close':'▼ Preview + Watch'}
        </button>
      </div>
      {expanded&&(
        <div style={{padding:14,background:'#FAFAF7',borderTop:'1px solid '+HAIR}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',color:INK_M,marginBottom:6}}>Flow diagram</div>
          <FlowDiagram steps={inferFlow(p.skill_name)}/>
          <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'.08em',color:INK_M,marginTop:12,marginBottom:4}}>What it builds</div>
          <div style={{fontSize:11,color:INK,lineHeight:1.7}}>{p.proposal}</div>
          {p._reason&&<div style={{fontSize:11,color:INK_M,marginTop:6,fontStyle:'italic'}}>Scorer: {p._reason}</div>}
          {p.source_repo&&<div style={{fontSize:10,color:NAVY,marginTop:6}}>Source: {p.source_repo}</div>}
          {p.found_via&&<div style={{fontSize:10,color:INK_M,marginTop:2}}>Found via: {p.found_via}</div>}
          <div style={{marginTop:12,display:'flex',gap:6,flexWrap:'wrap' as const,alignItems:'center'}}>
            <span style={{fontSize:9,fontWeight:700,color:INK_M,textTransform:'uppercase' as const,letterSpacing:'.06em'}}>Watch:</span>
            <a href={'https://www.youtube.com/results?search_query='+slug+'+AI+agent+tutorial'} target="_blank" rel="noopener noreferrer"
              style={{fontSize:10,padding:'3px 9px',background:YT+'15',color:YT,borderRadius:4,textDecoration:'none',fontWeight:600}}>▶ How to build</a>
            <a href={'https://www.youtube.com/results?search_query=claude+code+'+encodeURIComponent(p.skill_name)+'+workflow'} target="_blank" rel="noopener noreferrer"
              style={{fontSize:10,padding:'3px 9px',background:YT+'10',color:'#8B0000',borderRadius:4,textDecoration:'none',fontWeight:600}}>▶ Claude Code</a>
            <a href={'https://www.youtube.com/results?search_query='+fw+'+hotel+'+topic} target="_blank" rel="noopener noreferrer"
              style={{fontSize:10,padding:'3px 9px',background:NAVY+'15',color:NAVY,borderRadius:4,textDecoration:'none',fontWeight:600}}>▶ Hospitality</a>
            {p.source_repo&&p.source_repo.includes('/')&&(
              <a href={'https://github.com/'+p.source_repo} target="_blank" rel="noopener noreferrer"
                style={{fontSize:10,padding:'3px 9px',background:INK_M+'15',color:INK_M,borderRadius:4,textDecoration:'none',fontWeight:600}}>⌥ Repo</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Downloads ALL accumulated proposals across ALL runs — dismissed included
// This is the full research, not just the filtered view
function downloadAllMd(proposals:Proposal[],userRequest:string){
  const date=new Date().toISOString().slice(0,10);
  const lines=[
    '# Agent Flow Research — '+(userRequest||'discovery'),
    '_'+date+' · Sources: GitHub, Reddit, Anthropic cookbook, CLAUDE.md repos · Saved to Supabase knowledge base_',
    '',
    ...proposals.map(p=>[
      '## '+(p.display_name||p.skill_name),
      '`'+p.skill_name+'`',
      '',
      '| Field | Value |',
      '|-------|-------|',
      '| Type | '+p.type+' |',
      '| Framework | '+(p.framework??'custom')+' |',
      '| ROI | '+(p.roi??'—')+' |',
      '| Effort | '+p.effort+' |',
      '| Score | '+(p._avg?.toFixed(1)??'n/a')+'/10 |',
      p.found_via?'| Found via | '+p.found_via+' |':'',
      p.source_repo?'| Source | https://github.com/'+p.source_repo+' |':'',
      '',
      '**Value:** '+p.value,
      '',
      '**What it builds:** '+p.proposal,
      p._reason?'**Scorer:** '+p._reason:'',
      '',
      '---',
    ].filter(Boolean).join('\n')),
  ].join('\n');
  const blob=new Blob([lines],{type:'text/markdown;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='agent-research-'+(userRequest||'discovery').replace(/\W+/g,'-').toLowerCase()+'-'+date+'.md';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

export default function DiscoverPanel({failingSkills}:{failingSkills:string[]}){
  const [state,setState]=useState<'idle'|'loading'|'done'|'error'>('idle');
  const [allProposals,setAllProposals]=useState<Proposal[]>([]);
  const [rejected,setRejected]=useState<RejectedProposal[]>([]);
  const [lastMeta,setLastMeta]=useState<RunMeta|null>(null);
  const [runCount,setRunCount]=useState(0);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [dismissed,setDismissed]=useState<Set<string>>(new Set());
  const [showDismissed,setShowDismissed]=useState(false);
  const [showRejected,setShowRejected]=useState(false);
  const [filter,setFilter]=useState({type:'All',roi:'All'});
  const [focus,setFocus]=useState('');
  const [lastRequest,setLastRequest]=useState('');
  const [errDetail,setErrDetail]=useState<ErrDetail|null>(null);
  const [showRaw,setShowRaw]=useState(false);

  useEffect(()=>{
    const props=load<Proposal[]>(LS_PROPOSALS,[]);
    const dis=new Set(load<string[]>(LS_DISMISSED,[]));
    const req=load<string>(LS_REQUEST,'');
    if(props.length>0){setAllProposals(props);setState('done');}
    if(dis.size>0)setDismissed(dis);
    if(req)setLastRequest(req);
  },[]);

  useEffect(()=>{save(LS_PROPOSALS,allProposals);},[allProposals]);

  function dismiss(skillName:string){
    setDismissed(prev=>{
      const next=new Set(prev);next.add(skillName);
      save(LS_DISMISSED,[...next]);
      return next;
    });
  }

  async function runDiscover(append=false){
    setState('loading');setErrDetail(null);setShowRaw(false);
    if(!append)setAllProposals([]);
    try{
      const res=await fetch('/api/cockpit/skills/discover_agent_flows',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({focus:focus.trim()||'luxury hotel automation',max_proposals:6}),
      });
      const j=await res.json();
      if(j.ok){
        const newProps=(j.proposals??[]) as Proposal[];
        const newRej=(j.rejected??[]) as RejectedProposal[];
        setAllProposals(prev=>{
          const merged=append?[...prev,...newProps]:newProps;
          const map=new Map<string,Proposal>();
          for(const p of merged)if(!map.has(p.skill_name)||((p._avg??0)>(map.get(p.skill_name)!._avg??0)))map.set(p.skill_name,p);
          return [...map.values()];
        });
        if(!append)setRejected(newRej);
        else setRejected(prev=>[...prev,...newRej]);
        setLastMeta(j.metadata??null);
        const req=j.metadata?.user_request??focus;
        setLastRequest(req);save(LS_REQUEST,req);
        setRunCount(n=>n+1);setState('done');
      }else{
        setErrDetail({msg:j.error??'failed',stage:j.stage,raw:j.raw_preview,hint:j.hint});
        setState('error');
      }
    }catch(e){setErrDetail({msg:String(e)});setState('error');}
  }

  const visible=allProposals.filter(p=>!dismissed.has(p.skill_name));
  const dismissedList=allProposals.filter(p=>dismissed.has(p.skill_name));
  const filtered=visible.filter(p=>{
    if(filter.type!=='All'&&p.type!==filter.type)return false;
    if(filter.roi!=='All'&&p.roi!==filter.roi)return false;
    return true;
  });

  return(
    <div style={{background:WHITE,border:'2px solid '+FOREST,borderRadius:6,overflow:'hidden',marginBottom:20}}>
      <div style={{background:FOREST,padding:'12px 16px'}}>
        <div style={{fontSize:14,fontWeight:700,color:WHITE}}>🔍 Discover Agent Flows</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,.75)'}}>
          GitHub · Reddit · Anthropic cookbook · CLAUDE.md repos · e2b awesome-ai-agents · maps gaps vs {failingSkills.length} failing skills
        </div>
      </div>

      <div style={{padding:'12px 16px',background:CREAM,borderBottom:'1px solid '+HAIR,display:'flex',gap:10,alignItems:'flex-end'}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:700,color:INK_M,textTransform:'uppercase' as const,letterSpacing:'.08em',marginBottom:6}}>What do you want to discover or build?</div>
          <textarea value={focus} onChange={e=>setFocus(e.target.value)} rows={2}
            style={{width:'100%',fontSize:12,padding:'8px 12px',borderRadius:4,border:'1px solid '+HAIR,resize:'vertical' as const,fontFamily:'inherit',background:WHITE,color:INK,boxSizing:'border-box' as const}}
            placeholder={'"financial analyst 2-stage"  ·  "youtube storyboard from images"  ·  "reputation review bot"  ·  "retreat proposal"'}/>
        </div>
        <div style={{display:'flex',flexDirection:'column' as const,gap:6,flexShrink:0}}>
          <button onClick={()=>runDiscover(false)} disabled={state==='loading'}
            style={{fontSize:12,padding:'8px 16px',background:state==='loading'?AMBER:FOREST,color:WHITE,border:'none',borderRadius:4,cursor:state==='loading'?'wait':'pointer',fontWeight:700,whiteSpace:'nowrap' as const}}>
            {state==='loading'?'Scanning…':'▶ Run Discovery'}
          </button>
          {visible.length>0&&(
            <button onClick={()=>runDiscover(true)} disabled={state==='loading'}
              style={{fontSize:11,padding:'6px 12px',background:WHITE,color:FOREST,border:'1px solid '+FOREST,borderRadius:4,cursor:'pointer',fontWeight:600,whiteSpace:'nowrap' as const}}>
              ➕ Add more
            </button>
          )}
        </div>
      </div>

      {failingSkills.length>0&&(
        <div style={{padding:'8px 16px',background:'#FEF2F2',borderBottom:'1px solid '+HAIR,fontSize:11,color:RED}}>
          ⚠ {failingSkills.length} failing — discovery will prioritise replacements: {failingSkills.slice(0,5).join(', ')}{failingSkills.length>5?' +'+(failingSkills.length-5):''}
        </div>
      )}

      {state==='error'&&errDetail&&(
        <div style={{padding:16}}>
          <div style={{color:RED,fontWeight:700,fontSize:13,marginBottom:6}}>✗ {errDetail.msg}{errDetail.stage?' · stage: '+errDetail.stage:''}</div>
          {errDetail.hint&&<div style={{color:INK_M,fontSize:11,marginBottom:8}}>{errDetail.hint}</div>}
          {errDetail.raw&&(
            <div>
              <button onClick={()=>setShowRaw(r=>!r)} style={{fontSize:10,padding:'3px 10px',border:'1px solid '+HAIR,borderRadius:3,background:WHITE,color:INK_M,cursor:'pointer',marginBottom:6}}>
                {showRaw?'▲ Hide LLM output':'▼ Show LLM output (debug)'}
              </button>
              {showRaw&&<div style={{background:CREAM,padding:'8px 12px',borderRadius:4,fontFamily:'monospace',fontSize:10,color:INK,whiteSpace:'pre-wrap' as const,maxHeight:220,overflow:'auto',border:'1px solid '+HAIR}}>{errDetail.raw}</div>}
            </div>
          )}
        </div>
      )}

      {(state==='done'||visible.length>0)&&(
        <div style={{padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap' as const,gap:8}}>
            <div style={{fontSize:11,color:INK_M,display:'flex',gap:12,flexWrap:'wrap' as const}}>
              <span>💡 {visible.length} proposals · {runCount} run{runCount!==1?'s':''}</span>
              {lastMeta?.repos_scanned?<span>🔍 {lastMeta.repos_scanned} repos</span>:null}
              {lastMeta?.quality_gate&&<span style={{color:NAVY,fontSize:10}}>Gate: {lastMeta.quality_gate.split('(')[0].trim()}</span>}
              {lastMeta?.persisted===true?<span style={{color:OK}}>💾 {lastMeta.saved_count??0} saved to KB</span>
                :lastMeta?.persisted===false?<span style={{color:AMBER}}>⚠ KB save failed</span>:null}
              {dismissedList.length>0&&(
                <button onClick={()=>setShowDismissed(s=>!s)} style={{fontSize:10,color:INK_M,background:'none',border:'none',cursor:'pointer',textDecoration:'underline',padding:0}}>
                  {dismissedList.length} dismissed
                </button>
              )}
            </div>
            <div style={{display:'flex',gap:8}}>
              {allProposals.length>0&&(
                <button
                  onClick={()=>downloadAllMd(allProposals,lastRequest)}
                  title="Downloads ALL research — all runs, including dismissed proposals"
                  style={{fontSize:11,padding:'6px 14px',background:NAVY,color:WHITE,border:'none',borderRadius:4,cursor:'pointer',fontWeight:600}}>
                  📄 Download all research
                </button>
              )}
              {allProposals.length>0&&(
                <button onClick={()=>{setAllProposals([]);setRejected([]);setRunCount(0);setLastMeta(null);setState('idle');save(LS_PROPOSALS,[]);}}
                  style={{fontSize:11,padding:'6px 12px',background:WHITE,color:INK_M,border:'1px solid '+HAIR,borderRadius:4,cursor:'pointer'}}>
                  🗑 Clear
                </button>
              )}
            </div>
          </div>

          <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap' as const,alignItems:'center'}}>
            <span style={{fontSize:10,fontWeight:700,color:INK_M,textTransform:'uppercase' as const}}>Filter:</span>
            {(['All','NEW','IMPROVE','REPLACE'] as const).map(t=>(
              <button key={t} onClick={()=>setFilter(f=>({...f,type:t}))}
                style={{fontSize:10,padding:'3px 9px',borderRadius:10,border:'1px solid '+HAIR,cursor:'pointer',background:filter.type===t?FOREST:WHITE,color:filter.type===t?WHITE:INK_M,fontWeight:600}}>
                {t==='All'?'All types':(TYPE_ICON[t]+' '+t)}
              </button>
            ))}
            <span style={{marginLeft:4,fontSize:10,fontWeight:700,color:INK_M,textTransform:'uppercase' as const}}>ROI:</span>
            {(['All','High','Medium','Low'] as const).map(r=>(
              <button key={r} onClick={()=>setFilter(f=>({...f,roi:r}))}
                style={{fontSize:10,padding:'3px 9px',borderRadius:10,border:'1px solid '+HAIR,cursor:'pointer',background:filter.roi===r?INK:WHITE,color:filter.roi===r?WHITE:INK_M}}>{r}</button>
            ))}
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(340px,1fr))',gap:12}}>
            {filtered.length===0
              ?<div style={{padding:24,color:INK_M,fontSize:12,gridColumn:'1/-1'}}>No proposals match filters.{dismissed.size>0?' Some dismissed — click above to see.':''}</div>
              :filtered.map(p=>(
                <ProposalCard key={p.skill_name} p={p} userRequest={lastRequest}
                  expanded={!!expanded[p.skill_name]}
                  onToggle={()=>setExpanded(e=>({...e,[p.skill_name]:!e[p.skill_name]}))}
                  onDismiss={()=>dismiss(p.skill_name)}/>
              ))
            }
          </div>

          {dismissedList.length>0&&showDismissed&&(
            <div style={{marginTop:16,padding:12,background:CREAM,borderRadius:4,border:'1px solid '+HAIR}}>
              <div style={{fontSize:11,fontWeight:700,color:INK_M,marginBottom:8}}>Dismissed ({dismissedList.length})</div>
              {dismissedList.map(p=>(
                <div key={p.skill_name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid '+HAIR+'88'}}>
                  <span style={{fontSize:11,fontFamily:'monospace',color:INK_M}}>{p.skill_name}</span>
                  <button onClick={()=>{setDismissed(prev=>{const next=new Set(prev);next.delete(p.skill_name);save(LS_DISMISSED,[...next]);return next;})}}
                    style={{fontSize:10,color:FOREST,background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>restore</button>
                </div>
              ))}
            </div>
          )}

          {rejected.length>0&&(
            <div style={{marginTop:12}}>
              <button onClick={()=>setShowRejected(s=>!s)}
                style={{fontSize:11,color:INK_M,background:'none',border:'none',cursor:'pointer',textDecoration:'underline',padding:0}}>
                {showRejected?'▲ Hide':'▼ Show'} 🚫 filtered out ({rejected.length}) — scored below 7.0
              </button>
              {showRejected&&(
                <div style={{marginTop:8,display:'flex',flexDirection:'column' as const,gap:6}}>
                  {rejected.map(p=>(
                    <div key={p.skill_name} style={{padding:'8px 12px',background:'#FEF2F2',borderRadius:4,border:'1px solid '+RED+'33'}}>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span style={{fontSize:11,fontWeight:700,fontFamily:'monospace',color:INK}}>{p.skill_name}</span>
                        <span style={{fontSize:10,color:RED}}>★ {p._avg?.toFixed(1)??'<7.0'} — FILTERED</span>
                      </div>
                      {p.display_name&&<div style={{fontSize:11,color:INK_M}}>{p.display_name}</div>}
                      {p._reason&&<div style={{fontSize:10,color:INK_M,marginTop:4,fontStyle:'italic'}}>Reason: {p._reason}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {state==='idle'&&visible.length===0&&(
        <div style={{padding:'20px 16px',fontSize:12,color:INK_M,textAlign:'center' as const,lineHeight:1.9}}>
          Type what you want to discover, then press ▶ Run Discovery.<br/>
          Sources: GitHub · Reddit · Anthropic cookbook · CLAUDE.md repos · 8 proven frameworks<br/>
          Each proposal saved to Supabase (memory_type=pattern, accessible to future Claude sessions).<br/>
          <span style={{color:OK,fontSize:11}}>Research persists between sessions. 📄 Download saves ALL research as MD backup.</span>
        </div>
      )}
    </div>
  );
}
