'use client';

// app/holding/it/cockpit/releases/ReleasePicker.tsx
// Client-side release browser: pick a release row → see its generated
// changelog (Markdown) + sha256-signed doc snapshot refs.
// Brief documentation-architecture-v2 · rule 597 auditor lens.

import { useMemo, useState, type CSSProperties } from 'react';
import { Container } from '@/app/(cockpit)/_design';
import { Markdown } from '../_components/Markdown';
import { TOKENS, MONO } from '../_components/tokens';
import type { Release } from './page';

export function ReleasePicker({ releases }: { releases: Release[] }) {
  const [activeId, setActiveId] = useState<number>(releases[0]?.id ?? 0);
  const current = useMemo(
    () => releases.find((r) => r.id === activeId) ?? releases[0] ?? null,
    [releases, activeId],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <nav style={S.strip} role="tablist" aria-label="Releases">
        {releases.map((r) => {
          const isActive = current?.id === r.id;
          const isPlatform = r.scope === 'platform';
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(r.id)}
              style={{ ...S.tab, ...(isActive ? S.tabActive : null) }}
            >
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span>
                  {isPlatform ? `Platform ${r.semver}` : `${r.scope.slice(7)} ${r.semver}`}
                </span>
                <span style={S.tabMeta}>
                  {new Date(r.released_at).toLocaleDateString()} · {r.approved_by.split('·')[0].trim()}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {current && (
        <>
          <Container
            title={current.scope === 'platform' ? `Platform release ${current.semver}` : `Module release · ${current.scope.slice(7)} · ${current.semver}`}
            subtitle={`released ${new Date(current.released_at).toLocaleString()} · approved by ${current.approved_by} · append-only row #${current.id}`}
          >
            <Markdown source={current.changelog_md ?? '_no changelog generated_'} />
          </Container>

          <Container
            title="Signed doc snapshots"
            subtitle="Every ref pins doc_type + version + documents_history row + sha256 of content_md — verify a doc against its release by re-hashing."
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {['doc_type', 'version', 'hist_id', 'sha256'].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(current.doc_snapshot_refs ?? []).map((ref) => (
                    <tr key={ref.doc_type}>
                      <td style={S.td}>{ref.doc_type}</td>
                      <td style={S.td}>v{ref.version}</td>
                      <td style={S.td}>{ref.hist_id ?? '—'}</td>
                      <td style={{ ...S.td, fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
                        {ref.sha256.slice(0, 16)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>
        </>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  strip: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  tab: {
    fontFamily: MONO, fontSize: 12, textAlign: 'left', cursor: 'pointer',
    padding: '7px 12px', borderRadius: 6,
    border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised, color: TOKENS.text2,
  },
  tabActive: {
    border: `1px solid ${TOKENS.forest}`, background: TOKENS.forest, color: '#FFFFFF',
  },
  tabMeta: {
    fontSize: 10, opacity: 0.75, letterSpacing: 0.3,
  },
  th: {
    textAlign: 'left', borderBottom: `1px solid ${TOKENS.border}`, padding: '6px 10px',
    fontFamily: MONO, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: TOKENS.text3,
  },
  td: {
    borderBottom: `1px solid ${TOKENS.border}`, padding: '6px 10px', color: TOKENS.text,
  },
};
