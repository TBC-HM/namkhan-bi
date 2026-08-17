'use client';
import { useState } from 'react';

const GREEN='#084838';const AMBER='#C28F2C';const RED='#B03826';
const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_M='#5A5A5A';const INK_F='#8A8A8A';

interface IssueFlags { title_too_long:boolean;title_too_short:boolean;meta_too_long:boolean;meta_missing:boolean;h1_missing:boolean;readability_low:boolean;thin_content:boolean; }
interface CrawlResult { title:string;h1:string;h2s:string[];word_count:number;readability:number;title_length:number;issues:IssueFlags; }

function Pill({bad,label}:{bad:boolean;label:string}) {
  if (!bad) return null;
  return <span style={{fontSize:10,padding:'2px 7px',borderRadius:99,background:'#FEE2E2',color:RED,marginRight:4}}>{label}</span>;
}

export default function SeoInstantCrawl({ propertyId }: { propertyId: number }) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'idle'|'running'|'done'|'error'>('idle');
  const [result, setResult] = useState<CrawlResult|null>(null);
  const [errMsg, setErrMsg] = useState('');

  const crawl = async () => {
    if (!url.startsWith('http')) return;
    setState('running'); setResult(null); setErrMsg('');
    try {
      const res = await fetch('/api/marketing/seo/trigger', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:'instant',url,property_id:propertyId}),
      });
      const j = await res.json();
      if (j.ok) { setState('done'); setResult(j.result); }
      else { setState('error'); setErrMsg(j.result?.error??'Failed'); }
    } catch(e:any) { setState('error'); setErrMsg(e.message); }
  };

  const col = (v:number,ok:number,warn=ok*0.8) => v>=ok?GREEN:v>=warn?AMBER:RED;

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
        <input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&crawl()}
          placeholder="https://www.thenamkhan.com/retreats"
          style={{flex:1,padding:'8px 12px',border:`1px solid ${HAIR}`,borderRadius:5,fontSize:12,fontFamily:'ui-monospace,monospace',color:INK,outline:'none'}} />
        <button onClick={crawl} disabled={state==='running'||!url.startsWith('http')}
          style={{padding:'8px 16px',background:state==='running'?AMBER:GREEN,color:'#fff',border:'none',borderRadius:5,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap' as const}}>
          {state==='running'?'⏳ Crawling…':state==='done'?'✓ Done':'🔍 Crawl page'}
        </button>
      </div>
      {state==='error'&&<div style={{fontSize:12,color:RED,marginBottom:8}}>Error: {errMsg}</div>}
      {result&&(
        <div style={{background:'#F9F6F0',borderRadius:6,padding:'16px'}}>
          <div style={{marginBottom:10}}>
            <Pill bad={result.issues.title_too_long} label="Title too long (>60)" />
            <Pill bad={result.issues.title_too_short} label="Title too short (<35)" />
            <Pill bad={result.issues.h1_missing} label="H1 missing" />
            <Pill bad={result.issues.readability_low} label="Low readability (<60)" />
            <Pill bad={result.issues.thin_content} label="Thin content (<600 words)" />
            <Pill bad={result.issues.meta_missing} label="Meta missing" />
            <Pill bad={result.issues.meta_too_long} label="Meta too long" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
            {([['Title',`${result.title_length} chars`,col(result.title_length,55,35)],['Words',String(result.word_count),col(result.word_count,700,400)],['Readability',result.readability?.toFixed(1),col(result.readability,60,45)]] as [string,string,string][]).map(([l,v,c])=>(
              <div key={l} style={{background:'#FFFFFF',border:`1px solid ${HAIR}`,borderRadius:5,padding:'8px 10px'}}>
                <div style={{fontSize:10,textTransform:'uppercase' as const,color:INK_F,fontFamily:'ui-monospace,monospace',letterSpacing:'0.1em',marginBottom:2}}>{l}</div>
                <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,fontWeight:600,color:INK,marginBottom:6}}>On-page keyword structure</div>
          {result.h1&&<div style={{marginBottom:8}}><span style={{fontSize:10,fontFamily:'ui-monospace,monospace',color:INK_F,marginRight:6}}>H1</span><span style={{fontSize:13,fontWeight:600,color:GREEN}}>{result.h1}</span></div>}
          {result.h2s?.length>0&&(
            <div>
              <span style={{fontSize:10,fontFamily:'ui-monospace,monospace',color:INK_F}}>H2</span>
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:4,marginTop:4}}>
                {result.h2s.map((h,i)=><span key={i} style={{fontSize:11,background:'#FFFFFF',border:`1px solid ${HAIR}`,padding:'3px 10px',borderRadius:4,color:INK_M}}>{h}</span>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
