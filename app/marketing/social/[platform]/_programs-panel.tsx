'use client';
// Interactive Programs CRUD + Generate Plan button for a single social channel.
// Imported at module scope by _impl.tsx (RSC crash rule — no inline client components).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { SocialProgram } from '@/lib/marketing';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const RED    = '#B04A2F';
const AMBER  = '#A06020';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORIES = [
  { code: 'inspirational', label: 'Inspirational' },
  { code: 'transactional', label: 'Transactional' },
  { code: 'wellness',      label: 'Wellness' },
  { code: 'fnb',           label: 'F&B' },
  { code: 'mystique',      label: 'Mystique' },
  { code: 'community',     label: 'Community' },
  { code: 'whats_new',     label: "What's New" },
  { code: 'education',     label: 'Education' },
  { code: 'general',       label: 'General' },
];

interface Props {
  propertyId: number;
  platform: string;
  initial: SocialProgram[];
}

type EditState = Partial<SocialProgram> & { _new?: boolean };

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

export default function ProgramsPanel({ propertyId, platform, initial }: Props) {
  const router = useRouter();
  const [programs, setPrograms] = useState<SocialProgram[]>(initial);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [planPending, setPlanPending] = useState(false);

  // ── CRUD helpers ────────────────────────────────────────────────

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const weekday_slots = WEEKDAY_LABELS
      .map((_, i) => (fd.get(`wd${i + 1}`) ? i + 1 : null))
      .filter((x): x is number => x !== null);
    const body = {
      property_id:   propertyId,
      platform:      editing._new ? platform : editing.platform,
      category_code: fd.get('category_code') as string,
      label:         fd.get('label') as string,
      weekday_slots,
      posts_per_week: Number(fd.get('posts_per_week')),
      notes:         (fd.get('notes') as string) || null,
      active:        true,
      id:            editing._new ? undefined : editing.id,
    };
    const res = await fetch('/api/marketing/social/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Save failed'); return; }
    setEditing(null);
    startTransition(() => router.refresh());
    // Optimistic local update
    if (editing._new) {
      setPrograms((ps) => [...ps, { ...body, id: json.id, weekday_slots, posts_per_week: body.posts_per_week, active: true, notes: body.notes } as SocialProgram]);
    } else {
      setPrograms((ps) => ps.map((p) => p.id === editing.id
        ? { ...p, category_code: body.category_code, label: body.label, weekday_slots, posts_per_week: body.posts_per_week, notes: body.notes }
        : p));
    }
  }

  async function remove(prog: SocialProgram) {
    if (!confirm(`Delete program "${prog.label}"?`)) return;
    setError(null);
    const res = await fetch(
      `/api/marketing/social/programs?property_id=${propertyId}&id=${prog.id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Delete failed'); return; }
    setPrograms((ps) => ps.filter((p) => p.id !== prog.id));
    startTransition(() => router.refresh());
  }

  async function generatePlan() {
    setPlanStatus(null);
    setPlanPending(true);
    const start = ymd(new Date());
    const end = ymd(new Date(Date.now() + 28 * 86400000));
    const res = await fetch('/api/marketing/social/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId, start_date: start, end_date: end, regenerate_empty_only: true }),
    });
    const json = await res.json();
    setPlanPending(false);
    if (!res.ok || !json.ok) {
      setPlanStatus(`Error: ${json.error ?? 'unknown'}`);
    } else {
      setPlanStatus(`✓ Created ${json.created} slots (${json.skipped} skipped) for ${start} → ${end}`);
      startTransition(() => router.refresh());
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: INK_M }}>
          {programs.length} active program{programs.length !== 1 ? 's' : ''} · drives the content calendar
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={generatePlan} disabled={planPending || programs.length === 0}
            style={{ ...btnSm, background: CREAM, color: FOREST, border: `1px solid ${FOREST}`, opacity: planPending ? 0.6 : 1 }}>
            {planPending ? 'Generating…' : 'Generate plan +28d'}
          </button>
          <button onClick={() => { setError(null); setEditing({ _new: true, platform, weekday_slots: [], posts_per_week: 1 }); }}
            style={{ ...btnSm, background: FOREST, color: WHITE }}>
            + Add program
          </button>
        </div>
      </div>

      {planStatus && (
        <div style={{ marginBottom: 8, fontSize: 12, color: planStatus.startsWith('Error') ? RED : FOREST, padding: '6px 8px', background: CREAM, borderRadius: 4 }}>
          {planStatus}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 8, fontSize: 12, color: RED, padding: '6px 8px', background: '#FFF5F2', border: `1px solid ${RED}`, borderRadius: 4 }}>
          {error}
        </div>
      )}

      {/* Programs table */}
      {programs.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
              <th style={thSt}>Category</th>
              <th style={thSt}>Days</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Posts / wk</th>
              <th style={{ ...thSt, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                <td style={tdSt}>
                  <div style={{ fontWeight: 500 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.category_code}</div>
                </td>
                <td style={tdSt}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {WEEKDAY_LABELS.map((wd, i) => {
                      const active = (p.weekday_slots ?? []).includes(i + 1);
                      return (
                        <span key={wd} style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 3,
                          background: active ? FOREST : HAIR,
                          color: active ? WHITE : INK_M,
                          fontWeight: active ? 600 : 400,
                        }}>{wd}</span>
                      );
                    })}
                  </div>
                </td>
                <td style={{ ...tdSt, textAlign: 'right' }}>{p.posts_per_week}</td>
                <td style={{ ...tdSt, textAlign: 'right' }}>
                  <button onClick={() => { setError(null); setEditing(p); }}
                    style={{ ...btnXs, color: FOREST, border: `1px solid ${FOREST}`, marginRight: 4 }}>
                    Edit
                  </button>
                  <button onClick={() => remove(p)}
                    style={{ ...btnXs, color: RED, border: `1px solid ${RED}` }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: INK_M }}>
          No programs yet — categories drive the calendar&apos;s generated slots. Add one above.
        </p>
      )}

      {/* Inline edit / add form */}
      {editing && (
        <div style={{ marginTop: 14, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: INK }}>
            {editing._new ? 'New program' : `Edit: ${editing.label}`}
          </div>
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelSt}>
                Category
                <select name="category_code" defaultValue={editing.category_code ?? ''} required style={inputSt}>
                  <option value="">— select —</option>
                  {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </label>
              <label style={labelSt}>
                Label (display name)
                <input name="label" defaultValue={editing.label ?? ''} required placeholder="e.g. Inspirational · monks" style={inputSt} />
              </label>
              <label style={labelSt}>
                Posts per week
                <input name="posts_per_week" type="number" min={1} max={14} defaultValue={editing.posts_per_week ?? 1} required style={inputSt} />
              </label>
              <label style={labelSt}>
                Notes (optional)
                <input name="notes" defaultValue={editing.notes ?? ''} placeholder="AI direction, tone, themes…" style={inputSt} />
              </label>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Post days</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {WEEKDAY_LABELS.map((wd, i) => {
                  const slot = i + 1;
                  const checked = (editing.weekday_slots ?? []).includes(slot);
                  return (
                    <label key={wd} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" name={`wd${slot}`} defaultChecked={checked} />
                      {wd}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button type="submit" disabled={isPending} style={{ ...btnSm, background: FOREST, color: WHITE }}>
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setEditing(null); setError(null); }}
                style={{ ...btnSm, background: WHITE, color: INK_M, border: `1px solid ${HAIR}` }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isPending && <div style={{ marginTop: 8, fontSize: 11, color: AMBER }}>Refreshing data…</div>}
    </div>
  );
}

const thSt: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, fontWeight: 600 };
const tdSt: React.CSSProperties = { padding: '8px 6px', color: INK, verticalAlign: 'top' };
const btnSm: React.CSSProperties = { padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer' };
const btnXs: React.CSSProperties = { padding: '2px 8px', fontSize: 11, fontWeight: 500, background: WHITE, borderRadius: 3, cursor: 'pointer' };
const labelSt: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: INK_M };
const inputSt: React.CSSProperties = { padding: '5px 8px', fontSize: 13, border: `1px solid ${HAIR}`, borderRadius: 4, background: WHITE, color: INK };
