'use client';
// app/holding/it2/system/laws/LawsClient.tsx
// laws-page-v1 — 188+ operating laws made digestible for PBS.
// Search + topic filters + "new this week" strip; per law: one-liner, expandable
// full text, importance, since-when, origin, supersede pointer, open-proposal
// badge. CTAs: propose change / retire — both park a law-735 question contract
// for the Decision Inbox. Nothing on this page edits a law in place (A3).

import { useMemo, useState, useTransition } from 'react';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { proposeLawChange } from './actions';

export interface LawRow {
  id: number;
  one_liner: string | null;
  content: string;
  topics: string[] | null;
  importance: number;
  memory_type: string | null;
  agent_handle: string | null;
  created_at: string;
  updated_at: string | null;
  superseded_by: number | null;
  is_new_this_week: boolean;
  open_proposals: number;
}

export interface ProposalRow {
  id: number;
  law_id: number;
  kind: string;
  status: string;
  created_at: string;
}

const UNTAGGED = 'untagged';

function primaryTopic(l: LawRow): string {
  return l.topics && l.topics.length > 0 ? l.topics[0] : UNTAGGED;
}

function originOf(l: LawRow): string {
  const handle = l.agent_handle && l.agent_handle !== 'all' ? l.agent_handle : 'platform';
  return `${handle} · ${l.memory_type ?? 'fact'}`;
}

export function LawsClient({
  laws,
  openProposals,
  loadError,
  focusLawId,
}: {
  laws: LawRow[];
  openProposals: ProposalRow[];
  loadError: string | null;
  focusLawId: number | null;
}) {
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    focusLawId ? { [focusLawId]: true } : {},
  );
  const [modal, setModal] = useState<{ law: LawRow; kind: 'change' | 'retire' } | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const proposalsByLaw = useMemo(() => {
    const m = new Map<number, ProposalRow[]>();
    for (const p of openProposals) {
      const arr = m.get(p.law_id) ?? [];
      arr.push(p);
      m.set(p.law_id, arr);
    }
    return m;
  }, [openProposals]);

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of laws) {
      const seen = new Set<string>();
      for (const t of (l.topics && l.topics.length ? l.topics : [UNTAGGED])) {
        if (seen.has(t)) continue;
        seen.add(t);
        m.set(t, (m.get(t) ?? 0) + 1);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [laws]);

  const newThisWeek = useMemo(() => laws.filter((l) => l.is_new_this_week), [laws]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return laws.filter((l) => {
      if (onlyNew && !l.is_new_this_week) return false;
      if (topic) {
        const ts = l.topics && l.topics.length ? l.topics : [UNTAGGED];
        if (!ts.includes(topic)) return false;
      }
      if (needle) {
        const hay = `${l.id} ${l.content} ${(l.topics ?? []).join(' ')} ${l.agent_handle ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [laws, q, topic, onlyNew]);

  // Grouped view (by primary topic) only in the unfiltered browse state.
  const grouped = useMemo(() => {
    if (q.trim() || topic || onlyNew) return null;
    const m = new Map<string, LawRow[]>();
    for (const l of filtered) {
      const t = primaryTopic(l);
      const arr = m.get(t) ?? [];
      arr.push(l);
      m.set(t, arr);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [filtered, q, topic, onlyNew]);

  function submitProposal() {
    if (!modal) return;
    setMsg(null);
    startTransition(async () => {
      const r = await proposeLawChange(modal.law.id, modal.kind, text);
      if (r.ok) {
        setMsg({ ok: true, text: `Parked as question #${r.proposalId} — answer it in the Decision Inbox. Nothing changes until you approve it there.` });
        setText('');
        setModal(null);
      } else {
        setMsg({ ok: false, text: r.error ?? 'failed' });
      }
    });
  }

  const card: React.CSSProperties = {
    background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
  };

  function lawCard(l: LawRow) {
    const open = !!expanded[l.id];
    const props = proposalsByLaw.get(l.id) ?? [];
    const isFocus = focusLawId === l.id;
    const pbsLocked = /PBS[- ](locked|directed|approved)/i.test(l.content);
    const adrMatch = l.content.match(/ADR-\d+/);
    return (
      <div key={l.id} id={`law-${l.id}`} style={{
        ...card, padding: '10px 14px', marginBottom: 8,
        borderColor: isFocus ? 'var(--status-amber)' : TOKENS.border,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.ink, cursor: 'pointer' }}
              onClick={() => setExpanded((e) => ({ ...e, [l.id]: !open }))}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginRight: 8 }}>#{l.id}</span>
              {(l.one_liner ?? l.content.slice(0, 140)).trim()}
              <span style={{ marginLeft: 6, fontSize: 10, color: TOKENS.text3 }}>{open ? '▲ collapse' : '▼ full text'}</span>
            </div>
            <div style={{ fontSize: 10.5, color: TOKENS.text2, fontFamily: MONO, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span title="importance">imp {l.importance}</span>
              <span title="in force since">since {l.created_at.slice(0, 10)}</span>
              <span title="origin">{originOf(l)}</span>
              {pbsLocked && <span style={{ color: 'var(--status-green)', fontWeight: 700 }}>PBS-locked</span>}
              {adrMatch && <span>{adrMatch[0]}</span>}
              {l.superseded_by != null && <span>superseded by #{l.superseded_by}</span>}
              {l.is_new_this_week && <span style={{ color: 'var(--status-amber)', fontWeight: 700 }}>new this week</span>}
              {props.length > 0 && (
                <a href="/holding/it2/questions" style={{ color: 'var(--status-red)', fontWeight: 700, textDecoration: 'none' }}>
                  {props.length} open proposal{props.length > 1 ? 's' : ''} → Decision Inbox
                </a>
              )}
            </div>
            {(l.topics ?? []).length > 0 && (
              <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(l.topics ?? []).map((t) => (
                  <button key={t} onClick={() => { setTopic(t); setOnlyNew(false); }} style={{
                    fontSize: 9.5, fontFamily: MONO, padding: '1px 7px', borderRadius: 999,
                    border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, color: TOKENS.text2, cursor: 'pointer',
                  }}>{t}</button>
                ))}
              </div>
            )}
            {open && (
              <pre style={{
                whiteSpace: 'pre-wrap', fontSize: 11.5, lineHeight: 1.55, color: TOKENS.ink,
                background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: 6,
                padding: '10px 12px', margin: '8px 0 0', fontFamily: 'inherit', overflowWrap: 'anywhere',
              }}>{l.content}</pre>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { setModal({ law: l, kind: 'change' }); setText(''); setMsg(null); }}
              disabled={props.some((p) => p.kind === 'change')}
              title="Propose a new wording — goes to the Decision Inbox for your approval"
              style={{
                fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
                opacity: props.some((p) => p.kind === 'change') ? 0.45 : 1,
              }}>Propose change</button>
            <button
              onClick={() => { setModal({ law: l, kind: 'retire' }); setText(''); setMsg(null); }}
              disabled={props.some((p) => p.kind === 'retire')}
              title="Propose retiring this law — archived with your reason after approval, never deleted"
              style={{
                fontSize: 10.5, fontWeight: 700, padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                border: '1px solid var(--status-red)', background: TOKENS.bgRaised, color: 'var(--status-red)',
                opacity: props.some((p) => p.kind === 'retire') ? 0.45 : 1,
              }}>Retire</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: TOKENS.ink }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>⚖ Operating Laws ({laws.length})</h1>
        {/* Separation note — brief §3, verbatim layer split. Never rendered in Settings. */}
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '4px 0 16px', maxWidth: 720 }}>
          Operating laws govern <b>how agents work</b>. Business guardrails (<a href="/holding/settings" style={{ color: TOKENS.ink }}>Settings</a>) govern <b>what the business allows</b>. ADRs are the decision history. Laws are never edited in place — propose a change or retirement below and approve it in the <a href="/holding/it2/questions" style={{ color: TOKENS.ink }}>Decision Inbox</a>.
        </p>

        {loadError && (
          <div style={{ ...card, borderColor: 'var(--status-red)', padding: '10px 14px', marginBottom: 12, fontSize: 12, color: 'var(--status-red)' }}>
            Load error: {loadError}
          </div>
        )}
        {msg && (
          <div style={{ ...card, borderColor: msg.ok ? 'var(--status-green)' : 'var(--status-red)', padding: '10px 14px', marginBottom: 12, fontSize: 12, color: msg.ok ? 'var(--status-green)' : 'var(--status-red)' }}>
            {msg.text}
          </div>
        )}

        {/* New this week strip */}
        {newThisWeek.length > 0 && (
          <button onClick={() => { setOnlyNew(!onlyNew); setTopic(null); }} style={{
            ...card, width: '100%', textAlign: 'left', padding: '8px 14px', marginBottom: 12,
            cursor: 'pointer', borderColor: onlyNew ? 'var(--status-amber)' : TOKENS.border,
          }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: TOKENS.ink }}>
              🆕 {newThisWeek.length} law{newThisWeek.length > 1 ? 's' : ''} new this week
            </span>
            <span style={{ fontSize: 11, color: TOKENS.text2, marginLeft: 8 }}>
              {onlyNew ? 'showing only new — click to show all' : 'click to review what changed'}
            </span>
          </button>
        )}

        {/* Search + topic filters */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search laws — text, #id, topic, agent…"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13,
            border: `1px solid ${TOKENS.border}`, borderRadius: 6, background: TOKENS.bgRaised,
            color: TOKENS.ink, marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
          {topicCounts.slice(0, 24).map(([t, n]) => (
            <button key={t} onClick={() => { setTopic(topic === t ? null : t); setOnlyNew(false); }} style={{
              fontSize: 10, fontFamily: MONO, padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${topic === t ? 'var(--status-green)' : TOKENS.border}`,
              background: topic === t ? 'var(--status-green)' : TOKENS.bgRaised,
              color: topic === t ? '#FFFFFF' : TOKENS.text2,
            }}>{t} <b>{n}</b></button>
          ))}
          {(topic || q || onlyNew) && (
            <button onClick={() => { setTopic(null); setQ(''); setOnlyNew(false); }} style={{
              fontSize: 10, padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, color: TOKENS.ink, fontWeight: 700,
            }}>× clear ({filtered.length} shown)</button>
          )}
        </div>

        {/* Law list — grouped by primary topic when browsing, flat when filtering */}
        {filtered.length === 0 ? (
          <div style={{ ...card, padding: 28, textAlign: 'center', fontSize: 12.5, color: TOKENS.text2 }}>
            No law matches this search. Laws live in cockpit_agent_memory (importance ≥ 8, active) — if one is missing here, it is not binding.
          </div>
        ) : grouped ? (
          grouped.map(([t, ls]) => (
            <div key={t} style={{ marginBottom: 18 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.text2, margin: '0 0 6px' }}>
                {t} ({ls.length})
              </h2>
              {ls.map(lawCard)}
            </div>
          ))
        ) : (
          filtered.map(lawCard)
        )}
      </div>

      {/* Proposal modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.45)', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => !pending && setModal(null)}>
          <div style={{ ...card, maxWidth: 560, width: '100%', padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              {modal.kind === 'change' ? 'Propose new wording' : 'Propose retirement'} — law #{modal.law.id}
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.text2, marginBottom: 10 }}>
              {modal.kind === 'change'
                ? 'Write the full replacement text. On approval a NEW law row is created and the old one is archived pointing to it — update-forward, nothing deleted.'
                : 'Say why this law should stop binding agents. On approval it is archived with this reason — never deleted.'}
              {' '}This parks a question in the Decision Inbox; nothing changes until it is approved there.
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap', fontSize: 10.5, maxHeight: 120, overflow: 'auto',
              background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: 6,
              padding: '8px 10px', margin: '0 0 10px', color: TOKENS.text2, fontFamily: 'inherit',
            }}>{modal.law.content}</pre>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={modal.kind === 'change' ? 8 : 3}
              placeholder={modal.kind === 'change' ? 'Proposed replacement text…' : 'Reason for retiring…'}
              style={{
                width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: '8px 10px',
                border: `1px solid ${TOKENS.border}`, borderRadius: 6, background: TOKENS.bgRaised,
                color: TOKENS.ink, resize: 'vertical',
              }}
            />
            {msg && !msg.ok && (
              <div style={{ fontSize: 11.5, color: 'var(--status-red)', marginTop: 6 }}>{msg.text}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setModal(null)} disabled={pending} style={{
                fontSize: 11.5, fontWeight: 700, padding: '7px 14px', borderRadius: 5, cursor: 'pointer',
                border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.ink,
              }}>Cancel</button>
              <button onClick={submitProposal} disabled={pending || text.trim().length < 10} style={{
                fontSize: 11.5, fontWeight: 700, padding: '7px 16px', borderRadius: 5, cursor: 'pointer',
                border: 'none', background: 'var(--status-green)', color: '#FFFFFF',
                opacity: pending || text.trim().length < 10 ? 0.55 : 1,
              }}>{pending ? 'Parking…' : 'Park question for PBS →'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
