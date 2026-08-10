'use client';
// FloatingHOSPanel v4 — HOS (Felix, knows everything) is the DEFAULT tab.
// HOS = Felix with full business context: live KPIs, documents, brain, tools, execution.
// Docs = BrainAskPage for when you need specific document citations.
// LLM = multi-model creative/research chat, no business data.
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

const BrainAskPage = dynamic(() => import('@/app/holding/chat/_components/BrainAskPage'), { ssr: false });
const CentralChat   = dynamic(() => import('./CentralChat'), { ssr: false });

const FOREST = '#084838';
const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';

type Tab = 'hos' | 'docs' | 'llm';

function getPropertyId(path: string): number {
  const m = path.match(/^\/h\/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function getModuleScope(path: string): string | undefined {
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'h' && seg.length >= 3) return seg[2];
  if (seg[0] === 'holding' && seg[1] === 'it2') return 'it';
  if (seg[0] === 'holding' && seg[1]) return seg[1];
  if (seg[0] && seg[0] !== 'h' && seg[0] !== 'holding') return seg[0];
  return undefined;
}

function getPropertyLabel(pid: number) {
  if (pid === 260955) return 'Namkhan';
  if (pid === 1000001) return 'Donna';
  return 'Holding';
}

export default function FloatingHOSPanel() {
  const [open, setOpen]   = useState(false);
  const [tab, setTab]     = useState<Tab>('hos');
  const pathname          = usePathname() ?? '';
  const propertyId        = getPropertyId(pathname);
  const moduleScope       = getModuleScope(pathname);
  const label             = getPropertyLabel(propertyId);

  useEffect(() => { setOpen(false); setTab('hos'); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  const TABS: { id: Tab; label: string; title: string }[] = [
    {
      id: 'hos',
      label: '🏨 HOS',
      title: 'Ask anything — live KPIs, OCC, ADR, bookings, documents, analysis, execution. Felix answers using live data + brain + tools.',
    },
    {
      id: 'docs',
      label: '📄 Docs',
      title: 'Document Q&A — cited answers from contracts, SOPs, policies. Shows exactly which document answered.',
    },
    {
      id: 'llm',
      label: '💬 LLM',
      title: 'Multi-model AI — DeepSeek V3, GPT-4o, Gemini Flash. No business data. For writing, coding, research.',
    },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        title={`HOS · ${label}${moduleScope ? ` · ${moduleScope}` : ''}`}
        aria-label="Open HOS"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#0a3d28' : FOREST,
          color: WHITE, border: 'none', cursor: 'pointer', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(8,72,56,0.40)',
          transition: 'background .15s, transform .15s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
      >
        🏨
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.18)' }} />

          <div style={{
            position: 'fixed', bottom: 88, right: 16, zIndex: 1001,
            width: 'min(700px, calc(100vw - 32px))',
            height: 'calc(100vh - 108px)', maxHeight: 840,
            background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 16px', background:FOREST, color:WHITE, flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:20 }}>🏨</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, letterSpacing:'-0.01em' }}>HOS · {label}</div>
                  <div style={{ fontSize:10, opacity:0.70, fontFamily:'ui-monospace,monospace', letterSpacing:'0.08em' }}>
                    {moduleScope ? `scope: ${moduleScope} · ` : ''}Hospitality Operating System
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <a href="/university" target="_blank" rel="noopener" onClick={() => setOpen(false)}
                  title="Platform University"
                  style={{ color:'rgba(255,255,255,0.75)', fontSize:11, fontFamily:'ui-monospace,monospace', letterSpacing:'0.08em', textDecoration:'none', border:'1px solid rgba(255,255,255,0.3)', padding:'3px 9px', borderRadius:4 }}>
                  📚 University
                </a>
                <button onClick={() => setOpen(false)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:20, lineHeight:1, padding:'2px 4px', borderRadius:4 }}>✕</button>
              </div>
            </div>

            {/* Tab strip */}
            <div style={{ display:'flex', borderBottom:`1px solid ${HAIR}`, flexShrink:0, background:'#FAFAF7' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} title={t.title}
                  style={{
                    flex:1, padding:'9px 4px', border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: tab===t.id ? WHITE : 'transparent',
                    color: tab===t.id ? FOREST : '#5A5A5A',
                    borderBottom: tab===t.id ? `2px solid ${FOREST}` : '2px solid transparent',
                    transition:'all .15s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>

              {/* HOS — Felix, knows everything: live data + brain + tools */}
              {tab === 'hos' && (
                <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                  <CentralChat
                    mode="second-brain"
                    moduleScope={moduleScope}
                    propertyId={propertyId === 0 ? undefined : propertyId}
                  />
                </div>
              )}

              {/* Docs — BrainAskPage, cited document answers */}
              {tab === 'docs' && (
                <div style={{ flex:1, overflow:'auto', padding:'0 0 8px' }}>
                  <div style={{ padding:'8px 16px', fontSize:11, color:'#5A5A5A', background:'#F9F6F0', borderBottom:`1px solid ${HAIR}` }}>
                    Document Q&A — cited answers from contracts, SOPs, policies. Use HOS for live KPIs and operational data.
                  </div>
                  <BrainAskPage
                    initialQuestion=""
                    propertyId={propertyId}
                    dept={moduleScope ?? 'lead'}
                    embedded={true}
                  />
                </div>
              )}

              {/* LLM — multi-model, no business data */}
              {tab === 'llm' && (
                <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                  <div style={{ padding:'8px 16px', fontSize:11, color:'#5A5A5A', background:'#F9F6F0', borderBottom:`1px solid ${HAIR}` }}>
                    Multi-model — DeepSeek V3, GPT-4o, Gemini Flash. No business data. Writing, coding, brainstorming.
                  </div>
                  <CentralChat
                    mode="general"
                    moduleScope={moduleScope}
                    propertyId={propertyId === 0 ? undefined : propertyId}
                  />
                </div>
              )}

            </div>
          </div>
        </>
      )}
    </>
  );
}
