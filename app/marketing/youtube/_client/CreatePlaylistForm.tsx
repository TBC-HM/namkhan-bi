'use client';
// Create a new YouTube playlist inline.
// Fix 2026-08-03: router.refresh() → window.location.reload() (same fix as RunAuditButton).
// Preset buttons now clearly labelled as "pre-fill" not "create".
import { useState } from 'react';

const FOREST = '#084838'; const WHITE = '#FFFFFF'; const HAIR = '#E6DFCC';
const INK = '#1B1B1B'; const INK_M = '#5A5A5A'; const RED = '#B03826'; const CREAM = '#F4EFE2';

const PRESETS = [
  { label: 'River Life', title: 'Luang Prabang · River Life — Mekong & Nam Khan Vignettes', description: 'Slow mornings on the Nam Khan. Fishers on the Mekong. Boats at dawn. The rivers that shape life in Luang Prabang — seen from The Namkhan. thenamkhan.com' },
  { label: 'Wellness Retreats', title: 'Wellness Retreats at The Namkhan, Luang Prabang', description: 'Multi-night wellness and mindfulness retreats on the Nam Khan River. Yoga at sunrise, Jungle Spa access, guided meditation, and organic farm cuisine. The Namkhan, Luang Prabang. thenamkhan.com/retreats' },
  { label: 'Jungle Spa', title: 'Jungle Spa — The Namkhan, Luang Prabang', description: 'Traditional Lao treatments in an open-air jungle setting on the Nam Khan River. Massage, herbal steam, and body wraps using local botanicals. thenamkhan.com' },
  { label: 'Glamping', title: 'Glamping at The Namkhan — Luxury Riverside Camping, Luang Prabang', description: 'Luxury glamping tents on the banks of the Nam Khan. Waking up to the river, open skies and jungle — with all the comforts of The Namkhan Resort. thenamkhan.com' },
];

export default function CreatePlaylistForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create() {
    if (!title.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/marketing/youtube/manage-playlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: title.trim(), description: description.trim(), privacy: 'public' }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setMsg({ ok: false, text: j.detail ?? j.error ?? 'failed' });
        setBusy(false);
        return;
      }
      setMsg({ ok: true, text: `Created "${j.title ?? title}" on YouTube — reloading…` });
      // window.location.reload is reliable for RSC pages; router.refresh() can serve cached state
      setTimeout(() => { window.location.reload(); }, 1400);
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'network error' });
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={() => { setOpen(o => !o); setMsg(null); }} style={{
        padding: '8px 16px', background: FOREST, color: WHITE, border: 'none',
        borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 12,
      }}>
        + Create playlist
      </button>
      {open && (
        <div style={{ marginTop: 12, padding: 16, border: `1px solid ${HAIR}`, borderRadius: 6, background: WHITE, maxWidth: 500 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 10 }}>New playlist</div>

          {/* Presets — pre-fill only, not create */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: INK_M, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Pre-fill from template (still need to press Create below):
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PRESETS.map(p => (
                <button key={p.label}
                  onClick={() => { setTitle(p.title); setDescription(p.description); setMsg(null); }}
                  style={{ fontSize: 10, padding: '3px 10px', background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', color: INK }}>
                  ✏ {p.label}
                </button>
              ))}
            </div>
          </div>

          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Playlist title"
            style={{ width: '100%', padding: '7px 10px', border: `1px solid ${HAIR}`, borderRadius: 3, fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }} />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3}
            style={{ width: '100%', padding: '7px 10px', border: `1px solid ${HAIR}`, borderRadius: 3, fontSize: 12, marginBottom: 10, boxSizing: 'border-box', resize: 'vertical' }} />

          {msg && (
            <div style={{ fontSize: 11, color: msg.ok ? FOREST : RED, marginBottom: 8, fontWeight: msg.ok ? 600 : 400 }}>
              {msg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={create} disabled={busy || !title.trim()} style={{
              flex: 1, padding: '8px 0', background: !title.trim() ? '#ccc' : FOREST, color: WHITE,
              border: 'none', borderRadius: 3, cursor: !title.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 12,
            }}>
              {busy ? 'Creating on YouTube…' : '✓ Create on YouTube'}
            </button>
            <button onClick={() => { setOpen(false); setMsg(null); }} style={{
              padding: '8px 12px', background: WHITE, color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontSize: 11,
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
