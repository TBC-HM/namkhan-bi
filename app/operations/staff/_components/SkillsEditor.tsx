// app/operations/staff/_components/SkillsEditor.tsx
// PBS 2026-05-13 — inline skills editor for the staff drawer.
// - Click 'Edit' next to Skills section to open popup
// - Shows current skills as removable chips
// - Suggests skills from the property's catalog (every distinct skill used)
// - 'Add new' input creates a custom skill
// - Saves to ops.staff_employment.skills via server action
// - Works on Namkhan AND Donna staff drawers (currency/theme-neutral)

'use client';

import { useState, useEffect, useRef } from 'react';
import { updateStaffSkills, fetchSkillCatalog } from '../_actions/updateStaffSkills';

interface Props {
  staffId: string;
  propertyId: number | null | undefined;
  initialSkills: string[];
  onSaved?: (skills: string[]) => void;
}

export function SkillsEditor({ staffId, propertyId, initialSkills, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>(initialSkills);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // Reset local state when drawer opens with a different staff
  useEffect(() => {
    setSkills(initialSkills);
  }, [initialSkills]);

  // Lazy-load catalog when popup opens
  useEffect(() => {
    if (!open || !propertyId) return;
    fetchSkillCatalog(propertyId).then(setCatalog).catch(() => setCatalog([]));
  }, [open, propertyId]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const removeSkill = (s: string) => setSkills(skills.filter((x) => x !== s));
  const addSkill = (s: string) => {
    const t = s.trim();
    if (!t || skills.includes(t)) return;
    setSkills([...skills, t]);
    setNewSkill('');
    setFilter('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await updateStaffSkills(staffId, skills);
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Save failed');
      return;
    }
    onSaved?.(skills);
    setOpen(false);
  };

  const suggestions = catalog
    .filter((s) => !skills.includes(s))
    .filter((s) => filter.trim() === '' || s.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={S.editBtn}
        title="Edit skills"
      >
        Edit ✎
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={S.scrim} />
          <div role="dialog" aria-label="Edit skills" style={S.dialog}>
            <header style={S.header}>
              <div style={S.title}>Edit skills</div>
              <button onClick={() => setOpen(false)} style={S.close} aria-label="Close">✕</button>
            </header>

            <div style={S.body}>
              {/* Current skills */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Tagged on this employee</div>
                {skills.length === 0 ? (
                  <div style={S.emptyHint}>— none tagged yet. Pick from suggestions below or add a new one.</div>
                ) : (
                  <div style={S.chipRow}>
                    {skills.map((s) => (
                      <span key={s} style={S.chipActive}>
                        {s}
                        <button onClick={() => removeSkill(s)} style={S.chipRemove} aria-label={`Remove ${s}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new */}
              <div style={S.section}>
                <div style={S.sectionTitle}>Add a new skill</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    ref={newInputRef}
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill(newSkill);
                      }
                    }}
                    placeholder="e.g. Barista · Yoga teacher · Spa massage · Driver"
                    style={S.input}
                  />
                  <button
                    type="button"
                    onClick={() => addSkill(newSkill)}
                    disabled={!newSkill.trim()}
                    style={{ ...S.addBtn, opacity: newSkill.trim() ? 1 : 0.4 }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Suggestions / catalog */}
              <div style={S.section}>
                <div style={S.sectionTitle}>
                  Pick from existing skills · {catalog.length} in property catalog
                </div>
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="filter catalog…"
                  style={{ ...S.input, marginBottom: 8 }}
                />
                <div style={S.chipRow}>
                  {suggestions.length === 0 ? (
                    <div style={S.emptyHint}>
                      {catalog.length === 0
                        ? '— no skills tagged anywhere yet. Be the first.'
                        : '— all matching skills already tagged on this employee.'}
                    </div>
                  ) : (
                    suggestions.slice(0, 60).map((s) => (
                      <button key={s} onClick={() => addSkill(s)} style={S.chipSuggest}>
                        + {s}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {error && <div style={S.error}>{error}</div>}
            </div>

            <footer style={S.footer}>
              <button onClick={() => setOpen(false)} style={S.cancelBtn} disabled={saving}>
                Cancel
              </button>
              <button onClick={save} style={S.saveBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </footer>
          </div>
        </>
      )}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  editBtn: {
    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.16em',
    textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
    background: 'transparent', color: 'var(--brass)',
    border: '1px solid var(--kpi-frame)', cursor: 'pointer',
  },
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    zIndex: 9100, backdropFilter: 'blur(2px)',
  },
  dialog: {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: 'min(560px, 92vw)', maxHeight: '85vh',
    background: 'var(--paper)', color: 'var(--ink)',
    border: '1px solid var(--kpi-frame)', borderRadius: 8,
    boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
    zIndex: 9101, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid var(--line-soft)',
    background: 'var(--paper-warm)',
  },
  title: {
    fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)',
  },
  close: {
    background: 'transparent', border: '1px solid var(--kpi-frame)',
    color: 'var(--ink-mute)', cursor: 'pointer',
    width: 28, height: 28, borderRadius: 4, fontSize: 13,
  },
  body: { padding: '14px 18px', overflowY: 'auto', flex: 1 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 8,
  },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chipActive: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--moss, #1c4d3a)', color: '#fff',
    padding: '4px 4px 4px 10px', borderRadius: 4,
    fontSize: 12, fontWeight: 500,
  },
  chipRemove: {
    background: 'rgba(255,255,255,0.18)', color: '#fff',
    border: 'none', width: 18, height: 18, borderRadius: 3,
    fontSize: 12, lineHeight: 1, cursor: 'pointer',
  },
  chipSuggest: {
    background: 'var(--paper-warm)', color: 'var(--ink)',
    border: '1px solid var(--kpi-frame)',
    padding: '4px 10px', borderRadius: 4,
    fontSize: 12, cursor: 'pointer',
  },
  input: {
    width: '100%', padding: '8px 10px', fontSize: 13,
    background: 'var(--paper-warm)', color: 'var(--ink)',
    border: '1px solid var(--kpi-frame)', borderRadius: 4,
    outline: 'none', fontFamily: 'var(--sans)',
  },
  addBtn: {
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    background: 'var(--brass)', color: '#1a160f',
    border: 'none', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  emptyHint: { fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' },
  error: {
    marginTop: 8, padding: '6px 10px',
    background: 'rgba(178,60,42,0.12)', color: 'var(--oxblood-soft)',
    border: '1px solid var(--oxblood-soft)', borderRadius: 4, fontSize: 12,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '12px 18px', borderTop: '1px solid var(--line-soft)',
    background: 'var(--paper-warm)',
  },
  cancelBtn: {
    padding: '8px 14px', fontSize: 12,
    background: 'transparent', color: 'var(--ink-mute)',
    border: '1px solid var(--kpi-frame)', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  saveBtn: {
    padding: '8px 18px', fontSize: 12, fontWeight: 600,
    background: 'var(--st-good, #2c7a4b)', color: '#fff',
    border: 'none', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em',
  },
};
