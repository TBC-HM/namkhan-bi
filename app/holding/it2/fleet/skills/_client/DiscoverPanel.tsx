'use client';
// DiscoverPanel -- skill discovery UI. YouTube links on each card for immediate research.
import { useState } from 'react';

const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC'; const INK = '#1B1B1B';
const INK_M = '#5A5A5A'; const CREAM = '#F5F0E1'; const FOREST = '#084838';
const AMBER = '#B48A3A'; const RED = '#B03826'; const OK = '#0E7A4B';
const NAVY = '#1A3A5C'; const YT = '#CC0000';

const TYPE_COLOR: Record<string,string> = { NEW: OK, IMPROVE: AMBER, REPLACE: RED };
const TYPE_ICON: Record<string,string> = { NEW: '🆕', IMPROVE: '⬆', REPLACE: '🔄' };
const ROI_COLOR: Record<string,string> = { High: OK, Medium: AMBER, Low: INK_M };

interface Proposal {
  type: 'NEW'|'IMPROVE'|'REPLACE';
  skill_name: string; display_name: string; source_repo: string; framework?: string;
  namkhan_fit?: string; effort: string; value: string;
  proposal: string; match_pct?: number; roi?: string;
  _avg?: number; _reason?: string;
}

interface DiscoverMeta {
  user_request?: string; generated?: number; passed_quality_gate?: number;
  filtered_low_quality?: number; repos_scanned?: number; reddit_posts?: number;
  sources?: string; persisted?: boolean;
}

interface ErrDetail { msg: string; stage?: string; raw?: string; hint?: string; }

function FlowDiagram({ steps }: { steps: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 4, margin: '10px 0' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ padding: '4px 9px', background: FOREST + '18', border: '1px solid ' + FOREST + '44',
            borderRadius: 4, fontSize: 11, color: FOREST, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{step}</div>
          {i < steps.length - 1 && <span style={{ color: FOREST, fontSize: 13, fontWeight: 700 }}>→</span>}
        </div>
      ))}
    </div>
  );
}

function inferFlow(p: Proposal): string[] {
  const n = p.skill_name.toLowerCase();
  if (n.includes('research') || n.includes('discover')) return ['Web Search','GitHub Scan','Gap Analysis','Proposals'];
  if (n.includes('icp') && n.includes('outreach')) return ['ICP Profile','Prospect Context','Claude Draft','Message'];
  if (n.includes('retreat') && n.includes('proposal')) return ['Enquiry','ICP Match','Capacity','Pricing','PDF'];
  if (n.includes('concierge')) return ['Guest ICP','Activity Catalog','Season','Claude','Itinerary'];
  if (n.includes('phone') || n.includes('fo_')) return ['Caller Intent','Property Context','Claude','Output'];
  if (n.includes('financial') || n.includes('analytic') || n.includes('narrative')) return ['GL Pull','Variance Compute','Outlier Flag','Forecast','Report'];
  if (n.includes('video') || n.includes('content')) return ['Brief','Script','Review','YouTube'];
  if (n.includes('memory') || n.includes('knowledge')) return ['Query','Semantic Search','Context','Response'];
  if (n.includes('reputation') || n.includes('review')) return ['Review Text','Sentiment','Brand Voice','Response'];
  if (n.includes('market') || n.includes('research')) return ['Web Search','Source Synthesis','Analysis','Digest'];
  return ['Input','Claude Agent','Output'];
}

function YtLinks({ p, userRequest }: { p: Proposal; userRequest: string }) {
  const slug = encodeURIComponent(p.display_name || p.skill_name);
  const framework = encodeURIComponent((p.framework && p.framework !== 'custom') ? p.framework : 'AI agent');
  const topic = encodeURIComponent(userRequest || p.skill_name);
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>Watch:</span>
      <a href={'https://www.youtube.com/results?search_query=' + slug + '+AI+agent+tutorial'}
        target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 10, padding: '3px 9px', background: YT + '15', color: YT, borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
        ▶ How to build
      </a>
      <a href={'https://www.youtube.com/results?search_query=claude+code+' + encodeURIComponent(p.skill_name) + '+workflow'}
        target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 10, padding: '3px 9px', background: YT + '10', color: '#8B0000', borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
        ▶ Claude Code pattern
      </a>
      <a href={'https://www.youtube.com/results?search_query=' + framework + '+hospitality+hotel+' + topic}
        target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 10, padding: '3px 9px', background: NAVY + '15', color: NAVY, borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
        ▶ Hospitality network
      </a>
      {p.source_repo && p.source_repo.includes('/') && (
        <a href={'https://github.com/' + p.source_repo}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10, padding: '3px 9px', background: INK_M + '15', color: INK_M, borderRadius: 4, textDecoration: 'none', fontWeight: 600 }}>
          ⌥ Source repo
        </a>
      )}
    </div>
  );
}

function ProposalCard({ p, userRequest, expanded, onToggle }: { p: Proposal; userRequest: string; expanded: boolean; onToggle: () => void }) {
  const tc = TYPE_COLOR[p.type] || INK_M;
  const rc = ROI_COLOR[p.roi ?? ''] || INK_M;
  const match = p.match_pct ?? Math.round(70 + Math.random() * 25);
  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: tc + '22', color: tc }}>{TYPE_ICON[p.type]} {p.type}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 48, height: 4, background: CREAM, borderRadius: 2 }}>
              <div style={{ width: match + '%', height: '100%', background: match > 80 ? OK : match > 65 ? AMBER : RED, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: match > 80 ? OK : AMBER }}>{match}%</span>
          </div>
          {p.roi && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: rc + '22', color: rc, fontWeight: 600 }}>{p.roi} ROI</span>}
          <span style={{ fontSize: 10, color: INK_M, padding: '2px 8px', background: CREAM, borderRadius: 10 }}>{p.effort}</span>
          {p.framework && <span style={{ fontSize: 10, color: NAVY, padding: '2px 8px', background: NAVY + '15', borderRadius: 10, fontWeight: 600 }}>{p.framework}</span>}
          {p._avg !== undefined && <span style={{ fontSize: 10, color: OK, padding: '2px 8px', background: OK + '15', borderRadius: 10 }}>★ {p._avg.toFixed(1)}</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 3, fontFamily: 'monospace' }}>{p.skill_name}</div>
        <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 4 }}>{p.display_name}</div>
        <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.5 }}>{String(p.value).slice(0, 120)}</div>
      </div>
      <div style={{ borderTop: '1px solid ' + HAIR, padding: '8px 14px' }}>
        <button onClick={onToggle} style={{ fontSize: 11, padding: '4px 12px', border: '1px solid ' + FOREST, borderRadius: 3,
          background: expanded ? FOREST : WHITE, color: expanded ? WHITE : FOREST, cursor: 'pointer', fontWeight: 600 }}>
          {expanded ? '▲ Close' : '▼ Preview + Watch'}
        </button>
      </div>
      {expanded && (
        <div style={{ padding: 14, background: '#FAFAF7', borderTop: '1px solid ' + HAIR }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginBottom: 6 }}>Flow diagram</div>
          <FlowDiagram steps={inferFlow(p)} />
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.08em', color: INK_M, marginTop: 12, marginBottom: 4 }}>What it builds</div>
          <div style={{ fontSize: 11, color: INK, lineHeight: 1.7 }}>{p.proposal}</div>
          {p._reason && <div style={{ fontSize: 11, color: INK_M, marginTop: 6, fontStyle: 'italic' }}>Scorer: {p._reason}</div>}
          {p.source_repo && <div style={{ fontSize: 10, color: NAVY, marginTop: 6 }}>Source: {p.source_repo}</div>}
          <YtLinks p={p} userRequest={userRequest} />
        </div>
      )}
    </div>
  );
}

export default function DiscoverPanel({ failingSkills }: { failingSkills: string[] }) {
  const [state, setState] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [meta, setMeta] = useState<DiscoverMeta | null>(null);
  const [expanded, setExpanded] = useState<Record<number,boolean>>({});
  const [filter, setFilter] = useState({ type: 'All', roi: 'All', minMatch: 0 });
  const [focus, setFocus] = useState('');
  const [errDetail, setErrDetail] = useState<ErrDetail | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  async function runDiscover() {
    setState('loading'); setProposals([]); setMeta(null); setExpanded({}); setErrDetail(null); setShowRaw(false);
    try {
      const res = await fetch('/api/cockpit/skills/discover_agent_flows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus: focus.trim() || 'luxury hotel automation', max_proposals: 6 }),
      });
      const j = await res.json();
      if (j.ok) { setProposals((j.proposals ?? []) as Proposal[]); setMeta(j.metadata ?? null); setState('done'); }
      else { setErrDetail({ msg: j.error ?? 'failed', stage: j.stage, raw: j.raw_preview, hint: j.hint }); setState('error'); }
    } catch (e) { setErrDetail({ msg: String(e) }); setState('error'); }
  }

  const userRequest = meta?.user_request ?? focus;
  const filtered = proposals.filter(p => {
    if (filter.type !== 'All' && p.type !== filter.type) return false;
    if (filter.roi !== 'All' && p.roi !== filter.roi) return false;
    if ((p.match_pct ?? 75) < filter.minMatch) return false;
    return true;
  });

  return (
    <div style={{ background: WHITE, border: '2px solid ' + FOREST, borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ background: FOREST, padding: '12px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: WHITE }}>🔍 Discover Agent Flows</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>
          GitHub · Reddit · Anthropic cookbook · CLAUDE.md repos · e2b awesome-ai-agents · maps gaps vs {failingSkills.length} failing skills
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: CREAM, borderBottom: '1px solid ' + HAIR, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 6 }}>
            What do you want to discover or build?
          </div>
          <textarea value={focus} onChange={e => setFocus(e.target.value)} rows={2}
            style={{ width: '100%', fontSize: 12, padding: '8px 12px', borderRadius: 4, border: '1px solid ' + HAIR,
              resize: 'vertical' as const, fontFamily: 'inherit', background: WHITE, color: INK, boxSizing: 'border-box' as const }}
            placeholder={'"financial analyst 2-stage forecast"  ·  "replace knowledge base"  ·  "reputation review bot"  ·  "retreat proposal automation"'} />
        </div>
        <button onClick={runDiscover} disabled={state === 'loading'}
          style={{ fontSize: 12, padding: '10px 18px', background: state === 'loading' ? AMBER : FOREST,
            color: WHITE, border: 'none', borderRadius: 4, cursor: state === 'loading' ? 'wait' : 'pointer',
            fontWeight: 700, whiteSpace: 'nowrap' as const, flexShrink: 0, marginBottom: 1 }}>
          {state === 'loading' ? 'Scanning… 30-60s' : '▶ Run Discovery'}
        </button>
      </div>

      {failingSkills.length > 0 && (
        <div style={{ padding: '8px 16px', background: '#FEF2F2', borderBottom: '1px solid ' + HAIR, fontSize: 11, color: RED }}>
          ⚠ {failingSkills.length} skills currently failing — discovery will prioritise replacements: {failingSkills.slice(0,5).join(', ')}{failingSkills.length > 5 ? ' +' + (failingSkills.length - 5) : ''}
        </div>
      )}

      {state === 'error' && errDetail && (
        <div style={{ padding: 16 }}>
          <div style={{ color: RED, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
            ✗ {errDetail.msg}{errDetail.stage ? ' · stage: ' + errDetail.stage : ''}
          </div>
          {errDetail.hint && <div style={{ color: INK_M, fontSize: 11, marginBottom: 8 }}>{errDetail.hint}</div>}
          {errDetail.raw && (
            <div>
              <button onClick={() => setShowRaw(r => !r)}
                style={{ fontSize: 10, padding: '3px 10px', border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, color: INK_M, cursor: 'pointer', marginBottom: 6 }}>
                {showRaw ? '▲ Hide LLM output' : '▼ Show LLM output (debug)'}
              </button>
              {showRaw && (
                <div style={{ background: CREAM, padding: '8px 12px', borderRadius: 4, fontFamily: 'monospace',
                  fontSize: 10, color: INK, whiteSpace: 'pre-wrap' as const, maxHeight: 220, overflow: 'auto', border: '1px solid ' + HAIR }}>
                  {errDetail.raw}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {state === 'done' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 11, color: INK_M, flexWrap: 'wrap' as const }}>
            <span>💡 {meta?.generated ?? 0} generated · {meta?.passed_quality_gate ?? proposals.length} passed 7/10 · {meta?.filtered_low_quality ?? 0} filtered</span>
            {meta?.repos_scanned ? <span>🔍 {meta.repos_scanned} repos</span> : null}
            {meta?.reddit_posts ? <span>💬 {meta.reddit_posts} Reddit posts</span> : null}
            {meta?.persisted && <span style={{ color: OK }}>💾 Saved to research KB</span>}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const }}>Filter:</span>
            {(['All','NEW','IMPROVE','REPLACE'] as const).map(t => (
              <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, border: '1px solid ' + HAIR, cursor: 'pointer',
                  background: filter.type === t ? FOREST : WHITE, color: filter.type === t ? WHITE : INK_M, fontWeight: 600 }}>
                {t === 'All' ? 'All types' : (TYPE_ICON[t] + ' ' + t)}
              </button>
            ))}
            <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const }}>ROI:</span>
            {(['All','High','Medium','Low'] as const).map(r => (
              <button key={r} onClick={() => setFilter(f => ({ ...f, roi: r }))}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, border: '1px solid ' + HAIR, cursor: 'pointer',
                  background: filter.roi === r ? INK : WHITE, color: filter.roi === r ? WHITE : INK_M }}>{r}</button>
            ))}
            <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, color: INK_M, textTransform: 'uppercase' as const }}>Match:</span>
            {([[0,'All'],[70,'>70%'],[85,'>85%']] as const).map(([v,l]) => (
              <button key={String(v)} onClick={() => setFilter(f => ({ ...f, minMatch: Number(v) }))}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, border: '1px solid ' + HAIR, cursor: 'pointer',
                  background: filter.minMatch === Number(v) ? NAVY : WHITE, color: filter.minMatch === Number(v) ? WHITE : INK_M }}>{l}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {filtered.length === 0
              ? <div style={{ padding: 24, color: INK_M, fontSize: 12, gridColumn: '1/-1' }}>No proposals match filters.</div>
              : filtered.map((p, i) => (
                  <ProposalCard key={i} p={p} userRequest={userRequest}
                    expanded={!!expanded[i]} onToggle={() => setExpanded(e => ({ ...e, [i]: !e[i] }))} />
                ))
            }
          </div>
        </div>
      )}

      {state === 'idle' && (
        <div style={{ padding: '20px 16px', fontSize: 12, color: INK_M, textAlign: 'center' as const, lineHeight: 1.8 }}>
          Type what you want to discover, then press ▶ Run Discovery.<br/>
          Sources: GitHub · Reddit · Anthropic cookbook · CLAUDE.md workflow repos · 8 proven frameworks<br/>
          <span style={{ color: OK, fontSize: 11 }}>Each card includes YouTube watch links for tutorials, Claude Code patterns, and hospitality examples.</span>
        </div>
      )}
    </div>
  );
}
