'use client';
// app/holding/it2/knowledge/docs/DocsView.tsx
// Human-readable doc library: meaningful KPI tiles, grouped tree, CTAs per doc.
// Review SLAs now set — freshness tiles are live.

import { useState, useMemo, type CSSProperties } from 'react';
import { Container, MetricRow } from '@/app/(cockpit)/_design';
import { Markdown } from '@/components/cockpit/Markdown';
import type { Document } from '@/lib/cockpit/types';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

// Human-meaningful grouping — not the DB category system
const DOC_GROUPS: Array<{ key: string; label: string; emoji: string; doc_types: string[] }> = [
  {
    key: 'platform_core', label: 'Platform Core', emoji: '⚙️',
    doc_types: ['claude_md','architecture','deployment','data_model'],
  },
  {
    key: 'design_apis', label: 'Design & APIs', emoji: '🎨',
    doc_types: ['design_system','api','security'],
  },
  {
    key: 'strategy', label: 'Strategy & Vision', emoji: '🎯',
    doc_types: ['vision_roadmap','prd','education_log'],
  },
  {
    key: 'modules', label: 'Module Specs', emoji: '📦',
    doc_types: ['newsletter_module','media_module','youtube_module','website_module','gbp_module',
      'icp_module','sales_module','proposals_module','inventory_module','spec_builder_module',
      'bug_agent_module','hr_scheduling_module','socials_module','compiler_module',
      'agent_flow_md','supplier_module'],
  },
  {
    key: 'refs', label: 'Technical References', emoji: '📋',
    doc_types: ['integration','factorial_md','app_navigation','it_navigation',
      'advisory_doc_standard','handover'],
  },
];

// Human-readable labels
const DOC_LABELS: Record<string, string> = {
  claude_md: 'Operating Manual (CLAUDE.md)',
  architecture: 'Platform Architecture',
  deployment: 'Deployment Guide',
  data_model: 'Data Model & ERD',
  design_system: 'Design System',
  api: 'API & Chart Contract',
  security: 'Multi-Tenancy & Security',
  vision_roadmap: 'Vision & Roadmap',
  prd: 'Product Requirements',
  education_log: 'Platform Handbook',
  newsletter_module: 'Newsletter Engine',
  media_module: 'Media Library',
  youtube_module: 'YouTube Module',
  website_module: 'Website (thenamkhan.com)',
  gbp_module: 'Google Business Profile',
  icp_module: 'ICP Engine',
  sales_module: 'Sales CRM & Pipeline',
  proposals_module: 'Proposals & Composer',
  inventory_module: 'Inventory & Procurement',
  spec_builder_module: 'Spec Builder',
  bug_agent_module: 'Bug Agent Machine',
  hr_scheduling_module: 'HR Scheduling',
  socials_module: 'Socials Module',
  compiler_module: 'Compiler (Retreat/Offer)',
  agent_flow_md: 'Agent Skill Library',
  university_module: 'TBC University',
  brain_module: 'Company Second Brain',
  onboarding_module: 'Onboarding Engine',
  knowledge_module: 'Tenant Knowledge System',
  guardrails_module: 'Guardrails & Thresholds',
  supplier_module: 'Supplier Directory',
  integration: 'Integration State',
  factorial_md: 'Factorial HR Reference',
  app_navigation: 'App Sitemap',
  it_navigation: 'IT2 Navigation',
  advisory_doc_standard: 'Advisory Doc Standard',
  handover: 'Session Handover',
};

// Review SLA is now set in DB — freshness is live
export function docFreshness(d: { last_updated_at: string | null; review_interval_days: number | null }):{
  key:'fresh'|'due'|'overdue'|'unknown'; label:string; tone:string; days:number;
}{
  if (!d.last_updated_at || !d.review_interval_days) return { key:'unknown', label:'no SLA', tone:'var(--ink-soft,#5A5A5A)', days:999 };
  const ageDays = (Date.now() - new Date(d.last_updated_at).getTime()) / 86_400_000;
  const label = `${Math.round(ageDays)}d old · SLA ${d.review_interval_days}d`;
  if (ageDays > d.review_interval_days * 2) return { key:'overdue', label, tone:'var(--status-red,#B03826)', days:ageDays };
  if (ageDays > d.review_interval_days)     return { key:'due',     label, tone:'#B48A3A', days:ageDays };
  return { key:'fresh', label, tone:'var(--primary,#084838)', days:ageDays };
}

// ADR-242 (PBS 2026-08-06, urgent) — every doc downloadable as .md.
// Client-side Blob: no API route, no storage round-trip, works offline once loaded.
function saveMd(filename: string, body: string) {
  const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadOne(d: Document) {
  saveMd(`${d.doc_type}-v${d.version}.md`, d.content_md ?? '');
}
function downloadAll(list: Document[]) {
  const bundle = list.map(d =>
    `\n\n<!-- ===== ${d.doc_type} · v${d.version} · ${d.title} ===== -->\n\n${d.content_md ?? ''}`
  ).join('\n');
  saveMd(`tbc-docs-${list.length}-docs.md`, bundle);
}

export function DocsView({ docs }: { docs: Document[] }) {
  const [active, setActive] = useState(docs[0]?.doc_type ?? '');
  const [search, setSearch] = useState('');
  const [expandedSurfaces, setExpandedSurfaces] = useState(false);

  const current = useMemo(() => docs.find(d => d.doc_type === active) ?? docs[0] ?? null, [docs, active]);

  const stats = useMemo(() => {
    const f = docs.map(d => docFreshness(d).key);
    const now = Date.now();
    const thisWeek = docs.filter(d => d.last_updated_at && (now - new Date(d.last_updated_at).getTime()) < 7*86400000);
    return {
      total: docs.length,
      fresh: f.filter(k => k==='fresh').length,
      due: f.filter(k => k==='due').length,
      overdue: f.filter(k => k==='overdue').length,
      updated_this_week: thisWeek.length,
      draft: docs.filter(d => d.status === 'draft').length,
    };
  }, [docs]);

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter(d => d.title.toLowerCase().includes(q) || d.doc_type.toLowerCase().includes(q));
  }, [docs, search]);

  // ADR-242 — DOC_GROUPS is a hand-maintained allow-list. Any doc_type missing
  // from it used to vanish from this page entirely: on 2026-08-06 that hid 59 of
  // 90 docs, including university_module, brain_module, felix_module and every
  // backfilled module spec. Nothing may be invisible now — leftovers land in
  // "Everything else" and the group list stays a display order, not a filter.
  const grouped = useMemo(() => {
    const claimed = new Set(DOC_GROUPS.flatMap(g => g.doc_types));
    const named = DOC_GROUPS.map(g => ({
      ...g,
      docs: filteredDocs.filter(d => g.doc_types.includes(d.doc_type)),
    }));
    const rest = filteredDocs.filter(d => !claimed.has(d.doc_type));
    return [
      ...named,
      { key: 'unfiled', label: 'Everything else', emoji: '🗂', doc_types: [] as string[], docs: rest },
    ].filter(g => g.docs.length > 0);
  }, [filteredDocs]);

  if (!docs.length) return <div style={{ padding:32, color:'var(--ink-soft)', textAlign:'center' as const }}>No published documents.</div>;

  return (
    <div className="cockpit-design" style={{ background:'#FFF', color:'var(--ink)', padding:16, borderRadius:8, display:'flex', flexDirection:'column' as const, gap:16, fontFamily:'var(--sans,"Inter Tight",system-ui,sans-serif)' }}>

      {/* KPI tiles — now real since review_interval_days is set */}
      <MetricRow size="sm" tiles={[
        { label:'Total docs',     value:stats.total,             footnote:'in documentation.documents' },
        { label:'Updated this week', value:stats.updated_this_week, footnote:'active iteration',         status: stats.updated_this_week>0?'green':'grey' },
        { label:'Fresh',          value:stats.fresh,             footnote:'within review SLA',          status: stats.fresh>0?'green':'grey' },
        { label:'Due for review', value:stats.due,               footnote:'past SLA — update soon',     status: stats.due>0?'amber':'green' },
        { label:'Overdue',        value:stats.overdue,           footnote:'2× SLA — review now',        status: stats.overdue>0?'red':'green' },
        { label:'Draft',          value:stats.draft,             footnote:'not yet published',          status: stats.draft>0?'amber':'green' },
      ]} />

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:16, alignItems:'start' }}>

        {/* LEFT: doc tree */}
        <div>
          {/* Search */}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search docs…"
            style={{ width:'100%', fontSize:12.5, padding:'6px 10px', border:'1px solid var(--hairline,#E6DFCC)', borderRadius:6, background:'var(--paper,#FFF)', color:'var(--ink)', marginBottom:12, boxSizing:'border-box' as const }} />

          {grouped.map(g => (
            <div key={g.key} style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontFamily:MONO, letterSpacing:'.1em', textTransform:'uppercase' as const, color:'var(--ink-soft)', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <span>{g.emoji}</span><span>{g.label}</span><span style={{ opacity:.5 }}>· {g.docs.length}</span>
              </div>
              {g.docs.map(d => {
                const isActive = current?.doc_type === d.doc_type;
                const fresh = docFreshness(d);
                return (
                  <button key={d.id} onClick={()=>setActive(d.doc_type)}
                    style={{ display:'block', width:'100%', textAlign:'left' as const, padding:'7px 10px',
                      marginBottom:2, borderRadius:5, border:'none', cursor:'pointer',
                      background: isActive ? 'var(--primary,#084838)' : 'transparent',
                      color: isActive ? '#FFF' : 'var(--ink)' }}>
                    <div style={{ fontSize:12.5, fontWeight: isActive?600:400 }}>{DOC_LABELS[d.doc_type]??d.doc_type}</div>
                    <div style={{ fontSize:10, fontFamily:MONO, marginTop:2, opacity:.75, display:'flex', gap:8 }}>
                      <span>v{d.version}</span>
                      <span style={{ color: isActive ? 'rgba(255,255,255,.8)' : fresh.tone }}>{fresh.key==='unknown'?'—':fresh.key}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {search && filteredDocs.length===0 && (
            <div style={{ fontSize:12, color:'var(--ink-soft)', padding:'8px 10px' }}>No docs match "{search}"</div>
          )}
        </div>

        {/* RIGHT: selected doc */}
        {current && (
          <div>
            {/* Doc header with CTAs */}
            <div style={{ border:'1px solid var(--hairline,#E6DFCC)', borderRadius:8, padding:'12px 16px', marginBottom:12, background:'rgba(8,72,56,0.03)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap' as const, gap:8 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)' }}>{DOC_LABELS[current.doc_type]??current.doc_type}</div>
                  <div style={{ fontSize:11, fontFamily:MONO, color:'var(--ink-soft)', marginTop:3, display:'flex', gap:12, flexWrap:'wrap' as const }}>
                    <span>v{current.version}</span>
                    <span style={{ color: docFreshness(current).tone }}>{docFreshness(current).label}</span>
                    <span>status: {current.status}</span>
                    <span>owner: {current.owner??'—'}</span>
                    <span>review every {current.review_interval_days??'—'}d</span>
                    <span>last: {current.last_updated_at?new Date(current.last_updated_at).toLocaleDateString():'—'} by {current.last_updated_by??'—'}</span>
                  </div>
                </div>
                {/* CTAs */}
                <div style={{ display:'flex', gap:6, flexShrink:0, flexWrap:'wrap' as const }}>
                  {/* ADR-242 — download THIS doc as markdown */}
                  <button onClick={() => downloadOne(current)} title={`Download ${current.doc_type} v${current.version} as .md`}
                    style={{ fontSize:10.5, fontFamily:MONO, fontWeight:700, padding:'3px 10px', borderRadius:10, cursor:'pointer',
                      border:'1px solid var(--primary,#084838)', background:'#FFF', color:'var(--primary,#084838)' }}>
                    ⬇ .md
                  </button>
                  <span style={{ fontSize:10, fontFamily:MONO, fontWeight:700, padding:'3px 9px', borderRadius:10,
                    background:'var(--primary,#084838)', color:'#FFF' }}>v{current.version}</span>
                  <span style={{ fontSize:10, fontFamily:MONO, fontWeight:600, padding:'3px 9px', borderRadius:10,
                    background:'#F4EFE2', color:'var(--ink-soft)', border:'1px solid #E6DFCC' }}>{current.status}</span>
                  {docFreshness(current).key==='overdue' && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10,
                      background:'rgba(176,56,38,0.12)', color:'#B03826', border:'1px solid rgba(176,56,38,0.3)' }}>
                      ⚠ Overdue — update now
                    </span>
                  )}
                  {docFreshness(current).key==='due' && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:10,
                      background:'rgba(180,138,58,0.12)', color:'#B48A3A', border:'1px solid rgba(180,138,58,0.3)' }}>
                      Due for review
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Doc body */}
            <Container title="" subtitle="">
              <Markdown source={current.content_md} />
            </Container>
          </div>
        )}
      </div>

      {/* Knowledge surfaces — collapsed by default */}
      <div>
        {/* ADR-242 — one file with every doc in it */}
        <button onClick={()=>downloadAll(docs)}
          style={{ fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:6, cursor:'pointer', marginRight:8,
            border:'1px solid var(--primary,#084838)', background:'var(--primary,#084838)', color:'#FFF' }}>
          ⬇ Download all {docs.length} docs (.md)
        </button>
        <button onClick={()=>setExpandedSurfaces(s=>!s)}
          style={{ fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:6, cursor:'pointer', border:'1px solid var(--hairline,#E6DFCC)', background:'var(--paper,#FFF)', color:'var(--ink)' }}>
          {expandedSurfaces?'▲ Hide':'▼ Show'} all knowledge surfaces ({docs.length} docs + 5 other sources agents read from)
        </button>
        {expandedSurfaces && (
          <div style={{ marginTop:10, display:'grid', gap:8 }}>
            {[
              { surface:'documentation.documents', what:'Canonical docs — what you are reading now', hint:`${docs.length} active` },
              { surface:'public.cockpit_agent_memory', what:'Standing rules + learnings. importance ≥ 9 loaded for every agent at session start', hint:'220+ rules' },
              { surface:'public.cockpit_agent_prompts', what:'Per-agent persona + tool framing. One row per role (Felix, Carla, Vera, Sherlock…)', hint:'96 active' },
              { surface:'cockpit.cap_skills', what:'Skill catalog — what agents can actually invoke, with permission level', hint:'130 active skills' },
              { surface:'governance.tenant_knowledge_docs', what:'Property judgment docs — PBS-approved operational MDs per section per property', hint:'6 approved for Namkhan' },
              { surface:'dms.documents', what:'Long-form KB — contracts, audits, case files, patches. Pulled on demand', hint:'thousands' },
            ].map(s => (
              <div key={s.surface} style={{ border:'1px solid var(--hairline,#E6DFCC)', padding:'8px 12px', borderRadius:4, background:'#FBF8EF' }}>
                <div style={{ display:'flex', gap:10, alignItems:'baseline', flexWrap:'wrap' as const }}>
                  <code style={{ fontFamily:MONO, fontSize:11.5, fontWeight:600, color:'var(--ink)' }}>{s.surface}</code>
                  <span style={{ fontFamily:MONO, fontSize:10, color:'var(--ink-soft)' }}>· {s.hint}</span>
                </div>
                <div style={{ fontSize:12.5, color:'var(--ink)', marginTop:3 }}>{s.what}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
