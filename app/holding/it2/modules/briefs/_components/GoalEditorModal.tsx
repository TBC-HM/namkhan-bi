// app/holding/it2/modules/briefs/_components/GoalEditorModal.tsx
// goal-editor-v1: Owner refines the goal — ONLY goal statement + done-metric.
// When saved: brief goal section replaced, signal row, status→ready, rewrite queued.
'use client';

import { useEffect, useState, useTransition } from 'react';

interface Props {
  briefSlug: string;
  onClose: () => void;
  onSaved: () => void;
}

interface GoalData {
  goal_statement: string;
  done_metric: string;
  goal_id: number | null;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 9999, padding: 16,
};

const modalStyle: React.CSSProperties = {
  background: '#FFFFFF', borderRadius: 8, maxWidth: 640, width: '100%',
  padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #E6DFCC',
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#8A8A8A', letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const titleStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: '#1B1B1B', marginTop: 4,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', fontSize: 28, cursor: 'pointer',
  color: '#8A8A8A', lineHeight: 1, padding: 0, width: 28, height: 28,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#5A5A5A',
  marginBottom: 5, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E6DFCC',
  borderRadius: 4, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical',
  minHeight: 100,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #E6DFCC',
  borderRadius: 4, fontFamily: 'inherit',
};

const hintStyle: React.CSSProperties = {
  fontSize: 11, color: '#8A8A8A', marginTop: 4, lineHeight: 1.4,
};

const btnRowStyle: React.CSSProperties = {
  display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end',
};

const btnStyle = (tone: 'primary' | 'secondary'): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 12, fontWeight: 700, borderRadius: 4,
  cursor: 'pointer', border: 'none',
  background: tone === 'primary' ? '#1F3A2E' : '#FFFFFF',
  color: tone === 'primary' ? '#FFFFFF' : '#1B1B1B',
  ...(tone === 'secondary' && { border: '1px solid #E6DFCC' }),
});

const errStyle: React.CSSProperties = {
  fontSize: 12, color: '#B71C1C', marginTop: 12, padding: '8px 12px',
  background: '#FFEBEE', borderRadius: 4,
};

const msgStyle: React.CSSProperties = {
  fontSize: 12, color: '#2E7D32', marginTop: 12, padding: '8px 12px',
  background: '#E8F5E9', borderRadius: 4,
};

export default function GoalEditorModal({ briefSlug, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [goalStatement, setGoalStatement] = useState('');
  const [doneMetric, setDoneMetric] = useState('');
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // Load current goal data
    (async () => {
      try {
        const r = await fetch(`/api/modules/briefs/goal?slug=${encodeURIComponent(briefSlug)}`);
        if (!r.ok) throw new Error(`Failed to load goal data (${r.status})`);
        const data: GoalData = await r.json();
        setGoalStatement(data.goal_statement || '');
        setDoneMetric(data.done_metric || '');
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [briefSlug]);

  const save = () => {
    if (!goalStatement.trim()) {
      setErr('Goal statement is required');
      return;
    }
    startTransition(async () => {
      setErr(null);
      setMsg(null);
      try {
        const r = await fetch('/api/modules/briefs/goal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brief_slug: briefSlug,
            goal_text: goalStatement.trim(),
            done_metric: doneMetric.trim(),
          }),
        });
        const body = await r.json();
        if (!r.ok) {
          setErr(body.error ?? `Save failed (${r.status})`);
          return;
        }
        setMsg('✓ Goal refined — brief rewrite queued');
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
      } catch (e: any) {
        setErr(e.message);
      }
    });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>Refine Goal</div>
            <div style={titleStyle}>{briefSlug}</div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#8A8A8A' }}>
            Loading goal data…
          </div>
        ) : (
          <>
            <label style={labelStyle}>Goal Statement</label>
            <textarea
              value={goalStatement}
              onChange={(e) => setGoalStatement(e.target.value)}
              style={textareaStyle}
              placeholder="Describe what this module achieves in plain language…"
              disabled={pending}
            />
            <div style={hintStyle}>
              When you refine the goal, the entire brief will be rewritten to align with your new direction.
            </div>

            <label style={{ ...labelStyle, marginTop: 16 }}>Done Metric (optional)</label>
            <input
              value={doneMetric}
              onChange={(e) => setDoneMetric(e.target.value)}
              style={inputStyle}
              placeholder="How do we know when this is complete?"
              disabled={pending}
            />
            <div style={hintStyle}>
              e.g., "100% test coverage", "All red findings resolved", "Signed off by PBS"
            </div>

            {err && <div style={errStyle}>{err}</div>}
            {msg && <div style={msgStyle}>{msg}</div>}

            <div style={btnRowStyle}>
              <button
                type="button"
                onClick={onClose}
                style={btnStyle('secondary')}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                style={btnStyle('primary')}
                disabled={pending || loading}
              >
                {pending ? 'Saving…' : 'Save & Queue Rewrite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
