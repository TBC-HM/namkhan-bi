'use client';

import { useCallback, useEffect, useState } from 'react';

type ItemRow = {
  key: string;
  category: string;
  label: string;
  has_override: boolean;
  fs_chars: number;
  override_chars: number;
  edited_by: string | null;
  edited_at: string | null;
};

type Detail = {
  ok: boolean;
  key: string;
  fs_content: string;
  override_content: string | null;
  effective_content: string;
  has_override: boolean;
  edited_by: string | null;
  edited_at: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  'shared':         '🌐 Shared (all agents)',
  'data-agent':     '📊 Data agent',
  'doc-classifier': '🏷  Doc classifier',
  'doc-qa':         '📄 Doc Q/A',
};

export default function AgentPromptsApp() {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [editing, setEditing] = useState<Detail | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/agents/prompts');
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'load failed');
      setItems(j.items);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const openEdit = useCallback(async (key: string) => {
    setError(null);
    try {
      const r = await fetch('/api/agents/prompts?key=' + encodeURIComponent(key));
      const j = await r.json() as Detail;
      if (!j.ok) throw new Error('load failed');
      setEditing(j);
      setDraft(j.effective_content);
    } catch (e: any) { setError(e.message); }
  }, []);

  const save = useCallback(async () => {
    if (!editing) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch('/api/agents/prompts', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: editing.key, content: draft, edited_by: 'PBS' }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'save failed');
      setEditing(null);
      reload();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }, [editing, draft, reload]);

  const revert = useCallback(async () => {
    if (!editing) return;
    if (!confirm('Revert to filesystem version (delete the override)?')) return;
    try {
      await fetch('/api/agents/prompts?key=' + encodeURIComponent(editing.key),
                  { method: 'DELETE' });
      setEditing(null);
      reload();
    } catch (e: any) { setError(e.message); }
  }, [editing, reload]);

  // Group by category
  const groups = items.reduce((acc, it) => {
    if (!acc[it.category]) acc[it.category] = [];
    acc[it.category].push(it);
    return acc;
  }, {} as Record<string, ItemRow[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div style={errorBox}>{error}</div>}
      {loading && <div style={mutedNote}>Loading…</div>}

      {(['shared','data-agent','doc-classifier','doc-qa'] as const).map(cat => {
        const arr = groups[cat] || [];
        if (arr.length === 0) return null;
        return (
          <div key={cat}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              color: 'var(--brass)', marginBottom: 8,
            }}>{CATEGORY_LABEL[cat] || cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
              {arr.map(it => (
                <button
                  key={it.key}
                  onClick={() => openEdit(it.key)}
                  style={{
                    border: it.has_override ? '1px solid var(--moss)' : '1px solid var(--line-soft)',
                    background: 'var(--paper-pure)',
                    borderRadius: 4, padding: 14,
                    textAlign: 'left', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                                  fontSize: 'var(--t-lg)', color: 'var(--ink)' }}>
                      {it.label}
                    </div>
                    {it.has_override && (
                      <span style={{
                        fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                        letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                        background: 'var(--moss)', color: 'var(--paper)',
                        padding: '2px 6px', borderRadius: 2, whiteSpace: 'nowrap',
                      }}>edited</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                    {it.key} · {(it.has_override ? it.override_chars : it.fs_chars).toLocaleString()} chars
                  </div>
                  {it.has_override && (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                      edited {it.edited_at ? new Date(it.edited_at).toLocaleString() : '—'} by {it.edited_by ?? '—'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Edit modal */}
      {editing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28, 24, 21, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}
        >
          <div style={{
            background: 'var(--paper-warm)', borderRadius: 6,
            width: '100%', maxWidth: 1100, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', gap: 0,
            border: '1px solid var(--line)',
          }}>
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--line-soft)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
                  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
                  color: 'var(--brass)',
                }}>{editing.key}</div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic',
                              fontSize: 'var(--t-xl)', color: 'var(--ink)' }}>
                  {editing.has_override ? '✎ Editing override' : '✎ Creating override'}
                </div>
              </div>
              <button onClick={() => setEditing(null)} style={ghostBtn}>Close ✕</button>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{
                flex: 1, minHeight: 400,
                padding: 16,
                fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)',
                background: 'var(--paper-pure)', border: 'none',
                color: 'var(--ink)', resize: 'vertical',
                lineHeight: 1.5,
              }}
            />

            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--line-soft)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {draft.length.toLocaleString()} chars · saves to <code>docs.agent_prompt_overrides</code> · 60s cache TTL
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {editing.has_override && (
                  <button onClick={revert} style={ghostBtn}>Revert to filesystem</button>
                )}
                <button onClick={() => setEditing(null)} style={ghostBtn}>Cancel</button>
                <button onClick={save} disabled={saving || draft === editing.effective_content}
                        style={primaryBtn}>
                  {saving ? 'Saving…' : 'Save override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--moss)', color: 'var(--paper)',
  border: 'none', borderRadius: 4,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  cursor: 'pointer',
};
const ghostBtn: React.CSSProperties = {
  padding: '8px 12px',
  background: 'transparent', color: 'var(--ink-mute)',
  border: '1px solid var(--line)', borderRadius: 4,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
  cursor: 'pointer',
};
const errorBox: React.CSSProperties = {
  padding: 12, background: 'var(--st-bad-bg)',
  border: '1px solid var(--st-bad-bd)', color: 'var(--st-bad)',
  borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 'var(--t-sm)',
};
const mutedNote: React.CSSProperties = {
  padding: 12, color: 'var(--ink-mute)',
  fontFamily: 'var(--sans)', fontSize: 'var(--t-md)', fontStyle: 'italic',
};
