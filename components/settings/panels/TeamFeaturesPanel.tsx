// components/settings/panels/TeamFeaturesPanel.tsx
// PBS 2026-07-18 · featured-only team (not all 71). Add via dept→employee picker.
// No salaries. Fields: bio (2-3 sentences), position, languages.
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';

interface DirectoryRow {
  staff_id: string; full_name: string;
  dept_code: string | null; dept_name: string | null;
  position_title: string | null; primary_language: string | null;
}
interface FeatureRow {
  feature_id: number; property_id: number; staff_id: string;
  bio: string | null; languages_override: string[] | null; position_override: string | null;
  display_order: number | null; is_active: boolean;
  full_name: string | null; dept_code: string | null; dept_name: string | null;
  position_title: string | null; primary_language: string | null;
}
interface Draft {
  feature_id: number | null; dept_code: string; staff_id: string;
  position_override: string; languages_csv: string; bio: string;
  display_order: string; is_active: boolean;
}

const EMPTY: Draft = { feature_id: null, dept_code: '', staff_id: '', position_override: '', languages_csv: '', bio: '', display_order: '', is_active: true };

interface Props { features: FeatureRow[]; directory: DirectoryRow[]; propertyId: number; }

export default function TeamFeaturesPanel({ features, directory, propertyId }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const depts = useMemo(() => {
    const map = new Map<string, string>();
    directory.forEach(d => { if (d.dept_code) map.set(d.dept_code, d.dept_name ?? d.dept_code); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [directory]);

  const featuredStaffIds = new Set(features.map(f => f.staff_id));
  const staffInDept = draft?.dept_code
    ? directory.filter(d => d.dept_code === draft.dept_code && (!featuredStaffIds.has(d.staff_id) || d.staff_id === draft.staff_id))
    : [];

  function openAdd() { setDraft(EMPTY); setError(null); }
  function openEdit(f: FeatureRow) {
    setDraft({
      feature_id: f.feature_id, dept_code: f.dept_code ?? '', staff_id: f.staff_id,
      position_override: f.position_override ?? '',
      languages_csv: (f.languages_override ?? []).join(', '),
      bio: f.bio ?? '',
      display_order: f.display_order?.toString() ?? '',
      is_active: f.is_active ?? true,
    });
    setError(null);
  }

  function save() {
    if (!draft) return;
    if (!draft.staff_id) { setError('Pick a team member'); return; }
    setError(null);
    startTransition(async () => {
      const languages = draft.languages_csv.split(',').map(s => s.trim()).filter(Boolean);
      const { error: e } = await supabase.rpc('fn_upsert_property_team_feature', {
        p_feature_id: draft.feature_id, p_property_id: propertyId, p_staff_id: draft.staff_id,
        p_bio: draft.bio.trim() || null,
        p_languages_override: languages.length > 0 ? languages : null,
        p_position_override: draft.position_override.trim() || null,
        p_display_order: draft.display_order ? Number(draft.display_order) : null,
        p_is_active: draft.is_active,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }
  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_team_feature', { p_feature_id: id });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Featured Team</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
            {features.length} featured · shows up in AI answers when asked about our team · no salaries stored
          </div>
        </div>
        {!draft && <button onClick={openAdd} style={btnPrimary}>+ Add team member</button>}
      </div>

      {error && (
        <div style={{ background: '#FEECEA', border: '1px solid #E7A69A', borderRadius: 4, padding: 10, color: '#8A2820', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {draft && (
        <div style={{ background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>
            {draft.feature_id ? 'Edit team feature' : 'New featured team member'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <L label="1 · Department *">
              <select style={inp} value={draft.dept_code} onChange={e=>setDraft({...draft, dept_code: e.target.value, staff_id: '' })}>
                <option value="">— choose a department —</option>
                {depts.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </L>
            <L label="2 · Team member *">
              <select style={inp} value={draft.staff_id} onChange={e=>{
                const st = staffInDept.find(s => s.staff_id === e.target.value);
                setDraft({
                  ...draft,
                  staff_id: e.target.value,
                  position_override: draft.position_override || st?.position_title || '',
                  languages_csv: draft.languages_csv || (st?.primary_language ?? ''),
                });
              }}>
                <option value="">— {draft.dept_code ? `choose from ${staffInDept.length} in dept` : 'pick a department first'} —</option>
                {staffInDept.map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name} — {s.position_title ?? '—'}</option>)}
              </select>
            </L>
            <L label="Position (as AI should say it)"><input style={inp} value={draft.position_override} onChange={e=>setDraft({...draft, position_override: e.target.value })} placeholder="e.g. Head Massage Therapist" /></L>
            <L label="Languages (comma-sep)"><input style={inp} value={draft.languages_csv} onChange={e=>setDraft({...draft, languages_csv: e.target.value })} placeholder="Lao, English, French" /></L>
            <L label="Bio (2-3 sentences)" span={2}>
              <textarea style={{...inp, minHeight: 72}} value={draft.bio} onChange={e=>setDraft({...draft, bio: e.target.value })}
                placeholder="Warm, specific — what makes them exceptional. Used verbatim by our AI concierges." maxLength={500} />
              <div style={{ fontSize: 10, color: INK_M, marginTop: 4 }}>{draft.bio.length} / 500 chars</div>
            </L>
            <L label="Display order"><input type="number" style={inp} value={draft.display_order} onChange={e=>setDraft({...draft, display_order: e.target.value })} /></L>
            <L label="Active">
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft({...draft, is_active: e.target.checked })} /> active</label>
            </L>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={()=>setDraft(null)} disabled={busy} style={btnGhost}>Cancel</button>
            <button onClick={save} disabled={busy} style={btnPrimary}>{busy?'Saving…':'Save'}</button>
          </div>
        </div>
      )}

      {features.length === 0 && !draft ? (
        <div style={{ background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 4, padding: 24, textAlign: 'center', color: INK_M, fontSize: 12 }}>
          No featured team members yet. Click <strong>+ Add team member</strong> to introduce the people our AI concierges should mention when guests ask about staff.
          <br /><span style={{ fontSize: 11 }}>Full roster (all {directory.length}) lives in HR. This tab is for the curated few.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {features.map(f => {
            const langs = f.languages_override && f.languages_override.length > 0 ? f.languages_override : (f.primary_language ? [f.primary_language] : []);
            const pos = f.position_override ?? f.position_title;
            return (
              <div key={f.feature_id} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 6, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{f.full_name ?? '(missing HR record)'}</div>
                    <div style={{ fontSize: 11, color: FOREST, marginTop: 2 }}>{pos ?? '—'}</div>
                    <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>{f.dept_name ?? '—'}</div>
                  </div>
                  {!f.is_active && <span style={{ fontSize: 10, background: '#EDEDED', color: '#8A8A8A', padding: '2px 6px', borderRadius: 3, height: 'fit-content' }}>INACTIVE</span>}
                </div>
                {langs.length > 0 && (
                  <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
                    <span style={{ letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 9, marginRight: 6 }}>Languages</span>
                    {langs.join(' · ')}
                  </div>
                )}
                {f.bio && <div style={{ fontSize: 12, color: '#3A3A3A', marginTop: 10, lineHeight: 1.45 }}>{f.bio}</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button onClick={()=>openEdit(f)} style={btnGhost}>Edit</button>
                  {confirmDel === f.feature_id ? (
                    <>
                      <button onClick={()=>del(f.feature_id)} disabled={busy} style={btnDanger}>Confirm delete</button>
                      <button onClick={()=>setConfirmDel(null)} style={btnGhost}>×</button>
                    </>
                  ) : (
                    <button onClick={()=>setConfirmDel(f.feature_id)} style={btnGhost}>Remove</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function L({ label, children, span=1 }: { label: string; children: React.ReactNode; span?: number }) {
  return <div style={{ gridColumn: span===2 ? '1 / -1' : undefined }}>
    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>{label}</div>
    {children}
  </div>;
}
const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid ' + HAIR, borderRadius: 3, background: '#FFF', fontSize: 12, fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', background: FOREST, color: '#FFF', border: 'none', borderRadius: 3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#C0584C', color: '#FFF', border: 'none', borderRadius: 3, fontSize: 11, cursor: 'pointer' };
