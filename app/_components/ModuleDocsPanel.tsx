'use client';

// app/_components/ModuleDocsPanel.tsx
// PBS 2026-07-23: filterable list of Marketing module spec docs.
// Reads from public.v_documents_latest (bridge over documentation.documents).
// Version replacement is automatic via UNIQUE(doc_type) on the underlying table —
// bumping a version UPDATEs the row in place, so this list stays deduped without
// client-side work.

import { useMemo, useState } from 'react';
import TenantLink from '@/components/nav/TenantLink';

export interface ModuleDocRow {
  doc_type: string;
  title: string;
  version: number;
  status: string;
  last_updated_at: string;
  md_length: number;
}

interface Props {
  docs: ModuleDocRow[];
}

const TYPE_LABEL: Record<string, string> = {
  gbp_module:        'Google Business Profile',
  media_module:      'Media',
  newsletter_module: 'Newsletter',
  socials_module:    'Socials',
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ModuleDocsPanel({ docs }: Props) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return docs;
    return docs.filter((d) =>
      d.doc_type.toLowerCase().includes(needle) ||
      d.title.toLowerCase().includes(needle) ||
      (TYPE_LABEL[d.doc_type] ?? '').toLowerCase().includes(needle)
    );
  }, [docs, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter modules…"
        style={inputStyle}
      />

      {filtered.length === 0 ? (
        <div style={emptyStyle}>No modules match “{q}”.</div>
      ) : (
        <ul style={listStyle}>
          {filtered.map((d) => (
            <li key={d.doc_type} style={rowStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <span style={typeLabelStyle}>{TYPE_LABEL[d.doc_type] ?? d.doc_type}</span>
                <span style={titleStyle}>{d.title}</span>
                <span style={metaStyle}>
                  v{d.version} · {d.status} · {shortDate(d.last_updated_at)}
                </span>
              </div>
              <TenantLink
                href={`/holding/it/module/${encodeURIComponent(d.doc_type)}`}
                style={previewBtnStyle}
              >
                Preview
              </TenantLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 8px',
  border: '1px solid #E6DFCC',
  borderRadius: 3,
  background: '#FFFFFF',
  color: '#1B1B1B',
  outline: 'none',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 4px',
  borderBottom: '1px solid #E6DFCC',
};

const typeLabelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: '#C79A6B',
};

const titleStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#1B1B1B',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const metaStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#5A5A5A',
  fontStyle: 'italic',
};

const previewBtnStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontWeight: 600,
  padding: '4px 8px',
  borderRadius: 3,
  background: 'var(--primary, #1F3A2E)',
  color: '#FFFFFF',
  textDecoration: 'none',
  flexShrink: 0,
  alignSelf: 'center',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#5A5A5A',
  fontStyle: 'italic',
  padding: '8px 4px',
};
