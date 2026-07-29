'use client';

// components/university/CommandPalette.tsx
// TBC University · global Cmd+K / Ctrl+K search palette (design item 1,
// brief autospec-university_module-20260725). Mounted app-wide in the root
// layout next to HelpButton. Search-first: instant FTS over university
// articles + KPI reference + learning paths via /api/university/search;
// the last row hands the query to Ask-AI (/api/university/ask) for a
// grounded answer with citations. House palette only (design_system U.2).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';
const WARM = '#F5F0E1';
const GOLD = '#B48A3A';
const RED = '#B03826';

type ArticleHit = { slug: string; module: string; article_type: string; title: string; purpose: string };
type KpiHit = { kpi_id: number; kpi_name: string; family: string | null; section: string | null };
type PathHit = { role_key: string; title: string; description: string | null };
type Citation = { slug: string; title: string; module: string };

type Row =
  | { kind: 'article'; href: string; primary: string; secondary: string }
  | { kind: 'kpi'; href: string; primary: string; secondary: string }
  | { kind: 'path'; href: string; primary: string; secondary: string }
  | { kind: 'ask'; href: null; primary: string; secondary: string };

const GROUP_LABEL: Record<Row['kind'], string> = {
  article: 'Articles', kpi: 'KPI reference', path: 'Learning paths', ask: 'Ask AI',
};

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState(0);
  const [searching, setSearching] = useState(false);
  const [asking, setAsking] = useState(false);
  const [askAnswer, setAskAnswer] = useState<{ answer: string; citations: Citation[] } | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  // Global hotkey: Cmd+K (mac) / Ctrl+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQ(''); setRows([]); setSel(0); setAskAnswer(null); setAskError(null); setAsking(false);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    setAskAnswer(null); setAskError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = q.trim();
    if (query.length < 2) { setRows([]); setSel(0); return; }
    debounceRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      setSearching(true);
      try {
        const r = await fetch('/api/university/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query }),
        });
        const j = (await r.json()) as {
          ok: boolean; articles?: ArticleHit[]; kpis?: KpiHit[]; paths?: PathHit[];
        };
        if (seq !== seqRef.current) return; // stale response
        const next: Row[] = [];
        for (const a of j.articles ?? []) {
          next.push({
            kind: 'article',
            href: `/university/${a.module}/${a.slug}`,
            primary: a.title,
            secondary: `${a.module} · ${a.article_type.replace(/_/g, ' ')}`,
          });
        }
        for (const k of j.kpis ?? []) {
          next.push({
            kind: 'kpi',
            href: `/university/kpi/${k.kpi_id}`,
            primary: `KPI ${k.kpi_id} — ${k.kpi_name}`,
            secondary: [k.family, k.section].filter(Boolean).join(' · ') || 'KPI reference',
          });
        }
        for (const p of j.paths ?? []) {
          next.push({
            kind: 'path',
            href: `/university/paths/${p.role_key}`,
            primary: p.title,
            secondary: p.description ?? 'Learning path',
          });
        }
        next.push({
          kind: 'ask', href: null,
          primary: `Ask TBC University: “${query}”`,
          secondary: 'Grounded answer with citations from the article corpus',
        });
        setRows(next);
        setSel(0);
      } catch {
        if (seq === seqRef.current) {
          setRows([{ kind: 'ask', href: null, primary: `Ask TBC University: “${query}”`, secondary: 'Search unavailable — ask instead' }]);
          setSel(0);
        }
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, open]);

  const ask = useCallback(async () => {
    const question = q.trim();
    if (!question || asking) return;
    setAsking(true); setAskAnswer(null); setAskError(null);
    try {
      const r = await fetch('/api/university/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, route: typeof window !== 'undefined' ? window.location.pathname : null }),
      });
      const j = (await r.json()) as { ok: boolean; answer?: string; citations?: Citation[]; error?: string };
      if (j.ok && j.answer) {
        setAskAnswer({ answer: j.answer, citations: Array.isArray(j.citations) ? j.citations : [] });
      } else {
        setAskError(j.error ?? 'Something went wrong — try again.');
      }
    } catch {
      setAskError('Network error — try again.');
    } finally {
      setAsking(false);
    }
  }, [q, asking]);

  const activate = useCallback((row: Row) => {
    if (row.kind === 'ask') { void ask(); return; }
    setOpen(false);
    router.push(row.href);
  }, [ask, router]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); activate(rows[sel]); }
  };

  if (!open) return null;

  let lastKind: Row['kind'] | null = null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 9995, background: 'rgba(27,27,27,0.35)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 620, maxWidth: 'calc(100vw - 32px)', background: '#FFFFFF',
          border: `1px solid ${HAIR}`, borderTop: `3px solid ${GREEN}`, borderRadius: 8,
          boxShadow: '0 16px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${HAIR}` }}>
          <span style={{ fontSize: 15, color: INK_SOFT }}>🔎</span>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search TBC University — articles, KPIs, learning paths…"
            style={{
              flex: 1, fontSize: 15, border: 'none', outline: 'none', color: INK,
              background: 'transparent', fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: INK_SOFT, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '2px 6px' }}>ESC</span>
        </div>

        <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
          {q.trim().length < 2 && (
            <div style={{ padding: '18px 16px', fontSize: 13, color: INK_SOFT }}>
              Type to search every University article, KPI explanation and learning path.
              <div style={{ marginTop: 6, fontSize: 12 }}>Open anywhere with <b>⌘K</b> / <b>Ctrl+K</b>.</div>
            </div>
          )}

          {q.trim().length >= 2 && rows.length === 0 && !searching && (
            <div style={{ padding: '18px 16px', fontSize: 13, color: INK_SOFT }}>No matches.</div>
          )}

          {rows.map((row, i) => {
            const header = row.kind !== lastKind ? GROUP_LABEL[row.kind] : null;
            lastKind = row.kind;
            return (
              <div key={`${row.kind}-${i}`}>
                {header && (
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_SOFT }}>
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => activate(row)}
                  onMouseEnter={() => setSel(i)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    padding: '9px 16px', background: i === sel ? WARM : 'transparent',
                    borderLeft: i === sel ? `3px solid ${GREEN}` : '3px solid transparent',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 14, color: row.kind === 'ask' ? GREEN : INK, fontWeight: row.kind === 'ask' ? 600 : 500 }}>
                    {row.kind === 'ask' ? (asking ? 'Thinking…' : row.primary) : row.primary}
                  </div>
                  <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 1 }}>{row.secondary}</div>
                </button>
              </div>
            );
          })}

          {(askAnswer || askError) && (
            <div style={{ margin: '10px 16px 14px', background: WARM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px' }}>
              {askAnswer ? (
                <>
                  <div style={{ fontSize: 13.5, lineHeight: 1.65, color: INK, whiteSpace: 'pre-wrap' }}>{askAnswer.answer}</div>
                  {askAnswer.citations.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${HAIR}`, fontSize: 12, color: INK_SOFT }}>
                      From:{' '}
                      {askAnswer.citations.map((c, i) => (
                        <span key={c.slug}>
                          {i > 0 && ' · '}
                          <a
                            href={`/university/${c.module}/${c.slug}`}
                            onClick={() => setOpen(false)}
                            style={{ color: GREEN, textDecoration: 'underline', textUnderlineOffset: 2 }}
                          >
                            {c.title}
                          </a>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: RED }}>{askError}</div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 14, padding: '8px 16px', borderTop: `1px solid ${HAIR}`, fontSize: 11, color: INK_SOFT }}>
          <span>↑↓ navigate</span>
          <span>↵ open / ask</span>
          <span>esc close</span>
          <span style={{ marginLeft: 'auto', color: GOLD, fontWeight: 600 }}>TBC UNIVERSITY</span>
        </div>
      </div>
    </div>
  );
}
