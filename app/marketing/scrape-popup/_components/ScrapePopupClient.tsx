'use client';
// app/marketing/scrape-popup/_components/ScrapePopupClient.tsx
// PBS 2026-07-16.
// 1. On mount, postMessage NMKBI_READY to opener.
// 2. Wait for NMKBI_HTML message with the page's innerHTML.
// 3. Show url/title/target/tags form.
// 4. POST to /api/marketing/scrape-web-contact.
// 5. Show success toast + auto-close after 2s.
import { useEffect, useRef, useState } from 'react';

const PAPER = '#FFFFFF';
const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const BRAND = '#084838';
const HAIRLINE = '#E6DFCC';
const WARM = '#F5F0E1';
const RED = '#B04A2F';

export default function ScrapePopupClient({ url, title }: { url: string; title: string }) {
  const [target, setTarget] = useState<'lead' | 'subscriber'>('subscriber');
  const [tags, setTags] = useState('');
  const [html, setHtml] = useState<string>('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ count_emails?: number; emails?: string[]; lead_id?: number | null } | null>(null);
  const askedRef = useRef(false);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const data = e.data as { type?: string; html?: string };
      if (data?.type === 'NMKBI_HTML' && typeof data.html === 'string') {
        setHtml(data.html);
        setReady(true);
      }
    }
    window.addEventListener('message', onMsg);
    // Ask opener for HTML
    if (window.opener && !askedRef.current) {
      askedRef.current = true;
      try { window.opener.postMessage({ type: 'NMKBI_READY' }, '*'); } catch { /* noop */ }
    }
    // Fallback: if no message in 800ms, allow submit anyway with empty HTML
    // (extraction will just return no emails but the event still logs).
    const t = setTimeout(() => setReady(true), 800);
    return () => { window.removeEventListener('message', onMsg); clearTimeout(t); };
  }, []);

  async function save() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch('/api/marketing/scrape-web-contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url, title,
          html_snippet: html,
          target,
          tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error || 'save_failed');
      setResult({ count_emails: j.count_emails, emails: j.emails, lead_id: j.lead_id });
      setMsg('Saved · ' + (j.count_emails ?? 0) + ' emails · closing…');
      setTimeout(() => { try { window.close(); } catch { /* noop */ } }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'save_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: PAPER, minHeight: '100vh', padding: 16, fontFamily: 'system-ui, sans-serif', color: INK }}>
      <h1 style={{ fontSize: 16, margin: '0 0 12px 0' }}>Save to Namkhan</h1>

      <div style={{ padding: 8, background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 4, marginBottom: 12, fontSize: 11 }}>
        <div style={{ color: INK_SOFT, marginBottom: 4 }}>URL</div>
        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{url || '(no url)'}</div>
        {title && <>
          <div style={{ color: INK_SOFT, margin: '8px 0 4px 0' }}>Title</div>
          <div>{title}</div>
        </>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 4 }}>Target</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['lead','subscriber'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTarget(v)}
              style={{
                flex: 1,
                fontSize: 12, padding: '8px 12px', borderRadius: 4,
                background: target === v ? BRAND : PAPER,
                color: target === v ? PAPER : INK,
                border: '1px solid ' + (target === v ? BRAND : HAIRLINE),
                cursor: 'pointer',
              }}
            >
              {v === 'lead' ? 'Lead (sales)' : 'Subscriber (newsletter)'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: INK_SOFT, marginTop: 4 }}>
          {target === 'lead'
            ? 'Adds a row to sales.leads with the primary email + AI summary.'
            : 'Adds all extracted emails to marketing.newsletter_subscribers (opt-in pending).'}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: INK_SOFT, marginBottom: 4 }}>Tags (comma-separated)</div>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. yoga, retreat, europe"
          style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid ' + HAIRLINE, borderRadius: 4, background: PAPER, color: INK, boxSizing: 'border-box' }}
        />
      </div>

      {!ready && <div style={{ fontSize: 11, color: INK_SOFT }}>Waiting for page contents…</div>}
      {ready && html && <div style={{ fontSize: 10, color: INK_SOFT }}>Payload · {(html.length/1024).toFixed(1)} KB</div>}
      {ready && !html && <div style={{ fontSize: 10, color: RED }}>No page HTML received (using URL + title only)</div>}

      {err && <div style={{ fontSize: 12, color: RED, marginTop: 8, padding: 8, background: PAPER, border: '1px solid ' + RED, borderRadius: 4 }}>{err}</div>}
      {msg && <div style={{ fontSize: 12, color: BRAND, marginTop: 8, padding: 8, background: PAPER, border: '1px solid ' + BRAND, borderRadius: 4 }}>{msg}</div>}

      {result && (
        <div style={{ marginTop: 8, padding: 8, background: WARM, border: '1px solid ' + HAIRLINE, borderRadius: 4, fontSize: 11 }}>
          <div style={{ color: INK_SOFT, marginBottom: 4 }}>Emails saved:</div>
          {(result.emails ?? []).length === 0 && <div style={{ color: INK_SOFT }}>(none found on page)</div>}
          <ul style={{ margin: 0, paddingLeft: 20, fontFamily: 'monospace', fontSize: 10 }}>
            {(result.emails ?? []).slice(0, 10).map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={() => { try { window.close(); } catch { /* noop */ } }} style={{ flex: 1, fontSize: 12, padding: '8px 12px', border: '1px solid ' + HAIRLINE, background: PAPER, color: INK, borderRadius: 4, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={save} disabled={busy || !ready} style={{ flex: 2, fontSize: 12, padding: '8px 12px', border: '1px solid ' + BRAND, background: BRAND, color: PAPER, borderRadius: 4, cursor: 'pointer', opacity: busy || !ready ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
