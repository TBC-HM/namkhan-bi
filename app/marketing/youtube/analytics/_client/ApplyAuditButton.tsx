'use client';
// app/marketing/youtube/analytics/_client/ApplyAuditButton.tsx
// Apply audit suggestions (title / description / tags) to YouTube for one video.
// Shows inline progress and a ✓ badge on success.

import { useState } from 'react';

interface Props {
  videoId: string;
  suggestedTitle?: string | null;
  suggestedDescription?: string | null;
  suggestedTags?: string[] | null;
}

const FOREST = '#084838';
const AMBER  = '#B48A3A';
const RED    = '#B03826';
const OK     = '#0E7A4B';
const WHITE  = '#FFFFFF';
const INK_M  = '#5A5A5A';
const HAIR   = '#E6DFCC';

export default function ApplyAuditButton({ videoId, suggestedTitle, suggestedDescription, suggestedTags }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [open, setOpen] = useState(false);

  const hasChanges = suggestedTitle || suggestedDescription || (suggestedTags && suggestedTags.length > 0);
  if (!hasChanges) return null;

  async function apply() {
    setState('busy');
    setErrMsg('');
    try {
      const res = await fetch('/api/marketing/youtube/update-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id:    videoId,
          ...(suggestedTitle       ? { title:       suggestedTitle }       : {}),
          ...(suggestedDescription ? { description: suggestedDescription } : {}),
          ...(suggestedTags?.length ? { tags:       suggestedTags }        : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setErrMsg(j.detail ?? j.error ?? 'unknown error');
        setState('error');
        return;
      }
      setState('done');
      setOpen(false);
      // Persist applied state so it survives page refreshes
      fetch('/api/marketing/youtube/log-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'video', entity_id: videoId, action: 'applied' }),
      }).catch(() => {});
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'network error');
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span style={{ fontSize: 10, color: OK, fontWeight: 700, padding: '3px 8px',
        border: `1px solid ${OK}`, borderRadius: 3 }}>
        ✓ Applied
      </span>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={state === 'busy'}
        style={{
          fontSize: 10, padding: '3px 10px', borderRadius: 3, cursor: state === 'busy' ? 'wait' : 'pointer',
          border: `1px solid ${FOREST}`, background: WHITE, color: FOREST, fontWeight: 600,
          opacity: state === 'busy' ? 0.6 : 1,
        }}
      >
        {state === 'busy' ? 'Applying…' : 'Apply to YT ↑'}
      </button>

      {open && state !== 'busy' && (
        <div style={{
          position: 'absolute', right: 0, top: 26, zIndex: 200,
          background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6,
          padding: 14, width: 340, boxShadow: '0 6px 20px rgba(0,0,0,.12)',
          fontSize: 11.5, color: '#1B1B1B',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 12 }}>
            Push these changes to YouTube?
          </div>

          {suggestedTitle && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: INK_M, fontSize: 10, marginBottom: 2 }}>TITLE</div>
              <div style={{ fontWeight: 600 }}>{suggestedTitle}</div>
            </div>
          )}
          {suggestedDescription && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: INK_M, fontSize: 10, marginBottom: 2 }}>DESCRIPTION</div>
              <div style={{ color: '#3A3A3A', maxHeight: 80, overflow: 'hidden',
                textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical' }}>{suggestedDescription}</div>
            </div>
          )}
          {suggestedTags && suggestedTags.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: INK_M, fontSize: 10, marginBottom: 4 }}>TAGS ({suggestedTags.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {suggestedTags.slice(0, 8).map((t) => (
                  <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: '#F4EFE2',
                    borderRadius: 4, color: INK_M, border: `1px solid ${HAIR}` }}>{t}</span>
                ))}
                {suggestedTags.length > 8 && <span style={{ fontSize: 10, color: INK_M }}>+{suggestedTags.length - 8} more</span>}
              </div>
            </div>
          )}

          {state === 'error' && (
            <div style={{ color: RED, fontSize: 10, marginBottom: 8 }}>Error: {errMsg}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={apply} style={{
              flex: 1, padding: '7px 0', background: FOREST, color: WHITE,
              border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
              Confirm — push to YouTube
            </button>
            <button onClick={() => setOpen(false)} style={{
              padding: '7px 12px', background: WHITE, color: INK_M,
              border: `1px solid ${HAIR}`, borderRadius: 4, fontSize: 11, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
