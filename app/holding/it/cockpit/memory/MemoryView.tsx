'use client';

// app/holding/it/cockpit/memory/MemoryView.tsx
// Platform Memory shell — four sections (brief §5):
//   Docs   — per-doc_type version timeline + two-version side-by-side diff
//   ADRs   — decision browser with supersede/reference threads (row-id canon)
//   Rules  — canon rule browser + merge-cluster consolidation workflow
//   Why    — why-search over docs/ADRs/rules/briefs via fn_brain_platform_search
// Deep links: search hits jump into the matching section (§0.R R3 — the RPC's
// legacy `link` column is ignored; (kind, ref) is mapped client-side here).
// Design: cockpit tokens only (--paper/--ink/--hairline/--primary/--ink-soft).

import { useState } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import { DocBrowser } from './DocBrowser';
import { AdrBrowser } from './AdrBrowser';
import { RulesBrowser } from './RulesBrowser';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

export type DocVersionRow = {
  doc_type: string; version: number; title: string | null; status: string | null;
  last_updated_by: string | null; last_updated_at: string | null;
  snapshotted_at: string; md_len: number | null; hist_id: number;
};
export type AdrRow = {
  id: number; title: string | null; decision: string | null; reasoning: string | null;
  superseded_by: number | null; created_at: string; decided_by: string | null; impact: string | null;
};
export type RuleRow = {
  id: number; agent_handle: string; memory_type: string | null; content: string;
  topics: string[] | null; importance: number | null; active: boolean | null;
  superseded_by: number | null; archived_reason: string | null; updated_at: string | null;
};
export type ProposalRow = {
  id: number; content: string; archived_at: string | null; archived_reason: string | null;
  updated_at: string | null; created_at: string | null;
};

export type SectionKey = 'docs' | 'adrs' | 'rules' | 'search';

type SearchHit = {
  kind: string; ref: string; title: string | null; status: string | null;
  snippet: string | null; link: string | null; rank: number | null;
};

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'docs',   label: 'Doc versions' },
  { key: 'adrs',   label: 'ADR threads' },
  { key: 'rules',  label: 'Rules & consolidation' },
  { key: 'search', label: 'Why-search' },
];

export function MemoryView({
  versions, adrs, rules, proposals,
}: {
  versions: DocVersionRow[]; adrs: AdrRow[]; rules: RuleRow[]; proposals: ProposalRow[];
}) {
  const [section, setSection] = useState<SectionKey>('docs');
  // deep-link targets set by search hits
  const [focusDocType, setFocusDocType] = useState<string | null>(null);
  const [focusAdrId, setFocusAdrId] = useState<number | null>(null);
  const [focusRuleId, setFocusRuleId] = useState<number | null>(null);

  function jumpTo(hit: SearchHit) {
    // ref shapes from fn_brain_platform_search: doc:<doc_type> · ADR-<row id> ·
    // memory#<id> · brief slug · uni slug (§0.R R3).
    if (hit.kind === 'doc') {
      setFocusDocType(hit.ref.replace(/^doc:/, ''));
      setSection('docs');
    } else if (hit.kind === 'adr') {
      const m = hit.ref.match(/(\d+)/);
      if (m) { setFocusAdrId(Number(m[1])); setSection('adrs'); }
    } else if (hit.kind === 'rule') {
      const m = hit.ref.match(/(\d+)/);
      if (m) { setFocusRuleId(Number(m[1])); setSection('rules'); }
    } else if (hit.kind === 'brief') {
      window.open('/holding/it/cockpit/briefs', '_blank');
    } else if (hit.link) {
      window.open(hit.link, '_blank');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
          Platform Memory
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '4px 0 0' }}>
          How we came to where we are — every doc version, decision, rule and schema change, findable and diffable.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--hairline)', paddingBottom: 0 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            style={{
              appearance: 'none', background: 'none', cursor: 'pointer',
              padding: '8px 14px', fontSize: 12.5, fontFamily: MONO, fontWeight: 600,
              color: section === s.key ? 'var(--primary)' : 'var(--ink-soft)',
              border: 'none',
              borderBottom: section === s.key ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'docs' && (
        <DocBrowser versions={versions} focusDocType={focusDocType} />
      )}
      {section === 'adrs' && (
        <AdrBrowser adrs={adrs} focusAdrId={focusAdrId} />
      )}
      {section === 'rules' && (
        <RulesBrowser rules={rules} proposals={proposals} focusRuleId={focusRuleId} />
      )}
      {section === 'search' && <WhySearch onJump={jumpTo} />}
    </div>
  );
}

// ── Why-search ───────────────────────────────────────────────────────────────

function WhySearch({ onJump }: { onJump: (hit: SearchHit) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    const query = q.trim();
    if (!query || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/holding/it/cockpit/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'search', q: query }),
      });
      const j = (await r.json()) as { results?: SearchHit[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setHits(j.results ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const KIND_LABEL: Record<string, string> = {
    doc: 'DOC', adr: 'ADR', rule: 'RULE', brief: 'BRIEF', uni: 'UNI',
  };

  return (
    <Container title="Why-search" subtitle="Ask why something is the way it is — answers cite docs, ADRs and rules.">
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
          placeholder='e.g. "why is Namkhan revenue in USD" · "who decided the calendar atom"'
          style={{
            flex: 1, padding: '9px 12px', fontSize: 13, color: 'var(--ink)',
            border: '1px solid var(--hairline)', borderRadius: 8, background: '#FFFFFF', outline: 'none',
          }}
        />
        <button
          onClick={() => void run()}
          disabled={busy || !q.trim()}
          style={{
            padding: '9px 18px', fontSize: 12.5, fontFamily: MONO, fontWeight: 700,
            background: 'var(--primary)', color: '#FFFFFF', border: 'none', borderRadius: 8,
            cursor: busy ? 'wait' : 'pointer', opacity: busy || !q.trim() ? 0.6 : 1,
          }}
        >
          {busy ? 'Searching…' : 'Search'}
        </button>
      </div>

      {err && <div style={{ fontSize: 12.5, color: 'var(--status-red)', marginBottom: 10 }}>{err}</div>}

      {hits !== null && hits.length === 0 && !busy && (
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          No canon hit. Note: search covers current doc versions, not historical snapshots — use the Doc versions diff for &ldquo;what changed&rdquo; questions.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(hits ?? []).map((h, i) => (
          <button
            key={`${h.kind}-${h.ref}-${i}`}
            onClick={() => onJump(h)}
            style={{
              textAlign: 'left', cursor: 'pointer', appearance: 'none', background: '#FFFFFF',
              border: '1px solid var(--hairline)', borderRadius: 8, padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 10, fontFamily: MONO, fontWeight: 700, letterSpacing: 0.4,
                padding: '2px 7px', borderRadius: 9,
                background: 'rgba(31,58,46,0.10)', color: 'var(--primary)',
              }}>
                {KIND_LABEL[h.kind] ?? h.kind.toUpperCase()}
              </span>
              <span style={{ fontSize: 11, fontFamily: MONO, color: 'var(--ink-soft)' }}>{h.ref}</span>
              {h.status && <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>· {h.status}</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{h.title ?? h.ref}</div>
            {h.snippet && (
              <div
                style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.5 }}
                // ts_headline emits <b> tags around match terms
                dangerouslySetInnerHTML={{ __html: h.snippet }}
              />
            )}
          </button>
        ))}
      </div>
    </Container>
  );
}
