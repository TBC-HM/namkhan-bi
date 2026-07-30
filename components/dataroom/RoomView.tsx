'use client';

// components/dataroom/RoomView.tsx — internal room view (brief §5b/c/d).
// Top tiles (completeness overall + per pillar, items, guests, last access,
// expiring grants) · section tree with add-from-registry picker / notes ·
// access panel (invite → magic link, revoke, engagement, full log).
// Tokens only. Shared by holding + property room pages.

import { useCallback, useEffect, useState } from 'react';

interface Room {
  id: string; name: string; slug: string; template: string; owner_level: string;
  property_id: number | null; sections_total: number; sections_satisfied: number;
  completeness_pct: string | number | null;
  pillar_completeness: Record<string, { total: number; satisfied: number }> | null;
  items_count: number; guests_active: number; grants_expiring_7d: number;
  last_external_access: string | null;
}
interface Section {
  id: string; code: string; title: string; pillar: string | null; sort: number;
  target_hint: number; slot_state: string; item_count: number; satisfied: boolean;
}
interface Item {
  id: string; section_id: string; title: string; kind: string; mode: string | null;
  download_allowed: boolean; added_at: string; retired_at: string | null;
}
interface Grant {
  // magic_token deliberately NOT here: the bridge view stopped exposing it
  // (verifier gap round 2 — tokens are external credentials, harvestable by
  // any internal reader). Copy-link fetches it on demand via the service-role
  // copy_link action; invite responses still return it once at creation.
  id: string; email: string; display_name: string | null;
  granted_at: string; expires_at: string | null; revoked_at: string | null;
  can_download: boolean; is_active: boolean; last_seen_at: string | null;
  view_count: number; download_count: number;
}
interface LogRow {
  id: number; email: string | null; item_title: string | null; action: string; at: string;
}
interface PickerResult { id: string; title: string; subtitle: string; kind: string; has_file?: boolean }

const box: React.CSSProperties = { border: '1px solid var(--hairline)', borderRadius: 10, padding: 14, background: 'var(--card, #fff)' };

export default function RoomView({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [tab, setTab] = useState<'content' | 'access' | 'log'>('content');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // picker state
  const [pickerSection, setPickerSection] = useState<string | null>(null);
  const [pickerQ, setPickerQ] = useState('');
  const [pickerSource, setPickerSource] = useState<'docs' | 'media'>('docs');
  const [pickerMode, setPickerMode] = useState<'snapshot' | 'live_link'>('snapshot');
  const [pickerResults, setPickerResults] = useState<PickerResult[]>([]);
  const [noteSection, setNoteSection] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // invite state
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invDays, setInvDays] = useState(30);
  const [invDownload, setInvDownload] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dataroom/rooms/${roomId}`, { cache: 'no-store' });
    const j = await res.json();
    if (!res.ok) { setErr(j.error ?? 'load failed'); return; }
    setRoom(j.room); setSections(j.sections); setItems(j.items);
    setGrants(j.grants); setLog(j.access_log);
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/dataroom/rooms/${roomId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!res.ok) setErr(j.error ?? 'action failed');
    setBusy(false);
    await load();
    return j;
  }

  useEffect(() => {
    if (pickerSection === null) return;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/dataroom/registry?source=${pickerSource}&q=${encodeURIComponent(pickerQ)}`, { cache: 'no-store' });
      const j = await res.json();
      if (res.ok) setPickerResults(j.results ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [pickerQ, pickerSource, pickerSection]);

  if (!room) {
    return <div style={{ padding: 32, color: 'var(--ink-mute)', fontSize: 14 }}>{err ?? 'Loading room…'}</div>;
  }
  const pct = room.completeness_pct === null ? null : Number(room.completeness_pct);
  const pillars = room.pillar_completeness ?? null;
  const activeItems = items.filter((i) => !i.retired_at);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '24px 20px 64px', color: 'var(--ink)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>
        Data room · {room.template.replace('_', ' ')}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 16px' }}>{room.name}</h1>

      {/* tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <div style={box}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completeness</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{pct === null ? '—' : `${pct.toFixed(0)}%`}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{room.sections_satisfied}/{room.sections_total} slots</div>
        </div>
        {pillars && Object.entries(pillars).map(([name, p]) => (
          <div key={name} style={box}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{name}</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
              {p.total ? Math.round((100 * p.satisfied) / p.total) : 0}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{p.satisfied}/{p.total}</div>
          </div>
        ))}
        <div style={box}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Items</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{room.items_count}</div>
        </div>
        <div style={box}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Guests</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{room.guests_active}</div>
          {room.grants_expiring_7d > 0 && (
            <div style={{ fontSize: 11, color: 'var(--terracotta, #B8542A)', fontWeight: 600 }}>{room.grants_expiring_7d} expiring ≤7d</div>
          )}
        </div>
        <div style={box}>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Last access</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>
            {room.last_external_access
              ? new Date(room.last_external_access).toISOString().slice(0, 16).replace('T', ' ')
              : 'never'}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginTop: 22, borderBottom: '1px solid var(--hairline)' }}>
        {(['content', 'access', 'log'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--primary)' : 'var(--ink-mute)', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent' }}>
            {t === 'content' ? 'Sections & items' : t === 'access' ? 'Guest access' : 'Access log'}
          </button>
        ))}
      </div>
      {err && <div style={{ color: 'var(--terracotta, #B8542A)', fontSize: 13, marginTop: 10 }}>{err}</div>}

      {/* CONTENT */}
      {tab === 'content' && sections.map((s) => {
        const secItems = activeItems.filter((i) => i.section_id === s.id);
        return (
          <div key={s.id} style={{ marginTop: 16, ...box }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                <span style={{ color: 'var(--ink-mute)', fontWeight: 400, marginRight: 6 }}>{s.code}</span>
                {s.title}
                <span style={{ marginLeft: 8, fontSize: 11, color: s.satisfied ? 'var(--primary)' : 'var(--ink-mute)' }}>
                  {s.slot_state !== 'auto' ? s.slot_state.toUpperCase() : s.satisfied ? '● filled' : '○ empty'}
                  {` · ${s.item_count}/${Math.max(s.target_hint, 1)}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <button onClick={() => { setPickerSection(pickerSection === s.id ? null : s.id); setNoteSection(null); }}
                  style={{ border: '1px solid var(--hairline)', background: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--primary)' }}>
                  + Link from registry
                </button>
                <button onClick={() => { setNoteSection(noteSection === s.id ? null : s.id); setPickerSection(null); }}
                  style={{ border: '1px solid var(--hairline)', background: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--primary)' }}>
                  + Note
                </button>
                <select value={s.slot_state} disabled={busy}
                  onChange={(e) => void act({ action: 'set_slot_state', section_id: s.id, state: e.target.value })}
                  style={{ border: '1px solid var(--hairline)', borderRadius: 6, fontSize: 12, padding: '3px 6px' }}>
                  <option value="auto">auto</option>
                  <option value="waived">waived</option>
                  <option value="na">n/a</option>
                </select>
              </div>
            </div>

            {pickerSection === s.id && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input autoFocus value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search registry…"
                    style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '6px 10px', fontSize: 13, flex: 1, minWidth: 160 }} />
                  <select value={pickerSource} onChange={(e) => setPickerSource(e.target.value as 'docs' | 'media')}
                    style={{ border: '1px solid var(--hairline)', borderRadius: 6, fontSize: 12 }}>
                    <option value="docs">Documents</option>
                    <option value="media">Media assets</option>
                  </select>
                  {pickerSource === 'docs' && (
                    <select value={pickerMode} onChange={(e) => setPickerMode(e.target.value as 'snapshot' | 'live_link')}
                      style={{ border: '1px solid var(--hairline)', borderRadius: 6, fontSize: 12 }}>
                      <option value="snapshot">Snapshot (frozen copy)</option>
                      <option value="live_link">Live link</option>
                    </select>
                  )}
                </div>
                <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8 }}>
                  {pickerResults.map((r) => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line-soft, #eee)', fontSize: 13 }}>
                      <span>{r.title} <span style={{ color: 'var(--ink-faint, #8A8A8A)', fontSize: 11 }}>{r.subtitle}</span></span>
                      <button disabled={busy} onClick={() => void act(
                        r.kind === 'media_asset'
                          ? { action: 'add_item', section_id: s.id, kind: 'media_asset', asset_id: r.id, title: r.title, download_allowed: true }
                          : { action: 'add_item', section_id: s.id, kind: 'registry_doc', doc_id: r.id, mode: pickerMode, title: r.title },
                      ).then(() => setPickerSection(null))}
                        style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}>
                        Add
                      </button>
                    </div>
                  ))}
                  {pickerResults.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '8px 0' }}>No matches.</div>}
                </div>
              </div>
            )}

            {noteSection === s.id && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} placeholder="Note (markdown)…"
                  style={{ width: '100%', border: '1px solid var(--hairline)', borderRadius: 6, padding: 8, fontSize: 13 }} />
                <button disabled={busy || !noteText.trim()} onClick={() => void act({ action: 'add_item', section_id: s.id, kind: 'note', note_md: noteText, title: noteText.slice(0, 60) }).then(() => { setNoteText(''); setNoteSection(null); })}
                  style={{ marginTop: 6, border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  Add note
                </button>
              </div>
            )}

            {secItems.map((it) => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '1px solid var(--line-soft, #eee)', fontSize: 13, alignItems: 'center' }}>
                <span>
                  {it.title}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-faint, #8A8A8A)' }}>
                    {it.kind}{it.mode ? ` · ${it.mode}` : ''}{it.download_allowed ? ' · downloadable' : ''}
                  </span>
                </span>
                <button disabled={busy} onClick={() => void act({ action: 'retire_item', item_id: it.id, reason: 'retired from cockpit' })}
                  style={{ border: '1px solid var(--hairline)', background: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--ink-mute)' }}>
                  Retire
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {/* ACCESS */}
      {tab === 'access' && (
        <div style={{ marginTop: 16 }}>
          <div style={box}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Invite external guest</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="email@company.com"
                style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 200 }} />
              <input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="Display name (optional)"
                style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '7px 10px', fontSize: 13, minWidth: 160 }} />
              <select value={invDays} onChange={(e) => setInvDays(Number(e.target.value))}
                style={{ border: '1px solid var(--hairline)', borderRadius: 6, fontSize: 13, padding: '6px 8px' }}>
                <option value={30}>Expires in 30 days</option>
                <option value={60}>Expires in 60 days</option>
                <option value={90}>Expires in 90 days</option>
              </select>
              <label style={{ fontSize: 13, display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="checkbox" checked={invDownload} onChange={(e) => setInvDownload(e.target.checked)} />
                Allow downloads
              </label>
              <button disabled={busy || !invEmail.includes('@')}
                onClick={() => void act({ action: 'invite', email: invEmail, display_name: invName || null, expires_days: invDays, can_download: invDownload })
                  .then((j) => { if (j?.magic_token) setNewLink(`${window.location.origin}/room/${j.magic_token}`); setInvEmail(''); setInvName(''); })}
                style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
                Create access link
              </button>
            </div>
            {newLink && (
              <div style={{ marginTop: 10, fontSize: 13, background: 'var(--paper-deep, #F5F0E1)', borderRadius: 6, padding: '8px 12px', wordBreak: 'break-all' }}>
                Share this link (personal, logged): <strong>{newLink}</strong>
              </div>
            )}
          </div>

          {grants.map((g) => (
            <div key={g.id} style={{ ...box, marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {g.display_name ?? g.email}
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: g.revoked_at ? 'var(--terracotta, #B8542A)' : g.is_active ? 'var(--primary)' : 'var(--ink-mute)' }}>
                    {g.revoked_at ? 'REVOKED' : g.is_active ? 'ACTIVE' : 'EXPIRED'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 3 }}>
                  {g.email} · granted {g.granted_at.slice(0, 10)}
                  {g.expires_at ? ` · expires ${g.expires_at.slice(0, 10)}` : ' · no expiry'}
                  {g.can_download ? ' · downloads ON' : ' · view-only'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-faint, #8A8A8A)', marginTop: 2 }}>
                  {g.last_seen_at ? `Last seen ${new Date(g.last_seen_at).toISOString().slice(0, 16).replace('T', ' ')} · ` : 'Never visited · '}
                  {g.view_count} views · {g.download_count} downloads
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {g.is_active && (
                  <>
                    <button disabled={busy} onClick={() => void act({ action: 'copy_link', grant_id: g.id }).then((j) => {
                        if (j?.magic_token) void navigator.clipboard.writeText(`${window.location.origin}/room/${j.magic_token}`);
                      })}
                      style={{ border: '1px solid var(--hairline)', background: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--primary)' }}>
                      Copy link
                    </button>
                    <button disabled={busy} onClick={() => void act({ action: 'revoke', grant_id: g.id })}
                      style={{ border: '1px solid var(--terracotta, #B8542A)', background: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--terracotta, #B8542A)' }}>
                      Revoke now
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LOG */}
      {tab === 'log' && (
        <div style={{ ...box, marginTop: 16 }}>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-mute)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '6px 8px' }}>When (UTC)</th>
                <th style={{ padding: '6px 8px' }}>Guest</th>
                <th style={{ padding: '6px 8px' }}>Action</th>
                <th style={{ padding: '6px 8px' }}>Item</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--line-soft, #eee)' }}>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{new Date(l.at).toISOString().slice(0, 19).replace('T', ' ')}</td>
                  <td style={{ padding: '6px 8px' }}>{l.email ?? '—'}</td>
                  <td style={{ padding: '6px 8px', fontWeight: l.action === 'denied_download' ? 600 : 400, color: l.action === 'denied_download' ? 'var(--terracotta, #B8542A)' : 'inherit' }}>{l.action}</td>
                  <td style={{ padding: '6px 8px' }}>{l.item_title ?? '—'}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 12, color: 'var(--ink-mute)' }}>No external access yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
