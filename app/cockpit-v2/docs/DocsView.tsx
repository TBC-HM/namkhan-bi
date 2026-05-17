'use client';

// app/cockpit-v2/docs/DocsView.tsx
// Pure client renderer for the three live ops docs. Uses the server-rendered
// markdown helper (renderMarkdown) but kept as a client component so users
// can switch between docs without a server roundtrip.

import { useState, useMemo } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import { Pill } from '../_components/Pill';
import { Markdown } from '../_components/Markdown';
import type { Document } from '../_lib/types';

const DOC_LABELS: Record<string, string> = {
  claude_md: 'CLAUDE.md · Operating manual',
  architecture: 'ARCHITECTURE.md · Platform architecture',
  factorial_md: 'Factorial HR · Integration',
};

export function DocsView({ docs }: { docs: Document[] }) {
  const [active, setActive] = useState(docs[0]?.doc_type ?? '');
  const current = useMemo(() => docs.find((d) => d.doc_type === active) ?? docs[0] ?? null, [docs, active]);

  if (!docs.length)
    return <div style={{ color: TOKENS.text3, fontStyle: 'italic' }}>No published documents.</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {docs.map((d) => {
          const isActive = (current?.doc_type ?? '') === d.doc_type;
          return (
            <button
              key={d.id}
              onClick={() => setActive(d.doc_type)}
              style={{
                padding: '10px 16px',
                border: `1px solid ${isActive ? TOKENS.ink : TOKENS.border}`,
                background: isActive ? TOKENS.ink : 'transparent',
                color: isActive ? TOKENS.bg : TOKENS.text,
                cursor: 'pointer',
                fontFamily: SERIF,
                fontSize: 13,
                borderRadius: 2,
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600 }}>{DOC_LABELS[d.doc_type] || d.doc_type}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75, marginTop: 2 }}>
                v{d.version} · {d.last_updated_at ? new Date(d.last_updated_at).toLocaleDateString() : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {current && (
        <article
          style={{
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.bgRaised,
            padding: 24,
            borderRadius: 2,
          }}
        >
          <header style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${TOKENS.borderSoft}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: SERIF, fontSize: 26, color: TOKENS.ink, margin: 0, fontWeight: 500 }}>{current.title}</h2>
              <Pill color={TOKENS.brass}>v{current.version}</Pill>
              <Pill>{current.status}</Pill>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 6 }}>
              doc_type={current.doc_type} · last_updated_by={current.last_updated_by || '—'} ·{' '}
              {current.last_updated_at ? new Date(current.last_updated_at).toLocaleString() : '—'} · live read from
              documentation.documents
            </div>
          </header>
          <Markdown source={current.content_md} />
        </article>
      )}
    </div>
  );
}
