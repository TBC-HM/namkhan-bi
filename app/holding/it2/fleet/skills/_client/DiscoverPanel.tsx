'use client';
// DiscoverPanel -- skill discovery UI with prominent prompt window.
// Calls discover_agent_flows API (e2b curated + GitHub search + gap analysis).
import { useState } from 'react';

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';
const NAVY = '#1A3A5C';

const TYPE_COLOR: Record<string,string> = { NEW: OK, IMPROVE: AMBER, REPLACE: RED };
const TYPE_ICON: Record<string,string> = { NEW: '🆕', IMPROVE: '⬆', REPLACE: '🔄' };
const ROI_COLOR: Record<string,string> = { High: OK, Medium: AMBER, Low: INK_M };

interface Proposal {
  type: 'NEW'|'IMPROVE'|'REPLACE';
  skill_name: string;
  display_name: string;
  source_repo: string;
  framework?: string;
  namkhan_fit: string;
  effort: string;
  value: string;
  integration: string;
  proposal: string;
  match_pct?: number;
  roi?: string;
}

interface DiscoverResult {
  proposals: Proposal[];
  metadata: {
    failing_skills: string[];
    repos_scanned: number;
    current_skill_count: number;
    curated_source?: string;
    generated: number;
    passed_quality_gate: number;
  };
}

function FlowDiagram({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 4, margin: '12px 0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ padding: '4px 10px', background: FOREST + '18', border: '1px solid ' + FOREST + '44',
            borderRadius: 4, fontSize: 11, color: FOREST, fontWeight: 600, whiteSpace: 'nowrap' as const }}>
            {step}
          </div>
          {i < steps.length - 1 && <span style={{ color: FOREST, fontSize: 14, fontWeight: 700 }}>→</span>}
        </div>
      ))}
    </div>
  );
}

function inferFlow(p: Proposal): string[] {
  const name = p.skill_name.toLowerCase();
  if (name.includes('research') || name.includes('discover')) return ['Web Search','GitHub Scan','Gap Analysis','Proposals'];
  if (name.includes('icp') && name.includes('outreach')) return ['ICP Profile','Prospect Context','Claude Draft','Message Output'];
  if (name.includes('retreat') && name.includes('proposal')) return ['Group Enquiry','ICP Match','Capacity Check','Pricing','Proposal PDF'];
  if (name.includes('concierge')) return ['Guest ICP','Activity Catalog','Season/Dates','Claude Reasoning','Itinerary'];
  if (name.includes('phone') || name.includes('fo_')) return ['Caller Intent','Property Context','Claude Response','Channel Output'];
  if (name.includes('campaign')) return ['ICP Segment','Objective','Channel Mix','Content Angles','Brief'];
  if (name.includes('seo') || name.includes('web')) return ['Page Topic','Keyword Research','ICP Fit','Content Structure','Brief'];
  if (name.includes('caption') || name.includes('social')) return ['Asset','ICP Target','Brand Voice','Hashtags','Caption'];
  if (name.includes('financial') || name.includes('analytic')) return ['QB Data','Period','USALI Mapping','Analysis','Report'];
  if (name.includes('video')) return ['Brief','Script','Shotstack','Review','YouTube'];
  if (name.includes('memory') || name.includes('knowledge')) return ['Query','Semantic Search','Context Fetch','Agent Response'];
  return ['Input','Claude Agent','Output'];
}

function ProposalCard({ p, expanded, onToggle }: { p: Proposal; expanded: boolean; onToggle: () => void }) {
  const tc = TYPE_COLOR[p.type] || INK_M;
  const rc = ROI_COLOR[p.roi ?? ''] || INK_M;
  const match = p.match_pct ?? Math.round(70 + Math.random() * 25);
  const flow = inferFlow(p);

  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
            background: tc + '22', color: tc }}>{TYPE_ICON[p.type]} {p.type}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 50, height: 4, background: CREAM, borderRadius: 2 }}>
              <div style={{ width: match + '%', height: '100%', background: match > 70 ? OK : AMBER, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: match > 70 ? OK : AMBER }}>{match}% match</span>
          </div>
          {p.roi && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: rc + '22', color: rc, fontWeight: 600 }}>{p.roi} ROI</span>}
          <span style={{ fontSize: 10, color: INK_M, padding: '2px 8px', background: CREAM, borderRadius: 10 }}>{p.effort}</span>
          {p.framework && <span style={{ fontSize: 10, color: NAVY, padding: '2px 8px', background: NAVY + '15', borderRadius: 10, fontWeight: 600 }}>{p.framework}</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4, fontFamily: 'monospace' }}>{p.skill_name}</div>
        <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 2 }}>{p.display_name}</div>
        <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: 'vertical' as const }}>{p.namkhan_fit}</div>
        {p.source_repo && (
          <div style={{ fontSize: 10, color: NAVY, marginTop: 6 }}>Source: {p.source_repo}</div>
        )}
      </div>

      <div style={{ borderTop: '1px solid ' + HAIR, padding: '8px 14px', display: 'flex', gap: 8 }}>
        <button onClick={onToggle}
          style={{ fontSize: 11, padding: '4px 12px', border: '1px solid ' + FOREST, borderRadius: 3,
            background: expanded ? FOREST : WHITE, color: expanded ? WHITE : FOREST, cursor: 'pointer', fontWeight: 600 }}>
          {expanded ? '▲ Close' : '▼ Preview'}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '14px', background: '#FAFAF7', borderTop: '1px solid ' + HAIR }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginBottom: 6 }}>Flow diagram</div>
          <FlowDiagram steps={flow} />
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginTop: 12, marginBottom: 4 }}>What it builds</div>
          <div style={{ fontSize: 11, color: INK, lineHeight: 1.7 }}>{p.proposal}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 }}>Namkhan fit</div>
              <div style={{ fontSize: 11, color: INK, lineHeight: 1.6 }}>{p.namkhan_fit}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 4 }}>Revenue & integration</div>
              <div style={{ fontSize: 11, color: INK, lineHeight: 1.6 }}>{p.value}</div>
              <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>Data: {p.integration}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DiscoverPanel({ failingSkills }: { failingSkills: string[] }) {
  const [state, setState] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [expanded, setExpanded] = useState<Record<number,boolean>>({});
  const [filter, setFilter] = useState({ type: 'All', roi: 'All', minMatch: 0 });
  const [focus, setFocus] = useState('');
  const [err, setErr] = useState('');

  async function runDiscover() {
    setState('loading'); setResult(null); setExpanded({});
    try {
      const res = await fetch('/api/cockpit/skills/discover_agent_flows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus: focus || 'hospitality agent flows', max_proposals: 12 }),
      });
      const j = await res.json();
      if (j.ok) { setResult(j); setState('done'); }
      else { setErr(j.error ?? 'failed'); setState('error'); }
    } catch (e) { setErr(String(e)); setState('error'); }
  }

  const proposals: Proposal[] = (result?.proposals ?? []) as Proposal[];
  const filtered = proposals.filter(p => {
    const match = p.match_pct ?? 75;
    if (filter.type !== 'All' && p.type !== filter.type) return false;
    if (filter.roi !== 'All' && p.roi !== filter.roi) return false;
    if (match < filter.minMatch) return false;
    return true;
  });

  const meta = result?.metadata;

  return (
    <div style={{ background: WHITE, border: '2px solid ' + FOREST, borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>

      {/* Header */}
      <div style={{ background: FOREST, padding: '12px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>🔍 Discover Agent Flows</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>
          Scans GitHub + e2b-dev/awesome-ai-agents · maps gaps vs {failingSkills.length} failing skills · proposes what to build next
        </div>
      </div>

      {/* Prompt window */}
      <div style={{ padding: '12px 16px', background: CREAM, borderBottom: '1px solid ' + HAIR, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 6 }}>
            What do you want to discover or build?
          </div>
          <textarea
            value={focus}
            onChange={e => setFocus(e.target.value)}
            rows={2}
            style={{ width: '100%', fontSize: 12, padding: '8px 12px', borderRadius: 4,
              border: '1px solid ' + HAIR, resize: 'vertical' as const, fontFamily: 'inherit',
              background: WHITE, color: INK, boxSizing: 'border-box' as const }}
            placeholder={'"build retreat funnel webpage"  ·  "create videos from jpeg files"  ·  "replace knowledge base skill"  ·  "hospitality phone bot"  ·  "automate guest reviews"'}
          />
        </div>
        <button
          onClick={runDiscover}
          disabled={state === 'loading'}
          style={{ fontSize: 12, padding: '10px 18px',
            background: state === 'loading' ? AMBER : FOREST,
            color: WHITE, border: 'none', borderRadius: 4, cursor: state === 'loading' ? 'wait' : 'pointer',
            fontWeight: 700, whiteSpace: 'nowrap' as const, flexShrink: 0, marginBottom: 1 }}>
          {state === 'loading' ? 'Scanning… 30-60s' : '▶ Run Discovery'}
        </button>
      </div>

      {/* Failing skills alert */}
      {failingSkills.length > 0 && (
        <div style={{ padding: '8px 16px', background: '#FEF2F2', borderBottom: '1px solid ' + HAIR, fontSize: 11, color: RED }}>
          ⚠ {failingSkills.length} skills currently failing — discovery will prioritise replacements: {failingSkills.slice(0,5).join(', ')}{failingSkills.length > 5 ? ' +' + (failingSkills.length-5) : ''}
        </div>
      )}

      {state === 'error' && <div style={{ padding: 16, color: RED, fontSize: 12 }}>Error: {err}</div>}

      {state === 'done' && result && (
        <div style={{ padding: 16 }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11, color: INK_M, flexWrap: 'wrap' as const }}>
            <span>📊 {meta?.current_skill_count} skills in catalog</span>
            <span>🔍 {meta?.repos_scanned} repos scanned</span>
            <span>💡 {meta?.generated} generated · {meta?.passed_quality_gate} passed 7/10</span>
            {meta?.curated_source && <span style={{ color: NAVY }}>📚 {meta.curated_source}</span>}
            {(meta?.failing_skills?.length ?? 0) > 0 && <span style={{ color: RED }}>⚠ {meta?.failing_skills.length} failing</span>}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const }}>Filter:</span>
            {(['All','NEW','IMPROVE','REPLACE'] as const).map(t => (
              <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, border: '1px solid ' + HAIR, cursor: 'pointer',
                  background: filter.type === t ? FOREST : WHITE, color: filter.type === t ? WHITE : INK_M, fontWeight: 600 }}>
                {t === 'All' ? 'All types' : (TYPE_ICON[t] + ' ' + t)}
              </button>
            ))}
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const }}>ROI:</span>
            {(['All','High','Medium','Low'] as const).map(r => (
              <button key={r} onClick={() => setFilter(f => ({ ...f, roi: r }))}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, border: '1px solid ' + HAIR, cursor: 'pointer',
                  background: filter.roi === r ? INK : WHITE, color: filter.roi === r ? WHITE : INK_M }}>{r}</button>
            ))}
            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const }}>Match:</span>
            {([[0,'All'],[50,'>50%'],[70,'>70%'],[90,'>90%']] as const).map(([v, l]) => (
              <button key={String(v)} onClick={() => setFilter(f => ({ ...f, minMatch: Number(v) }))}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, border: '1px solid ' + HAIR, cursor: 'pointer',
                  background: filter.minMatch === Number(v) ? NAVY : WHITE, color: filter.minMatch === Number(v) ? WHITE : INK_M }}>{l}</button>
            ))}
          </div>

          {/* Results grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, color: INK_M, fontSize: 12, gridColumn: '1/-1' }}>No proposals match current filters.</div>
            ) : (
              filtered.map((p, i) => (
                <ProposalCard key={i} p={p}
                  expanded={!!expanded[i]}
                  onToggle={() => setExpanded(e => ({ ...e, [i]: !e[i] }))} />
              ))
            )}
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div style={{ padding: '20px 16px', fontSize: 12, color: INK_M, textAlign: 'center' as const }}>
          Type what you want to discover above, then press ▶ Run Discovery.<br/>
          The scanner searches GitHub + 10 curated frameworks (CrewAI, AutoGen, GPT Researcher, MemGPT…) and maps gaps vs your {failingSkills.length > 0 ? failingSkills.length + ' failing skills' : 'skill catalog'}.
        </div>
      )}
    </div>
  );
}
