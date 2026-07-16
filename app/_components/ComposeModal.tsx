'use client';
// app/_components/ComposeModal.tsx
// Minimal Gmail compose + reply modal. Reply pre-fills to / subject / thread_id
// / in_reply_to via prefill. Formatting via document.execCommand (no library).
//
// Tier 3 — v2 (2026-07-13). Adds shared-mailbox filter-mode support:
//   - Pass sharedMailboxId to POST to /api/sales/mails/send (Send-As)
//     instead of /api/user/gmail/send (personal Gmail).
//
// PBS 2026-07-17 · v3 additions:
//   - To: autocomplete (GET /api/mail/contacts/suggest?q=)
//   - 📎 Attach button with 2 modes: local file / media-library picker
//   - 🪄 Polish dropdown (5 modes: polish/shorten/lengthen/warm/formalize)
//   - Attachments render as chips above the composer; on send, forwarded
//     to the send route as `attachments: [{ url, name, content_type }]`.

import { useEffect, useMemo, useRef, useState } from 'react';

const WHITE = '#FFFFFF', HAIR = '#E6DFCC', INK = '#1B1B1B', INK_M = '#5A5A5A',
      FOREST = '#084838', CREAM = '#F5F0E1', RED = '#B03826', OK = '#0E7A4B';

export interface ComposePrefill {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  thread_id?: string;
  in_reply_to?: string;
  quoted_from?: string;
  quoted_date?: string;
  quoted_snippet?: string;
  // PBS 2026-07-15 · Forward support. When set, this string is injected
  // into the contentEditable as the initial body (HTML-escaped, line-broken).
  // Used by the [↪ Forward] button in MailClient's ThreadHeader.
  forwardedBody?: string;
  // Optional pre-attached files (already uploaded → have public URLs).
  // Forward re-attaches the original message's attachments here.
  forwardedAttachments?: Array<{ url: string; name: string; content_type: string; size?: number }>;
}

interface Props {
  prefill?: ComposePrefill;
  onClose: () => void;
  onSent?: () => void;
  /**
   * If set, this compose targets a shared alias (Send-As mode).
   * Sends POST to /api/sales/mails/send with mailbox_id in the body.
   * If unset, sends POST to /api/user/gmail/send (personal).
   */
  sharedMailboxId?: string;
  /** Optional badge label shown in the modal header, e.g. "Booking". */
  sharedMailboxLabel?: string;
}

interface Suggestion { email: string; name: string; last_touched: string | null }
interface Attachment { url: string; name: string; content_type: string; size?: number }
interface LibraryAsset {
  asset_id: string;
  original_filename: string | null;
  caption: string | null;
  preview_url?: string | null;
  public_url?: string | null;
}

type PolishMode = 'polish' | 'shorten' | 'lengthen' | 'warm' | 'formalize';
const POLISH_MODES: Array<{ id: PolishMode; label: string; hint: string }> = [
  { id: 'polish',    label: 'Polish',   hint: 'Tighten grammar + remove filler' },
  { id: 'shorten',   label: 'Shorten',  hint: 'Cut at least 30%' },
  { id: 'lengthen',  label: 'Expand',   hint: '+1-2 short paragraphs of context' },
  { id: 'warm',      label: 'Warmer',   hint: 'Softer opens/closes' },
  { id: 'formalize', label: 'Formal',   hint: 'First-exchange formal register' },
];

export default function ComposeModal({ prefill, onClose, onSent, sharedMailboxId, sharedMailboxLabel }: Props) {
  const [to, setTo] = useState(prefill?.to ?? '');
  const [cc, setCc] = useState(prefill?.cc ?? '');
  const [bcc, setBcc] = useState(prefill?.bcc ?? '');
  // PBS 2026-07-15 · CC/BCC visibility gets its own toggle per row, but we
  // auto-show either row if the prefill supplies a value for it.
  const [showCc, setShowCc] = useState<boolean>(!!(prefill?.cc && prefill.cc.trim()));
  const [showBcc, setShowBcc] = useState<boolean>(!!(prefill?.bcc && prefill.bcc.trim()));
  const [recipientErr, setRecipientErr] = useState<string | null>(null);
  const [subject, setSubject] = useState(prefill?.subject ?? '');
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<'idle' | 'ok' | 'err'>('idle');
  const [flashMsg, setFlashMsg] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [chars, setChars] = useState(0);

  // Suggestions state (To: autocomplete).
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestIdx, setSuggestIdx] = useState<number>(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach state. PBS 2026-07-15 · seeded from prefill.forwardedAttachments
  // so [↪ Forward] re-attaches the original message's uploads.
  const [attachments, setAttachments] = useState<Attachment[]>(
    (prefill?.forwardedAttachments ?? []).map((a) => ({
      url: a.url, name: a.name, content_type: a.content_type, size: a.size,
    }))
  );
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Polish dropdown state.
  const [polishOpen, setPolishOpen] = useState(false);
  const [polishing, setPolishing] = useState<PolishMode | null>(null);
  const [polishErr, setPolishErr] = useState<string | null>(null);

  // PBS 2026-07-15 · [↪ Forward] · seed the contentEditable with the
  // forwarded-message block (2 blank lines then the header + quoted body).
  // Runs once on mount when a forwardedBody prefill is supplied.
  useEffect(() => {
    if (!prefill?.forwardedBody || !editorRef.current) return;
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    // Two blank lines above the fwd block so the sender can type their note.
    const escaped = esc(prefill.forwardedBody).replace(/\n/g, '<br/>');
    editorRef.current.innerHTML = '<div><br/></div><div><br/></div><div>' + escaped + '</div>';
    setChars(editorRef.current.innerText.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (suggestOpen) { setSuggestOpen(false); return; }
        if (attachMenuOpen) { setAttachMenuOpen(false); return; }
        if (libraryOpen) { setLibraryOpen(false); return; }
        if (polishOpen) { setPolishOpen(false); return; }
        maybeDiscard();
      }
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestOpen, attachMenuOpen, libraryOpen, polishOpen]);

  function maybeDiscard() {
    const dirty = (to.trim() + cc + bcc + subject.trim() + (editorRef.current?.innerText.trim() ?? '') + attachments.length).length > 0;
    if (!dirty || confirm('Discard this message?')) onClose();
  }

  // PBS 2026-07-15 · Multi-add validation. Splits on comma OR whitespace
  // (users often paste a list) and validates every token is a valid email
  // pattern. Empty strings ignored. Returns null on success, error msg on
  // fail. Also normalises the string back into a comma-separated list so
  // the send route sees a clean value.
  function validateRecipients(raw: string): { ok: true; normalised: string } | { ok: false; error: string } {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: true, normalised: '' };
    const tokens = trimmed.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
    const bad: string[] = [];
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const t of tokens) {
      if (!re.test(t)) bad.push(t);
    }
    if (bad.length) return { ok: false, error: 'Invalid: ' + bad.join(', ') };
    return { ok: true, normalised: tokens.join(', ') };
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    setChars(editorRef.current?.innerText.length ?? 0);
  }

  function insertLink() {
    const url = prompt('Link URL (https://…)');
    if (url) exec('createLink', url);
  }

  // ---- To: autocomplete -----------------------------------------------
  function onToChange(v: string) {
    setTo(v);
    setSuggestIdx(-1);
    // Take the last token after a comma so multi-recipient still autocompletes.
    const parts = v.split(',');
    const tail = (parts[parts.length - 1] || '').trim();
    if (tail.length < 2) {
      setSuggestOpen(false); setSuggestions([]);
      return;
    }
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const r = await fetch('/api/mail/contacts/suggest?q=' + encodeURIComponent(tail), { cache: 'no-store' });
        const j = await r.json() as { ok: boolean; suggestions?: Suggestion[] };
        if (j.ok && Array.isArray(j.suggestions)) {
          setSuggestions(j.suggestions);
          setSuggestOpen(j.suggestions.length > 0);
        } else {
          setSuggestOpen(false);
        }
      } catch {
        setSuggestOpen(false);
      } finally { setSuggestLoading(false); }
    }, 200);
  }

  function pickSuggestion(s: Suggestion) {
    const parts = to.split(',');
    parts[parts.length - 1] = ' ' + s.email;
    setTo(parts.join(',').replace(/^\s*,\s*/, '').replace(/^ +/, ''));
    setSuggestOpen(false);
    setSuggestIdx(-1);
  }

  function onToKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestIdx((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (suggestIdx >= 0 && suggestions[suggestIdx]) {
        e.preventDefault();
        pickSuggestion(suggestions[suggestIdx]);
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
    } else if (e.key === 'Tab' && suggestions[0]) {
      e.preventDefault();
      pickSuggestion(suggestions[0]);
    }
  }

  // ---- Attach: local files -------------------------------------------
  async function onLocalFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('file', f));
      const r = await fetch('/api/mail/attach/upload', { method: 'POST', body: form });
      const j = await r.json() as { ok: boolean; uploaded?: Attachment[]; failures?: Array<{ name: string; error: string }> };
      if (j.ok && j.uploaded) {
        setAttachments((prev) => [...prev, ...j.uploaded!]);
      }
      if (j.failures && j.failures.length > 0) {
        setFlash('err'); setFlashMsg(j.failures.length + ' upload(s) failed');
      }
    } catch (e) {
      setFlash('err'); setFlashMsg(e instanceof Error ? e.message : 'upload failed');
    } finally {
      setUploading(false);
      setAttachMenuOpen(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ---- Attach: media library picker ----------------------------------
  async function openLibrary() {
    setAttachMenuOpen(false);
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const r = await fetch('/api/proposals/photo-library', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json() as { ok?: boolean; assets?: LibraryAsset[]; data?: LibraryAsset[] };
        const list = j.assets ?? j.data ?? [];
        setLibraryAssets(list);
      } else {
        // Fallback: direct-select via PostgREST (public bridge view).
        const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (sbUrl && sbKey) {
          const rr = await fetch(sbUrl + '/rest/v1/v_proposal_photo_library?select=asset_id,original_filename,caption&limit=60', {
            headers: { apikey: sbKey, authorization: 'Bearer ' + sbKey },
          });
          if (rr.ok) setLibraryAssets(await rr.json() as LibraryAsset[]);
        }
      }
    } catch {
      setLibraryAssets([]);
    } finally { setLibraryLoading(false); }
  }

  const libraryFiltered = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return libraryAssets;
    return libraryAssets.filter((a) => (a.original_filename || '').toLowerCase().includes(q) || (a.caption || '').toLowerCase().includes(q));
  }, [libraryAssets, libraryQuery]);

  function attachAssetFromLibrary(a: LibraryAsset) {
    const url = a.public_url || a.preview_url || ('/api/media/asset/' + a.asset_id + '/original');
    setAttachments((prev) => [...prev, {
      url,
      name: a.original_filename || 'photo.jpg',
      content_type: 'image/jpeg',
    }]);
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- Polish dropdown ------------------------------------------------
  async function runPolish(mode: PolishMode) {
    setPolishOpen(false);
    setPolishErr(null);
    const html = editorRef.current?.innerHTML ?? '';
    const plain = editorRef.current?.innerText ?? '';
    const draft = plain.trim() || html.replace(/<[^>]+>/g, '').trim();
    if (!draft) return;
    setPolishing(mode);
    try {
      const r = await fetch('/api/mail/ai/polish', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft, mode }),
      });
      const j = await r.json() as { ok: boolean; polished?: string; error?: string };
      if (!j.ok || !j.polished) throw new Error(j.error || 'polish_failed');
      if (editorRef.current) {
        // Escape HTML to defeat any injection in the model response before
        // reinjecting into contentEditable. Preserve line-break structure.
        const esc = (s: string) => s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        editorRef.current.innerHTML = j.polished
          .split(/\n{2,}/)
          .map((para) => '<p>' + esc(para).replace(/\n/g, '<br/>') + '</p>')
          .join('');
        setChars(editorRef.current.innerText.length);
      }
    } catch (e) {
      setPolishErr(e instanceof Error ? e.message : 'polish failed');
    } finally {
      setPolishing(null);
    }
  }

  // ---- Send -----------------------------------------------------------
  async function onSend() {
    const html = editorRef.current?.innerHTML ?? '';
    const plain = editorRef.current?.innerText ?? '';
    if (!to.trim() || !subject.trim()) return;
    // PBS 2026-07-15 · validate To/Cc/Bcc before hitting the send route.
    // Splits on comma OR whitespace so pasted lists work. Any invalid token
    // aborts the send with an inline error under the field.
    setRecipientErr(null);
    const vTo  = validateRecipients(to);
    const vCc  = validateRecipients(cc);
    const vBcc = validateRecipients(bcc);
    if (!vTo.ok)  { setRecipientErr('To — '  + vTo.error);  return; }
    if (!vCc.ok)  { setRecipientErr('Cc — '  + vCc.error);  return; }
    if (!vBcc.ok) { setRecipientErr('Bcc — ' + vBcc.error); return; }
    setSending(true);
    setFlash('idle');
    try {
      const endpoint = sharedMailboxId ? '/api/sales/mails/send' : '/api/user/gmail/send';
      const payload: Record<string, unknown> = {
        to: vTo.normalised,
        cc: vCc.normalised || undefined,
        bcc: vBcc.normalised || undefined,
        subject: subject.trim(),
        body_html: html,
        body_plain: plain,
        in_reply_to: prefill?.in_reply_to,
        thread_id: prefill?.thread_id,
      };
      if (sharedMailboxId) payload.mailbox_id = sharedMailboxId;
      if (attachments.length > 0) {
        payload.attachments = attachments.map((a) => ({ url: a.url, name: a.name, content_type: a.content_type }));
      }
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.ok && j.ok !== false) {
        setFlash('ok');
        setFlashMsg('Sent');
        setTimeout(() => { onSent?.(); onClose(); }, 1200);
      } else {
        setFlash('err');
        setFlashMsg(j.detail ?? j.error ?? 'send failed');
      }
    } catch (e) {
      setFlash('err');
      setFlashMsg(e instanceof Error ? e.message : 'error');
    } finally { setSending(false); }
  }

  const disabled = sending || !to.trim() || !subject.trim();
  const modeLabel = sharedMailboxId
    ? (sharedMailboxLabel ? sharedMailboxLabel + ' · Reply' : 'Shared reply')
    : (prefill?.thread_id ? 'Reply' : 'New message');

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) maybeDiscard(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 720, maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto',
          background: WHITE, borderRadius: 8, border: '1px solid ' + HAIR,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          color: INK, fontFamily: "'Inter Tight', system-ui, sans-serif",
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid ' + HAIR, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{modeLabel}</div>
          <button onClick={maybeDiscard} style={{ background: 'transparent', border: 'none', color: INK_M, cursor: 'pointer', fontSize: 16 }} aria-label="Close">×</button>
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="To">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                onKeyDown={onToKeyDown}
                onFocus={() => { if (suggestions.length > 0) setSuggestOpen(true); }}
                placeholder="name@example.com  (comma or space-separated for multi-add)"
                style={{ ...inputStyle, flex: 1 }}
                autoComplete="off"
              />
              {/* PBS 2026-07-15 · inline +Cc / +Bcc toggles, right of the To field. */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    style={{ background: 'transparent', border: 'none', color: FOREST, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >+ Cc</button>
                )}
                {!showBcc && (
                  <button
                    type="button"
                    onClick={() => setShowBcc(true)}
                    style={{ background: 'transparent', border: 'none', color: FOREST, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >+ Bcc</button>
                )}
              </div>
              {suggestOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto',
                }}>
                  {suggestLoading && (
                    <div style={{ padding: '6px 10px', fontSize: 11, color: INK_M }}>Searching…</div>
                  )}
                  {suggestions.map((s, i) => (
                    <div
                      key={s.email}
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                      onMouseEnter={() => setSuggestIdx(i)}
                      style={{
                        padding: '6px 10px', cursor: 'pointer',
                        background: i === suggestIdx ? CREAM : WHITE,
                        borderBottom: i < suggestions.length - 1 ? '1px solid ' + HAIR : 'none',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ color: INK, fontWeight: 500 }}>{s.name || s.email}</div>
                      {s.name && <div style={{ color: INK_M, fontSize: 11 }}>{s.email}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>
          {showCc && (
            <Field label="Cc">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc1@x.com, cc2@x.com" style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => { setCc(''); setShowCc(false); }} style={{ background: 'transparent', border: 'none', color: INK_M, fontSize: 14, cursor: 'pointer', padding: 0 }} aria-label="Remove Cc row">×</button>
              </div>
            </Field>
          )}
          {showBcc && (
            <Field label="Bcc">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc1@x.com, bcc2@x.com" style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => { setBcc(''); setShowBcc(false); }} style={{ background: 'transparent', border: 'none', color: INK_M, fontSize: 14, cursor: 'pointer', padding: 0 }} aria-label="Remove Bcc row">×</button>
              </div>
            </Field>
          )}
          {recipientErr && (
            <div style={{ fontSize: 11, color: RED, padding: '2px 0' }}>{recipientErr}</div>
          )}
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={inputStyle} />
          </Field>
        </div>

        {/* Attachment chips (Feature 4). */}
        {attachments.length > 0 && (
          <div style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {attachments.map((a, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 8px', background: CREAM, border: '1px solid ' + HAIR,
                borderRadius: 12, fontSize: 11, color: INK,
              }}>
                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>📎 {a.name}</span>
                <button onClick={() => removeAttachment(i)} style={{ background: 'transparent', border: 'none', color: INK_M, cursor: 'pointer', fontSize: 12, padding: 0 }} aria-label="Remove">×</button>
              </span>
            ))}
          </div>
        )}

        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 4, borderBottom: '1px solid ' + HAIR, alignItems: 'center' }}>
          {[
            { label: 'B', cmd: 'bold', bold: true },
            { label: 'I', cmd: 'italic', italic: true },
            { label: 'U', cmd: 'underline', underline: true },
          ].map((b) => (
            <button
              key={b.cmd}
              onClick={() => exec(b.cmd)}
              style={{ ...toolbarBtn, fontWeight: b.bold ? 700 : 400, fontStyle: b.italic ? 'italic' : 'normal', textDecoration: b.underline ? 'underline' : 'none' }}
            >{b.label}</button>
          ))}
          <button onClick={insertLink} style={toolbarBtn} title="Link">link</button>
          <button onClick={() => exec('insertOrderedList')} style={toolbarBtn} title="Numbered list">1.</button>
          <button onClick={() => exec('insertUnorderedList')} style={toolbarBtn} title="Bulleted list">•</button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, position: 'relative' }}>
            {/* Attach button + mini menu (Feature 4). */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setAttachMenuOpen((v) => !v)}
                style={{ ...toolbarBtn, width: 'auto', padding: '0 10px', fontSize: 12 }}
                title="Attach"
              >{uploading ? 'Uploading…' : '📎 Attach'}</button>
              {attachMenuOpen && (
                <div style={miniMenuStyle}>
                  <div onClick={() => { fileRef.current?.click(); }} style={miniMenuItem}>💻 From my computer</div>
                  <div onClick={openLibrary} style={miniMenuItem}>🖼 From Media Library</div>
                </div>
              )}
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => onLocalFilesChosen(e.target.files)} />
            </div>

            {/* Polish dropdown (Feature 5). */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setPolishOpen((v) => !v)}
                disabled={polishing !== null}
                style={{ ...toolbarBtn, width: 'auto', padding: '0 10px', fontSize: 12, color: FOREST, borderColor: FOREST }}
                title="Polish with AI"
              >{polishing ? '…polishing' : '🪄 Polish ▾'}</button>
              {polishOpen && (
                <div style={{ ...miniMenuStyle, width: 220 }}>
                  {POLISH_MODES.map((m) => (
                    <div key={m.id} onClick={() => runPolish(m.id)} style={miniMenuItem}>
                      <div style={{ fontWeight: 600, color: INK }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: INK_M }}>{m.hint}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setChars(editorRef.current?.innerText.length ?? 0)}
          style={{
            minHeight: 180, padding: 14, outline: 'none',
            fontSize: 14, lineHeight: 1.5, color: INK,
          }}
        />

        {polishErr && (
          <div style={{ padding: '4px 14px', fontSize: 11, color: RED }}>Polish error: {polishErr}</div>
        )}

        {prefill?.quoted_snippet && (
          <div style={{ padding: '10px 14px', margin: '0 14px 14px', borderLeft: '3px solid ' + HAIR, background: CREAM, color: INK_M, fontSize: 12, borderRadius: '0 4px 4px 0' }}>
            <div style={{ marginBottom: 6, fontStyle: 'italic' }}>On {prefill.quoted_date ?? 'earlier'}, {prefill.quoted_from ?? 'someone'} wrote:</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>&gt; {prefill.quoted_snippet}</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderTop: '1px solid ' + HAIR, background: WHITE }}>
          <button
            onClick={onSend}
            disabled={disabled}
            style={{
              padding: '8px 16px', background: disabled ? '#8FA69A' : FOREST, color: WHITE, border: 'none', borderRadius: 4,
              fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
          <button
            onClick={maybeDiscard}
            style={{ padding: '8px 14px', background: WHITE, color: INK, border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
          >
            Discard
          </button>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: INK_M }}>{chars} chars{attachments.length > 0 ? ' · ' + attachments.length + ' attachment' + (attachments.length === 1 ? '' : 's') : ''}</div>
          {flash === 'ok' && <span style={{ marginLeft: 12, padding: '4px 8px', background: OK, color: WHITE, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{flashMsg}</span>}
          {flash === 'err' && <span style={{ marginLeft: 12, padding: '4px 8px', background: RED, color: WHITE, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{flashMsg}</span>}
        </div>
      </div>

      {/* Media Library picker overlay (Feature 4). */}
      {libraryOpen && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setLibraryOpen(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ width: 780, maxWidth: '100%', maxHeight: '80vh', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 8, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid ' + HAIR, display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Media Library</div>
              <input
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
                placeholder="Search filename or caption…"
                style={{ marginLeft: 'auto', flex: 1, maxWidth: 320, padding: '4px 8px', border: '1px solid ' + HAIR, borderRadius: 4, fontSize: 12 }}
              />
              <button onClick={() => setLibraryOpen(false)} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Done</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {libraryLoading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: INK_M, fontSize: 12 }}>Loading…</div>
              ) : libraryFiltered.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: INK_M, fontSize: 12 }}>No assets match.</div>
              ) : libraryFiltered.map((a) => (
                <div
                  key={a.asset_id}
                  onClick={() => attachAssetFromLibrary(a)}
                  style={{ border: '1px solid ' + HAIR, borderRadius: 4, background: CREAM, padding: 6, cursor: 'pointer', fontSize: 10, minHeight: 90, display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  {a.preview_url || a.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.preview_url || a.public_url || ''} alt={a.original_filename || ''} style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 2 }} />
                  ) : (
                    <div style={{ height: 72, background: WHITE, border: '1px dashed ' + HAIR, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖼</div>
                  )}
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.original_filename || ''}>{a.original_filename || 'photo.jpg'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid ' + HAIR, padding: '4px 0' }}>
      <div style={{ width: 60, fontSize: 12, color: INK_M }}>{props.label}</div>
      <div style={{ flex: 1 }}>{props.children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: 'none', outline: 'none', fontSize: 13, color: INK, background: 'transparent', fontFamily: 'inherit', padding: '4px 0',
};

const toolbarBtn: React.CSSProperties = {
  minWidth: 28, height: 28, background: WHITE, border: '1px solid transparent', borderRadius: 4, color: INK, cursor: 'pointer', fontSize: 12,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const miniMenuStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20,
  background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 180, padding: 4,
};

const miniMenuItem: React.CSSProperties = {
  padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: INK, borderRadius: 2,
};
