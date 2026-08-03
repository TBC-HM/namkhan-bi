'use client';
// app/holding/it2/modules/findings/[module]/FindingsClient.tsx
// owner-findings-ui-v1 (ADR-218): findings list + add form + resolve controls.
// Round 2 (finding_threads_v1): dialogue thread per finding — agent restatement,
// PBS comment + "Confirm understanding" control; Resolve… enabled only after a
// PBS-confirmed comment exists (tg_finding_resolution_guard gates fixed/refuted).
// Client component (forms, toasts, uploads). Dates via iso.slice() — hydration law 712.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Finding = {
  id: number;
  module_doc_type: string;
  finding: string;
  severity: string | null;
  source: string | null;
  blocking: boolean | null;
  status: string | null;
  resolution_note: string | null;
  created_by: string | null;
  created_at: string | null;
  resolved_at: string | null;
  screenshot_ref: string | null;
};

type ThreadComment = {
  id: number;
  finding_id: number;
  author_role: string | null;
  author: string | null;
  body: string | null;
  confirms_understanding: boolean | null;
  is_restatement: boolean | null;
  created_at: string | null;
};

const SEV: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#B71C1C', color: '#FFFFFF' },
  high:     { bg: '#FFEBEE', color: '#B71C1C' },
  medium:   { bg: '#FFF3E0', color: '#E65100' },
  low:      { bg: '#F4EFE2', color: '#5A5A5A' },
};

const STATUS_COLOR: Record<string, string> = {
  open: '#B71C1C', acknowledged: '#E65100', fixed: '#2E7D32', refuted: '#5A5A5A', waived: '#8A8A8A',
};

function d(iso: string | null): string {
  return iso ? iso.slice(0, 16).split('T').join(' ') : '—';
}

export default function FindingsClient({ module: moduleName, findings, comments = [] }:
  { module: string; findings: Finding[]; comments?: ThreadComment[] }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [file, setFile] = useState<File | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);
  const [resStatus, setResStatus] = useState('fixed');
  const [resNote, setResNote] = useState('');
  const [commentText, setCommentText] = useState<Record<number, string>>({});

  const threadByFinding = new Map<number, ThreadComment[]>();
  for (const c of comments) {
    const list = threadByFinding.get(c.finding_id) ?? [];
    list.push(c);
    threadByFinding.set(c.finding_id, list);
  }

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 6000);
  }

  async function addFinding(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('module', moduleName);
      fd.set('finding', text);
      fd.set('severity', severity);
      if (file) fd.set('screenshot', file);
      const res = await fetch('/api/holding/module-findings', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) { flash(j?.error ?? `HTTP ${res.status}`, false); return; }
      flash(`Finding #${j.id} filed`, true);
      setText(''); setFile(null); setSeverity('medium');
      router.refresh();
    } catch (err: any) {
      flash(err?.message ?? 'network error', false);
    } finally {
      setBusy(false);
    }
  }

  async function postComment(findingId: number, opts?: { confirms?: boolean; body?: string }) {
    if (busy) return;
    const body = (opts?.body ?? commentText[findingId] ?? '').trim();
    if (body.length < 5) { flash('Comment needs at least 5 characters', false); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/holding/module-findings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finding_id: findingId,
          author_role: 'pbs',
          author: 'PBS',
          body,
          confirms: opts?.confirms === true,
        }),
      });
      const j = await res.json();
      if (!res.ok) { flash(j?.error ?? `HTTP ${res.status}`, false); return; }
      flash(opts?.confirms ? 'Understanding confirmed — resolution unlocked' : 'Comment posted', true);
      setCommentText(prev => ({ ...prev, [findingId]: '' }));
      router.refresh();
    } catch (err: any) {
      flash(err?.message ?? 'network error', false);
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/holding/module-findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: resStatus, resolution_note: resNote, actor: 'it2-ui' }),
      });
      const j = await res.json();
      if (!res.ok) { flash(j?.error ?? `HTTP ${res.status}`, false); return; }
      flash(`Finding #${id} → ${resStatus}`, true);
      setResolving(null); setResNote('');
      router.refresh();
    } catch (err: any) {
      flash(err?.message ?? 'network error', false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, padding: '10px 16px', borderRadius: 6,
          background: toast.ok ? '#1F3A2E' : '#B71C1C', color: '#FFFFFF', fontSize: 12, fontWeight: 600,
          maxWidth: 420, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          {toast.msg}
        </div>
      )}

      {/* Add-finding form */}
      <form onSubmit={addFinding} style={{ background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 6,
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1B1B1B', letterSpacing: '0.04em' }}>FILE A FINDING</div>
        <textarea value={text} onChange={e => setText(e.target.value)} required minLength={5} rows={3}
          placeholder="What is wrong, in plain language. This blocks completion until resolved."
          style={{ fontSize: 12, padding: 8, border: '1px solid #E6DFCC', borderRadius: 4, resize: 'vertical',
            fontFamily: 'inherit', color: '#1B1B1B' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #E6DFCC', borderRadius: 4, color: '#1B1B1B' }}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 11, color: '#5A5A5A' }} />
          <button type="submit" disabled={busy || text.trim().length < 5} style={{ marginLeft: 'auto', fontSize: 12,
            fontWeight: 700, padding: '8px 18px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: busy ? '#B8A878' : '#1F3A2E', color: '#FFFFFF' }}>
            {busy ? 'Saving…' : 'File finding'}
          </button>
        </div>
      </form>

      {/* Findings list */}
      {findings.length === 0 ? (
        <div style={{ fontSize: 12, color: '#8A8A8A', padding: '16px 0' }}>No findings for this module yet.</div>
      ) : findings.map(f => {
        const sev = SEV[f.severity ?? 'medium'] ?? SEV.medium;
        const stColor = STATUS_COLOR[f.status ?? 'open'] ?? '#5A5A5A';
        const isOpen = f.status === 'open' || f.status === 'acknowledged';
        const thread = threadByFinding.get(f.id) ?? [];
        const hasConfirm = thread.some(c => c.confirms_understanding === true);
        const hasRestatement = thread.some(c => c.is_restatement === true);
        return (
          <div key={f.id} style={{ background: '#FFFFFF', border: `1px solid ${isOpen && f.blocking ? '#B71C1C' : '#E6DFCC'}`,
            borderRadius: 6, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8A8A8A' }}>#{f.id}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                background: sev.bg, color: sev.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {f.severity ?? 'medium'}
              </span>
              {f.blocking && isOpen && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: '#FFEBEE', color: '#B71C1C' }}>BLOCKING</span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: stColor, textTransform: 'uppercase' }}>{f.status}</span>
              <span style={{ fontSize: 10, color: '#8A8A8A', marginLeft: 'auto' }}>
                {f.created_by ?? '—'} · {d(f.created_at)}{f.source ? ` · ${f.source}` : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#1B1B1B', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.finding}</div>
            {f.screenshot_ref && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={f.screenshot_ref} target="_blank" rel="noreferrer">
                <img src={f.screenshot_ref} alt={`screenshot for finding ${f.id}`}
                  style={{ maxWidth: 260, maxHeight: 160, borderRadius: 4, border: '1px solid #E6DFCC', objectFit: 'cover' }} />
              </a>
            )}
            {f.resolution_note && (
              <div style={{ fontSize: 11, color: '#2E7D32', background: '#E8F5E9', borderRadius: 4, padding: '6px 10px' }}>
                Resolved {d(f.resolved_at)}: {f.resolution_note}
              </div>
            )}

            {/* Dialogue thread (finding_threads_v1) */}
            {(thread.length > 0 || isOpen) && (
              <div style={{ borderTop: '1px solid #E6DFCC', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {thread.length > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8A8A8A', letterSpacing: '0.04em' }}>THREAD</div>
                )}
                {thread.map(c => {
                  const isPbs = c.author_role === 'pbs';
                  return (
                    <div key={c.id} style={{ background: isPbs ? '#F4EFE2' : '#FFFFFF',
                      border: '1px solid #E6DFCC', borderRadius: 4, padding: '8px 10px',
                      display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
                          background: isPbs ? '#1F3A2E' : '#E6DFCC', color: isPbs ? '#FFFFFF' : '#5A5A5A' }}>
                          {isPbs ? 'PBS' : 'AGENT'}
                        </span>
                        {c.is_restatement && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
                            background: '#FFF3E0', color: '#B26A00' }}>RESTATEMENT</span>
                        )}
                        {c.confirms_understanding && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
                            background: '#E8F5E9', color: '#2E7D32' }}>✓ UNDERSTANDING CONFIRMED</span>
                        )}
                        <span style={{ fontSize: 10, color: '#8A8A8A', marginLeft: 'auto' }}>
                          {c.author ?? '—'} · {d(c.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#1B1B1B', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                    </div>
                  );
                })}

                {isOpen && (
                  <>
                    {!hasRestatement && (
                      <div style={{ fontSize: 11, color: '#8A8A8A' }}>
                        Waiting for the responsible agent to post a restatement of this finding (what it understood, what it will change).
                      </div>
                    )}
                    {hasRestatement && !hasConfirm && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
                        background: '#FFF3E0', border: '1px solid #E6DFCC', borderRadius: 4, padding: '8px 10px' }}>
                        <span style={{ fontSize: 11, color: '#B26A00', fontWeight: 600 }}>
                          An agent restated this finding. Does the restatement match what you meant?
                        </span>
                        <button onClick={() => postComment(f.id, { confirms: true,
                            body: 'Confirmed — the restatement matches what I meant. Proceed to resolve.' })}
                          disabled={busy}
                          style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4, border: 'none',
                            cursor: 'pointer', background: '#1F3A2E', color: '#FFFFFF' }}>
                          ✓ Confirm understanding
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input value={commentText[f.id] ?? ''} onChange={e => setCommentText(prev => ({ ...prev, [f.id]: e.target.value }))}
                        placeholder="Reply on this finding — a correction, a counter-question, more detail…"
                        style={{ flex: 1, fontSize: 11, padding: '6px 8px', border: '1px solid #E6DFCC', borderRadius: 4, color: '#1B1B1B' }} />
                      <button onClick={() => postComment(f.id)} disabled={busy || (commentText[f.id] ?? '').trim().length < 5}
                        style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 4,
                          border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B', cursor: 'pointer' }}>
                        Comment
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {isOpen && (
              hasConfirm ? (
                resolving === f.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={resStatus} onChange={e => setResStatus(e.target.value)}
                      style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4 }}>
                      <option value="fixed">fixed</option>
                      <option value="refuted">refuted</option>
                      <option value="waived">waived</option>
                      <option value="acknowledged">acknowledged</option>
                    </select>
                    <input value={resNote} onChange={e => setResNote(e.target.value)}
                      placeholder="Resolution note — what changed, where, brief version (min 10 chars)"
                      style={{ flex: 1, minWidth: 200, fontSize: 11,
                        padding: '5px 8px', border: '1px solid #E6DFCC', borderRadius: 4 }} />
                    <button onClick={() => resolve(f.id)} disabled={busy || resNote.trim().length < 10}
                      style={{ fontSize: 11, fontWeight: 700,
                        padding: '6px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
                        background: '#1F3A2E', color: '#FFFFFF' }}>Save</button>
                    <button onClick={() => setResolving(null)} style={{ fontSize: 11, fontWeight: 700, padding: '6px 12px',
                      borderRadius: 4, border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#5A5A5A', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setResolving(f.id); setResStatus('fixed'); setResNote(''); }}
                    style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 4,
                      border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B', cursor: 'pointer' }}>
                    Resolve…
                  </button>
                )
              ) : (
                <div title="tg_finding_resolution_guard: resolution requires a PBS-confirmed restatement on the thread"
                  style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 4,
                    border: '1px dashed #E6DFCC', background: '#FFFFFF', color: '#8A8A8A' }}>
                  Resolve locked — needs PBS confirmation on the thread
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
