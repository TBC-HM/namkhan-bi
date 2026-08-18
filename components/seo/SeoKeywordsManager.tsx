'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const HAIR='#E6DFCC';const INK='#1B1B1B';const INK_S='#5A5A5A';const INK_F='#8A8A8A';
const GREEN='#084838';const RED='#B03826';const AMBER='#C28F2C';

const MARKETS=[
  {code:2418,label:'Laos',name:'Laos'},
  {code:2276,label:'Germany',name:'Germany'},
  {code:2826,label:'UK',name:'United Kingdom'},
  {code:2840,label:'US',name:'United States'},
  {code:2250,label:'France',name:'France'},
  {code:2036,label:'Australia',name:'Australia'},
];

type KwRow={keyword_id:number;keyword:string;location_name:string;location_code:number;monthly_searches:number|null;keyword_difficulty:number|null;cpc_usd:number|null;position:number|null};

export default function SeoKeywordsManager({initialKeywords,propertyId}:{initialKeywords:KwRow[];propertyId:number}){
  const router=useRouter();
  const [isPending,startTransition]=useTransition();
  const [rows,setRows]=useState(initialKeywords);
  const [showAdd,setShowAdd]=useState(false);
  const [newKw,setNewKw]=useState('');
  const [newLoc,setNewLoc]=useState(2840);
  const [adding,setAdding]=useState(false);

  const handleDelete=async(id:number)=>{
    if(!confirm('Remove this keyword from tracking?'))return;
    setRows(r=>r.filter(x=>x.keyword_id!==id));
    await fetch('/api/marketing/seo/keywords?id='+id,{method:'DELETE'});
    startTransition(()=>{router.refresh();});
  };

  const handleAdd=async()=>{
    if(!newKw.trim())return;
    setAdding(true);
    const mkt=MARKETS.find(m=>m.code===newLoc)!;
    const res=await fetch('/api/marketing/seo/keywords',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({keyword:newKw.trim(),location_name:mkt.name,location_code:newLoc,property_id:propertyId}),
    });
    setAdding(false);
    if(res.ok){setNewKw('');setShowAdd(false);startTransition(()=>{router.refresh();});}
  };

  const kdBadge=(v:number|null)=>{
    if(v===null)return <span style={{color:INK_F}}>{'—'}</span>;
    const c=v<=30?GREEN:v<=60?AMBER:RED;
    const l=v<=30?'Easy':v<=60?'Med':'Hard';
    return <span style={{color:c,fontFamily:'ui-monospace,monospace',fontSize:11,fontWeight:600}}>{v+'% '+l}</span>;
  };

  return(
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <span style={{fontSize:11,color:INK_S}}>{rows.length+' keyword–market pairs'}</span>
        <button onClick={()=>setShowAdd(s=>!s)} style={{marginLeft:'auto',padding:'4px 12px',fontSize:11,fontWeight:600,border:'1px solid '+GREEN,borderRadius:4,background:showAdd?GREEN:'#fff',color:showAdd?'#fff':GREEN,cursor:'pointer'}}>
          {showAdd?'✕ Cancel':'+ Add keyword'}
        </button>
      </div>

      {showAdd&&(
        <div style={{display:'flex',gap:8,alignItems:'center',padding:'10px 14px',background:'#F4EFE2',borderRadius:6,marginBottom:12,flexWrap:'wrap'}}>
          <input
            value={newKw} onChange={e=>setNewKw(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter')handleAdd();}}
            placeholder='e.g. eco lodge luang prabang'
            style={{flex:1,minWidth:200,padding:'6px 10px',fontSize:12,border:'1px solid '+HAIR,borderRadius:4,outline:'none'}}
          />
          <select value={newLoc} onChange={e=>setNewLoc(Number(e.target.value))} style={{padding:'6px 10px',fontSize:12,border:'1px solid '+HAIR,borderRadius:4}}>
            {MARKETS.map(m=><option key={m.code} value={m.code}>{m.label}</option>)}
          </select>
          <button onClick={handleAdd} disabled={adding||!newKw.trim()} style={{padding:'6px 14px',fontSize:12,fontWeight:600,background:GREEN,color:'#fff',border:'none',borderRadius:4,cursor:'pointer',opacity:adding?0.6:1}}>
            {adding?'Adding…':'Add'}
          </button>
        </div>
      )}

      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{borderBottom:'2px solid '+HAIR}}>
            {['Keyword','Market','Volume/mo','Difficulty','CPC','Position',''].map(h=>(
              <th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:10,fontFamily:'ui-monospace,monospace',letterSpacing:'0.1em',textTransform:'uppercase',color:INK_F,fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.keyword_id} style={{borderBottom:'1px solid '+HAIR,opacity:isPending?0.6:1}}>
                <td style={{padding:'7px 8px',color:INK,fontStyle:'italic'}}>{r.keyword}</td>
                <td style={{padding:'7px 8px',color:INK_F,fontSize:11,whiteSpace:'nowrap'}}>{r.location_name}</td>
                <td style={{padding:'7px 8px',fontFamily:'ui-monospace,monospace',fontSize:11}}>{r.monthly_searches!=null?r.monthly_searches.toLocaleString():'—'}</td>
                <td style={{padding:'7px 8px'}}>{kdBadge(r.keyword_difficulty)}</td>
                <td style={{padding:'7px 8px',color:INK_F,fontFamily:'ui-monospace,monospace',fontSize:11}}>{r.cpc_usd!=null?'$'+Number(r.cpc_usd).toFixed(2):'—'}</td>
                <td style={{padding:'7px 8px'}}>
                  <span style={{fontSize:10,fontFamily:'ui-monospace,monospace',color:r.position!=null?GREEN:INK_F,border:'1px solid',borderColor:r.position!=null?GREEN:HAIR,padding:'2px 6px',borderRadius:3}}>
                    {r.position!=null?'#'+r.position:'not ranked'}
                  </span>
                </td>
                <td style={{padding:'7px 8px'}}>
                  <button onClick={()=>handleDelete(r.keyword_id)} style={{padding:'2px 8px',fontSize:10,border:'1px solid '+HAIR,borderRadius:3,background:'#fff',color:RED,cursor:'pointer'}}>{'✕'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
