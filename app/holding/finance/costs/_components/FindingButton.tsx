'use client';
// FindingButton — owner feedback CTA on the costs surface (law 729: findings
// are the owner channel; finding 5 fix: page must carry a Bug/Findings button).
// Posts multipart to /api/holding/module-findings → public.fn_module_finding_add.

import { useState } from 'react';

const MODULE = 'cost_governance';

export default function FindingButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (text.trim().length < 5 || busy) return;
    setBusy(true);
    setDone(null);
    try {
      const fd = new FormData();
      fd.set('module', MODULE);
      fd.set('finding', text.trim());
      fd.set('severity', severity);
      const res = await fetch('/api/holding/module-findings', { method: 'POST', body: fd });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone('Filed. It blocks module completion until resolved.');
      setText('');
      setOpen(false);
    } catch (e) {
      setDone(e instanceof Error ? e.message : 'Failed to file finding');
    } finally {
      setBusy(false);
    }
  }

  const btn: React.CSSProperties = {
    fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid var(--hairline, #E6DFCC)', background: 'var(--paper, #FFFFFF)',
    color: 'var(--ink, #1B1B1B)',
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      {done && <span style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>{done}</span>}
      <button type="button" style={btn} onClick={() => setOpen((v) => !v)}>
        {open ? 'Cancel' : 'Report finding'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 32, right: 0, zIndex: 20, width: 320, padding: 12,
          background: 'var(--paper, #FFFFFF)', border: '1px solid var(--hairline, #E6DFCC)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="What is wrong or missing on this page?"
            style={{ fontSize: 12, padding: 8, border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              style={{ fontSize: 12, padding: '4px 6px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 6 }}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <button type="button" style={{ ...btn, background: 'var(--primary, #1F3A2E)', color: '#fff' }}
              disabled={busy || text.trim().length < 5} onClick={submit}>
              {busy ? 'Filing…' : 'File finding'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
