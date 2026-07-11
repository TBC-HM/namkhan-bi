'use client';
// app/marketing/youtube/_client/CommentReplyForm.tsx
// PBS 2026-07-11 pm — inline reply to a YouTube comment.

import { useState } from 'react';

const FOREST = '#084838';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const WHITE  = '#FFFFFF';
const RED    = '#B03826';

interface Props {
  parentCommentId: string;
  videoId: string;
  canReply: boolean;
}

type State = 'idle' | 'open' | 'sending' | 'sent' | 'error';

export default function CommentReplyForm({ parentCommentId, videoId, canReply }: Props) {
  const [state, setState] = useState<State>('idle');
  const [text,  setText]  = useState('');
  const [err,   setErr]   = useState<string | null>(null);

  if (!canReply) {
    return (
      <div style={{ fontSize: 10, color: INK_M, marginTop: 6 }}>Replies disabled on this thread.</div>
    );
  }

  if (state === 'sent') {
    return <div style={{ fontSize: 11, color: FOREST, marginTop: 6 }}>Reply posted ✓</div>;
  }

  if (state === 'idle') {
    return (
      <button type="button"
        onClick={() => setState('open')}
        style={{
          marginTop: 6, background: 'transparent', border: 'none',
          color: FOREST, fontSize: 11, cursor: 'pointer', padding: 0,
          textDecoration: 'underline',
        }}>
        Reply
      </button>
    );
  }

  const submit = async () => {
    if (!text.trim()) { setErr('write something first'); setState('error'); return; }
    setState('sending'); setErr(null);
    try {
      const r = await fetch('/api/marketing/youtube/reply-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_comment_id: parentCommentId,
          video_id:          videoId,
          text:              text.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error ?? j.detail ?? `HTTP ${r.status}`);
      setState('sent');
      setText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'send failed');
      setState('error');
    }
  };

  return (
    <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type reply…"
        rows={2}
        style={{
          width: '100%', border: `1px solid ${HAIR}`, borderRadius: 3, padding: 8,
          fontSize: 12, color: INK, background: WHITE, resize: 'vertical', fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={submit} disabled={state === 'sending'}
          style={{
            padding: '4px 10px', background: FOREST, color: WHITE, border: 'none',
            borderRadius: 3, fontSize: 11, cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase',
          }}>
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button type="button" onClick={() => { setState('idle'); setText(''); setErr(null); }}
          style={{
            background: 'transparent', border: 'none', color: INK_M, fontSize: 11, cursor: 'pointer',
          }}>
          Cancel
        </button>
        {err && <span style={{ fontSize: 11, color: RED }}>{err}</span>}
      </div>
    </div>
  );
}
