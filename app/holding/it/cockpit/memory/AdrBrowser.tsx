'use client';

// app/holding/it/cockpit/memory/AdrBrowser.tsx
// A2: ADR browser with supersede/reference threads.
// Canon (§0.R R5): ADR identity = ROW ID (matches fn_brain_platform_search
// 'ADR-'||id). Title ADR-numbers have drifted from row ids (row 113 is titled
// "ADR-111: CORRECTION — Namkhan operating currency USD", row 117 is titled
// "ADR-113: School-break ranges") — when the title prefix ≠ row id a
// numbering-drift badge is shown. "Supersedes" edges come ONLY from the
// structured superseded_by column (0 rows today, may be backfilled);
// reference edges are parsed from title+decision+reasoning text (ADR-\d+),
// resolved against ROW IDs, and rendered as a thread.

import { useMemo, useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import type { AdrRow } from './MemoryView';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

type AdrNode = AdrRow & {
  titleNum: number | null;      // ADR number claimed in the title
  drift: boolean;               // title prefix ≠ row id
  refs: number[];               // row-id references parsed from text (existing rows only)
  refBy: number[];              // reverse edges
  supersededByRows: number[];   // rows whose superseded_by points here
};

function parseTitleNum(title: string | null): number | null {
  const m = (title ?? '').match(/^\s*ADR[-\s]?(\d+)/i);
  return m ? Number(m[1]) : null;
}

export function AdrBrowser({ adrs, focusAdrId }: { adrs: AdrRow[]; focusAdrId: number | null }) {
  const nodes = useMemo(() => {
    const byId = new Map<number, AdrNode>();
    for (const a of adrs) {
      byId.set(a.id, {
        ...a,
        titleNum: parseTitleNum(a.title),
        drift: false,
        refs: [],
        refBy: [],
        supersededByRows: [],
      });
    }
    for (const n of byId.values()) {
      n.drift = n.titleNum !== null && n.titleNum !== n.id;
      const text = `${n.title ?? ''}\n${n.decision ?? ''}\n${n.reasoning ?? ''}`;
      const seen = new Set<number>();
      for (const m of text.matchAll(/ADR[-\s]?(\d+)/gi)) {
        const ref = Number(m[1]);
        // row-id canon: only link references that resolve to an existing row,
        // and never self-reference
        if (ref !== n.id && byId.has(ref) && !seen.has(ref)) {
          seen.add(ref);
          n.refs.push(ref);
        }
      }
    }
    for (const n of byId.values()) {
      for (const r of n.refs) byId.get(r)!.refBy.push(n.id);
      if (n.superseded_by !== null && byId.has(n.superseded_by)) {
        byId.get(n.superseded_by)!.supersededByRows.push(n.id);
      }
    }
    return byId;
  }, [adrs]);

  const ordered = useMemo(() => Array.from(nodes.values()).sort((a, b) => b.id - a.id), [nodes]);
  const [filter, setFilter] = useState('');
  const [activeId, setActiveId] = useState<number | null>(focusAdrId);

  // honor search deep link after mount
  const [lastFocus, setLastFocus] = useState<number | null>(null);
  if (focusAdrId !== null && focusAdrId !== lastFocus) {
    setLastFocus(focusAdrId);
    setActiveId(focusAdrId);
  }

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return ordered;
    return ordered.filter(
      (n) => `adr-${n.id}`.includes(f) || (n.title ?? '').toLowerCase().includes(f) || (n.decision ?? '').toLowerCase().includes(f),
    );
  }, [ordered, filter]);

  const active = activeId !== null ? nodes.get(activeId) ?? null : null;

  return (
    <Container
      title="ADR threads"
      subtitle={`${ordered.length} decisions · identity = row id (search canon) · drift badge when the title claims a different number`}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {/* list */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by id, title, text…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
              border: '1px solid var(--hairline)', borderRadius: 8, marginBottom: 10,
              background: '#FFFFFF', color: 'var(--ink)', outline: 'none',
            }}
          />
          <div style={{ maxHeight: 560, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {shown.map((n) => (
              <button
                key={n.id}
                onClick={() => setActiveId(n.id)}
                style={{
                  textAlign: 'left', appearance: 'none', cursor: 'pointer', padding: '8px 11px',
                  borderRadius: 8,
                  background: n.id === activeId ? 'rgba(31,58,46,0.08)' : '#FFFFFF',
                  border: n.id === activeId ? '1px solid var(--primary)' : '1px solid var(--hairline)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)' }}>ADR-{n.id}</span>
                  {n.drift && <DriftBadge titleNum={n.titleNum!} />}
                  {n.superseded_by !== null && (
                    <span style={{ fontSize: 10, fontFamily: MONO, color: 'var(--status-red)' }}>superseded → {n.superseded_by}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.4 }}>{n.title ?? '(untitled)'}</div>
              </button>
            ))}
          </div>
        </div>

        {/* thread detail */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!active ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', paddingTop: 24 }}>
              Select a decision to see its thread — what it supersedes, what it references, what came after.
            </div>
          ) : (
            <AdrThread node={active} nodes={nodes} onJump={setActiveId} />
          )}
        </div>
      </div>
    </Container>
  );
}

function DriftBadge({ titleNum }: { titleNum: number }) {
  return (
    <span
      title={`Numbering drift: the title claims ADR-${titleNum} but the canonical row id differs. Cross-references resolve by ROW ID.`}
      style={{
        fontSize: 9.5, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.3,
        padding: '1px 6px', borderRadius: 8,
        background: 'rgba(184,168,120,0.25)', color: '#8a7a45',
      }}
    >
      title says ADR-{titleNum}
    </span>
  );
}

function AdrThread({
  node, nodes, onJump,
}: {
  node: AdrNode;
  nodes: Map<number, AdrNode>;
  onJump: (id: number) => void;
}) {
  const relation = (id: number, label: string) => {
    const n = nodes.get(id);
    if (!n) return null;
    return (
      <button
        key={`${label}-${id}`}
        onClick={() => onJump(id)}
        style={{
          textAlign: 'left', appearance: 'none', cursor: 'pointer', width: '100%',
          padding: '8px 11px', borderRadius: 8, background: '#FFFFFF', border: '1px solid var(--hairline)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span style={{
          fontSize: 9.5, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.3, padding: '1px 6px',
          borderRadius: 8, background: 'rgba(31,58,46,0.10)', color: 'var(--primary)', flexShrink: 0,
        }}>
          {label}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>ADR-{id}</span>
        {n.drift && <DriftBadge titleNum={n.titleNum!} />}
        <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n.title ?? '(untitled)'}
        </span>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>ADR-{node.id}</span>
          {node.drift && <DriftBadge titleNum={node.titleNum!} />}
          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
            {new Date(node.created_at).toLocaleDateString()} {node.decided_by ? `· ${node.decided_by}` : ''} {node.impact ? `· impact: ${node.impact}` : ''}
          </span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{node.title ?? '(untitled)'}</div>
      </div>

      {node.decision && (
        <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#FFFFFF', border: '1px solid var(--hairline)', borderRadius: 8, padding: '10px 12px', maxHeight: 220, overflow: 'auto' }}>
          {node.decision}
        </div>
      )}
      {node.reasoning && (
        <details>
          <summary style={{ fontSize: 12, color: 'var(--ink-soft)', cursor: 'pointer' }}>Reasoning</summary>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 6, maxHeight: 220, overflow: 'auto' }}>
            {node.reasoning}
          </div>
        </details>
      )}

      {/* thread */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {node.superseded_by !== null && nodes.has(node.superseded_by) && relation(node.superseded_by, 'SUPERSEDED BY')}
        {node.supersededByRows.map((id) => relation(id, 'SUPERSEDES'))}
        {node.refs.map((id) => relation(id, 'REFERENCES'))}
        {node.refBy.map((id) => relation(id, 'REFERENCED BY'))}
        {node.superseded_by === null && node.supersededByRows.length === 0 && node.refs.length === 0 && node.refBy.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>No thread edges — this decision stands alone.</div>
        )}
      </div>
    </div>
  );
}
