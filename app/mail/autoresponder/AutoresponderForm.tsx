'use client';
// app/mail/autoresponder/AutoresponderForm.tsx
// Client-side form for vacation reply settings. Talks to
// /api/mail/autoresponder (GET current row, POST upsert, DELETE clear).

import { useCallback, useEffect, useState } from 'react';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const RED   = '#B03826';
const CREAM = '#F5F0E1';

interface Settings {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  subject_prefix: string;
  body: string;
}

const EMPTY: Settings = {
  is_active: false,
  starts_at: null,
  ends_at: null,
  subject_prefix: 'Re: ',
  body: '',
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export default function AutoresponderForm() {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [state, setState] = useState<Settings>(EMPTY);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/mail/autoresponder', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j?.ok !== false && j?.data) {
        const d = j.data as Partial<Settings>;
        setState({
          is_active: !!d.is_active,
          starts_at: (d.starts_at as string | null) ?? null,
          ends_at:   (d.ends_at as string | null) ?? null,
          subject_prefix: d.subject_prefix ?? 'Re: ',
          body: d.body ?? '',
        });
      } else {
        setState(EMPTY);
      }
    } catch {
      setState(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const save = useCallback(async () => {
    setSaving(true);
    setFlash(null);
    try {
      const r = await fetch('/api/mail/autoresponder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(state),
      });
      const j = await r.json();
      if (r.ok && j?.ok !== false) {
        setFlash({ kind: 'ok', msg: 'Saved.' });
      } else {
        setFlash({ kind: 'err', msg: j?.error ?? 'Save failed.' });
      }
    } catch (e) {
      setFlash({ kind: 'err', msg: e instanceof Error ? e.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }, [state]);

  const clear = useCallback(async () => {
    if (!confirm('Delete auto-responder settings?')) return;
    setSaving(true);
    setFlash(null);
    try {
      const r = await fetch('/api/mail/autoresponder', { method: 'DELETE' });
      const j = await r.json();
      if (r.ok && j?.ok !== false) {
        setState(EMPTY);
        setFlash({ kind: 'ok', msg: 'Cleared.' });
      } else {
        setFlash({ kind: 'err', msg: j?.error ?? 'Clear failed.' });
      }
    } catch (e) {
      setFlash({ kind: 'err', msg: e instanceof Error ? e.message : 'Clear failed.' });
    } finally {
      setSaving(false);
    }
  }, []);

  if (loading) {
    return <div style={{ fontSize: 13, color: INK_M }}>Loading…</div>;
  }

  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: INK }}>
        <input
          type="checkbox"
          checked={state.is_active}
          onChange={(e) => setState((s) => ({ ...s, is_active: e.target.checked }))}
        />
        Auto-responder active
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: INK_M }}>Starts at (optional)</label>
          <input
            type="datetime-local"
            value={toLocalInputValue(state.starts_at)}
            onChange={(e) => setState((s) => ({ ...s, starts_at: fromLocalInputValue(e.target.value) }))}
            style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: '6px 8px', fontSize: 12, color: INK, background: WHITE }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: INK_M }}>Ends at (optional)</label>
          <input
            type="datetime-local"
            value={toLocalInputValue(state.ends_at)}
            onChange={(e) => setState((s) => ({ ...s, ends_at: fromLocalInputValue(e.target.value) }))}
            style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: '6px 8px', fontSize: 12, color: INK, background: WHITE }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: INK_M }}>Subject prefix</label>
        <input
          type="text"
          value={state.subject_prefix}
          onChange={(e) => setState((s) => ({ ...s, subject_prefix: e.target.value }))}
          placeholder="Re: "
          style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: '6px 8px', fontSize: 12, color: INK, background: WHITE }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: INK_M }}>Message body</label>
        <textarea
          rows={8}
          value={state.body}
          onChange={(e) => setState((s) => ({ ...s, body: e.target.value }))}
          placeholder="I'm currently away and will reply on…"
          style={{ border: '1px solid ' + HAIR, borderRadius: 4, padding: 10, fontSize: 13, fontFamily: 'inherit', color: INK, background: WHITE, resize: 'vertical' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={{ background: saving ? '#8FA69A' : FOREST, color: WHITE, border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
        >{saving ? 'Saving…' : 'Save'}</button>
        <button
          type="button"
          onClick={() => void clear()}
          disabled={saving}
          style={{ background: WHITE, color: RED, border: '1px solid ' + HAIR, borderRadius: 6, padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}
        >Clear</button>
        {flash && (
          <div style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, background: flash.kind === 'ok' ? CREAM : '#FCE8E4', color: flash.kind === 'ok' ? INK : RED }}>
            {flash.msg}
          </div>
        )}
      </div>
    </div>
  );
}
