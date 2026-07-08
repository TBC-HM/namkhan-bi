'use client';

// app/operations/qa/agent-instructions/_components/AgentInstructionsEditor.tsx
// PBS 2026-07-08: Editor for the SOP generator's system prompt. Save creates
// a new version via fn_sop_agent_instructions_save (RPC). Restore flips an
// older version active via fn_sop_agent_instructions_restore.
//
// Paper-white + hairlines. No var(--paper-warm). No function props from server.

import { useState } from 'react';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const CREAM = '#F5F0E1';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const INK_L = '#8A8A8A';
const ACCENT = '#0F5B4A';
const AMBER = '#B8860B';
const RED   = '#B00020';

export interface InstructionRow {
  id: number;
  scope: string;
  version: number;
  body: string;
  active: boolean;
  updated_at: string;
  updated_by: string | null;
}

interface Props {
  initialActive: InstructionRow | null;
  history: InstructionRow[];
}

function fmt(s: string): string {
  try { return new Date(s).toISOString().replace('T', ' ').slice(0, 16); }
  catch { return s; }
}

export default function AgentInstructionsEditor({ initialActive, history }: Props) {
  const [body, setBody] = useState<string>(initialActive?.body ?? '');
  const [author, setAuthor] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const dirty = body !== (initialActive?.body ?? '');

  async function onSave() {
    if (busy) return;
    if (!body.trim()) { setErr('Body cannot be empty.'); return; }
    if (!dirty) { setMsg('No changes to save.'); return; }
    if (!confirm(`Save as a new active version? Previous v${initialActive?.version ?? 0} will remain in history.`)) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch('/api/sop/agent-instructions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, updated_by: author.trim() || 'pbs' }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg(`Saved as v${j.row?.version}. Reloading…`);
      setTimeout(() => { window.location.reload(); }, 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function onRestore(row: InstructionRow) {
    if (busy) return;
    if (!confirm(`Restore v${row.version} as active? Current v${initialActive?.version ?? 0} will become inactive (still viewable in history).`)) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch('/api/sop/agent-instructions/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg(`Restored v${row.version}. Reloading…`);
      setTimeout(() => { window.location.reload(); }, 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const card: React.CSSProperties = {
    background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6,
    padding: 20, marginBottom: 12,
  };
  const label: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    color: INK_S, marginBottom: 6,
  };
  const control: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid ' + HAIR, borderRadius: 4,
    fontSize: 13, fontFamily: 'inherit', color: INK, background: WHITE,
  };

  return (
    <div>
      {/* Active version banner */}
      {initialActive ? (
        <div style={{
          background: '#EAF3EE', border: '1px solid ' + ACCENT, borderRadius: 6,
          padding: '8px 14px', marginBottom: 12, fontSize: 12, color: ACCENT,
          display: 'flex', gap: 12, alignItems: 'baseline',
        }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Active</span>
          <span>v{initialActive.version} · saved {fmt(initialActive.updated_at)}{initialActive.updated_by ? ` by ${initialActive.updated_by}` : ''}</span>
        </div>
      ) : (
        <div style={{
          background: '#FFF7E5', border: '1px solid ' + AMBER, borderRadius: 6,
          padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#5C4A15',
        }}>
          No active instruction. Save a body below to create v1.
        </div>
      )}

      {/* Editor */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 12 }}>
          Edit system prompt
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={label}>Instruction body (sent as the LLM system message)</label>
          <textarea
            style={{ ...control, minHeight: 380, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, lineHeight: 1.5 }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="You are a senior hotel operations consultant writing a Standard Operating Procedure (SOP)..."
          />
          <div style={{ fontSize: 10, color: INK_L, marginTop: 4 }}>
            {body.length} characters · {body.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Saved by (optional)</label>
            <input
              style={control}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="pbs"
            />
          </div>
          <div />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={onSave}
            disabled={busy || !dirty}
            style={{
              padding: '8px 16px',
              border: '1px solid ' + ACCENT,
              background: (busy || !dirty) ? '#B0C7BE' : ACCENT,
              color: WHITE,
              borderRadius: 4, fontSize: 12, fontWeight: 600,
              cursor: (busy || !dirty) ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {busy ? 'Saving…' : 'Save as new version'}
          </button>
          {msg && <span style={{ fontSize: 11, color: ACCENT }}>{msg}</span>}
          {err && <span style={{ fontSize: 11, color: RED, fontWeight: 600 }}>{err}</span>}
          {!dirty && !busy && !msg && !err && (
            <span style={{ fontSize: 11, color: INK_L }}>No unsaved changes.</span>
          )}
        </div>
      </div>

      {/* Version history */}
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 12 }}>
          Version history · {history.length} version{history.length === 1 ? '' : 's'}
        </div>
        {history.length === 0 ? (
          <div style={{ fontSize: 12, color: INK_M, padding: 12 }}>
            No versions yet. Save above to create the first one.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Version', 'Status', 'Saved at', 'By', 'Body preview', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '8px 12px', textAlign: i === 5 ? 'right' : 'left',
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: INK_S,
                    borderBottom: '1px solid ' + HAIR, background: WHITE, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: INK, borderBottom: '1px solid ' + CREAM, verticalAlign: 'top', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    v{r.version}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid ' + CREAM, verticalAlign: 'top' }}>
                    {r.active ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        background: '#EAF3EE', color: ACCENT, border: '1px solid ' + ACCENT,
                      }}>Active</span>
                    ) : (
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                        background: CREAM, color: INK_L, border: '1px solid ' + HAIR,
                      }}>Archived</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: INK_S, borderBottom: '1px solid ' + CREAM, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {fmt(r.updated_at)}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: INK_S, borderBottom: '1px solid ' + CREAM, verticalAlign: 'top' }}>
                    {r.updated_by ?? '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: INK_M, borderBottom: '1px solid ' + CREAM, verticalAlign: 'top', maxWidth: 480, lineHeight: 1.4 }}>
                    {r.body.slice(0, 180)}{r.body.length > 180 ? '…' : ''}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: '1px solid ' + CREAM, verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        style={{
                          padding: '4px 10px', border: '1px solid ' + HAIR,
                          background: WHITE, color: INK,
                          borderRadius: 4, fontSize: 10, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onClick={() => { setBody(r.body); setMsg(`Loaded v${r.version} into editor. Click Save as new version to publish.`); setErr(null); }}
                        disabled={busy}
                      >
                        Load
                      </button>
                      {!r.active && (
                        <button
                          style={{
                            padding: '4px 10px', border: '1px solid ' + ACCENT,
                            background: ACCENT, color: WHITE,
                            borderRadius: 4, fontSize: 10, fontWeight: 600,
                            cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                            opacity: busy ? 0.55 : 1,
                          }}
                          onClick={() => onRestore(r)}
                          disabled={busy}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
