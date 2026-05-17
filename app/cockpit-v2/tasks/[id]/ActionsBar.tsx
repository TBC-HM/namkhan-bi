'use client';

// app/cockpit-v2/tasks/[id]/ActionsBar.tsx
//
// PBS 2026-05-17: every awaits_user / open ticket needs actionable CTAs.
// Approve → mark completed · Respond → add note + change status · Dismiss → archive.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TOKENS, SERIF, MONO } from '../../_components/tokens';

const TERMINAL = new Set(['completed', 'archived', 'triage_failed', 'done']);

export function ActionsBar({ id, status }: { id: number; status: string }) {
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [respondOpen, setRespondOpen] = useState(false);
  const [note, setNote] = useState('');
  const [respondStatus, setRespondStatus] = useState<'keep' | 'completed' | 'triaged'>('keep');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isTerminal = TERMINAL.has(status);

  async function patchStatus(newStatus: string) {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch('/api/cockpit/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) {
        setErr(body?.error || `HTTP ${res.status}`);
        return;
      }
      setMsg(`status → ${newStatus}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitResponse() {
    if (!note.trim()) { setErr('note required'); return; }
    setBusy(true); setMsg(null); setErr(null);
    try {
      const res = await fetch('/api/cockpit/tickets/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, note,
          new_status: respondStatus === 'keep' ? null : respondStatus,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) {
        setErr(body?.error || `HTTP ${res.status}`);
        return;
      }
      setMsg('response saved');
      setNote('');
      setRespondOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 20, padding: 14, background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 2 }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: TOKENS.text3, marginBottom: 10,
      }}>
        Resolve this ticket
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!isTerminal && (
          <>
            <button type="button" disabled={busy} onClick={() => patchStatus('completed')} style={btn(TOKENS.forest)}>
              ✓ Approve / Complete
            </button>
            <button type="button" disabled={busy} onClick={() => setRespondOpen((o) => !o)} style={btn(TOKENS.brass)}>
              ✎ Respond
            </button>
            <button type="button" disabled={busy} onClick={() => patchStatus('archived')} style={btn('#E07856')}>
              ✗ Dismiss / Archive
            </button>
          </>
        )}
        {isTerminal && (
          <>
            <button type="button" disabled={busy} onClick={() => patchStatus('triaged')} style={btn(TOKENS.brass)}>
              ↺ Reopen
            </button>
            <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
              currently <strong>{status}</strong> — terminal state, no further action needed.
            </span>
          </>
        )}
        {msg && <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.forest, marginLeft: 'auto' }}>✓ {msg}</span>}
        {err && <span style={{ fontFamily: MONO, fontSize: 11, color: '#E07856', marginLeft: 'auto' }}>✗ {err}</span>}
      </div>

      {respondOpen && (
        <div style={{ marginTop: 12, padding: 12, background: TOKENS.bgDeep, borderRadius: 2 }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Your response or next-step note (will be appended to ticket.notes)"
            style={{
              width: '100%', padding: 10, borderRadius: 2,
              background: TOKENS.bgRaised, color: TOKENS.text,
              border: `1px solid ${TOKENS.border}`,
              fontFamily: MONO, fontSize: 12, resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3 }}>
              after saving → status:
              <select
                value={respondStatus}
                onChange={(e) => setRespondStatus(e.target.value as any)}
                style={{
                  marginLeft: 6, padding: '4px 8px', background: TOKENS.bgRaised, color: TOKENS.text,
                  border: `1px solid ${TOKENS.border}`, fontFamily: MONO, fontSize: 11,
                }}
              >
                <option value="keep">keep current ({status})</option>
                <option value="triaged">back to triaged</option>
                <option value="completed">mark completed</option>
              </select>
            </label>
            <button type="button" disabled={busy || !note.trim()} onClick={submitResponse} style={btn(TOKENS.brass)}>
              Save response
            </button>
            <button type="button" disabled={busy} onClick={() => { setRespondOpen(false); setNote(''); }} style={btn(TOKENS.text3)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 2,
    background: 'transparent', color,
    border: `1px solid ${color}`,
    fontFamily: SERIF, fontSize: 13, cursor: 'pointer',
  };
}
