// components/settings/panels/ContactsPanel.tsx
// PBS 2026-07-03: full CRUD panel — add · edit · delete · toggle active/public.
// Writes via SECURITY DEFINER RPCs (property schema not exposed to PostgREST).
//   fn_upsert_property_contact(contact_id?, property_id, kind, purpose, value, …)
//   fn_delete_property_contact(contact_id, property_id)
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';

type ContactRow = {
  contact_id: number;
  property_id: number;
  kind: string;
  purpose: string;
  value: string;
  display_label: string | null;
  is_primary: boolean | null;
  is_public: boolean | null;
  is_active: boolean | null;
  hours_local: string | null;
  notes: string | null;
};

const KIND_OPTIONS = ['phone','mobile','whatsapp','email','line','wechat','telegram','fax'] as const;
const PURPOSE_OPTIONS = ['reservations','front_desk','gm','owner','marketing','billing','press','hr','emergency','spa','restaurant','activities','transport','general'] as const;

interface Draft {
  contact_id: number | null;
  kind: string;
  purpose: string;
  value: string;
  display_label: string;
  is_primary: boolean;
  is_public: boolean;
  is_active: boolean;
  hours_local: string;
  notes: string;
}

const EMPTY: Draft = {
  contact_id: null, kind: 'email', purpose: 'general', value: '', display_label: '',
  is_primary: false, is_public: true, is_active: true, hours_local: '', notes: '',
};

function toDraft(r: ContactRow): Draft {
  return {
    contact_id: r.contact_id,
    kind: r.kind,
    purpose: r.purpose,
    value: r.value,
    display_label: r.display_label ?? '',
    is_primary: !!r.is_primary,
    is_public: r.is_public !== false,
    is_active: r.is_active !== false,
    hours_local: r.hours_local ?? '',
    notes: r.notes ?? '',
  };
}

export default function ContactsPanel({ data, propertyId }: { data: ContactRow[]; propertyId?: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Derive property from row if not passed
  const pid = useMemo(() => propertyId ?? data[0]?.property_id ?? null, [propertyId, data]);
  const grouped = useMemo(() => {
    const m = new Map<string, ContactRow[]>();
    for (const r of data) {
      const k = r.purpose ?? 'general';
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  function save() {
    if (!draft || pid == null) return;
    if (!draft.value.trim()) { setError('Value is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_contact', {
        p_contact_id:    draft.contact_id,
        p_property_id:   pid,
        p_kind:          draft.kind,
        p_purpose:       draft.purpose,
        p_value:         draft.value.trim(),
        p_display_label: draft.display_label.trim() || null,
        p_is_primary:    draft.is_primary,
        p_is_public:     draft.is_public,
        p_is_active:     draft.is_active,
        p_hours_local:   draft.hours_local.trim() || null,
        p_notes:         draft.notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null);
      router.refresh();
    });
  }

  function del(id: number) {
    if (pid == null) return;
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_contact', {
        p_contact_id: id, p_property_id: pid,
      });
      if (e) { setError(e.message); return; }
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader
        title="Contacts"
        subtitle={`${data.length} contact${data.length === 1 ? '' : 's'} · grouped by purpose`}
        action={
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY })}
            style={btnPrimary}
          >
            + Add contact
          </button>
        }
      />

      {error && (
        <div style={{ margin: '12px 20px', padding: 10, background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: '#8A2419' }}>
          {error}
        </div>
      )}

      {draft && (
        <ContactForm
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onCancel={() => { setDraft(null); setError(null); }}
          busy={busy}
        />
      )}

      {data.length === 0 && !draft ? (
        <EmptyState message="No contacts yet." />
      ) : (
        <div>
          {grouped.map(([purpose, rows]) => (
            <section key={purpose} style={{ padding: '14px 20px', borderBottom: '1px solid #E6DFCC' }}>
              <h3 style={sectionTitle}>{purpose.replace(/_/g, ' ')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map((r) => (
                  <div key={r.contact_id} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>{r.kind}</span>
                        <span style={{ fontSize: 13, color: '#1B1B1B', fontWeight: 500 }}>{r.value}</span>
                        {r.display_label && <span style={{ fontSize: 11, color: '#5A5A5A' }}>({r.display_label})</span>}
                        {r.is_primary && <span style={pill('#1F3A2E', '#FFFFFF')}>primary</span>}
                        {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                        {r.is_public === false && <span style={pill('#F5F0E1', '#8A8A8A')}>private</span>}
                      </div>
                      {(r.hours_local || r.notes) && (
                        <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3 }}>
                          {r.hours_local && <span>hrs: {r.hours_local}</span>}
                          {r.hours_local && r.notes && <span> · </span>}
                          {r.notes && <span>{r.notes}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                      {confirmDelete === r.contact_id ? (
                        <>
                          <button type="button" onClick={() => del(r.contact_id)} disabled={busy} style={btnDanger}>{busy ? 'Deleting…' : 'Confirm'}</button>
                          <button type="button" onClick={() => setConfirmDelete(null)} style={btnGhost}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(r.contact_id)} style={btnGhost}>Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactForm({ draft, onChange, onSave, onCancel, busy }: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div style={{ padding: 20, background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1F3A2E', marginBottom: 10 }}>
        {draft.contact_id ? 'Edit contact' : 'New contact'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <Field label="Kind">
          <select value={draft.kind} onChange={(e) => setF('kind', e.target.value)} style={input}>
            {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Purpose">
          <select value={draft.purpose} onChange={(e) => setF('purpose', e.target.value)} style={input}>
            {PURPOSE_OPTIONS.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>
        <Field label="Value *">
          <input type="text" value={draft.value} onChange={(e) => setF('value', e.target.value)} placeholder="e.g. +856 71 260 555" style={input} />
        </Field>
        <Field label="Display label">
          <input type="text" value={draft.display_label} onChange={(e) => setF('display_label', e.target.value)} placeholder="e.g. Reservations desk" style={input} />
        </Field>
        <Field label="Hours (local)">
          <input type="text" value={draft.hours_local} onChange={(e) => setF('hours_local', e.target.value)} placeholder="e.g. 08:00-22:00" style={input} />
        </Field>
        <Field label="Notes">
          <input type="text" value={draft.notes} onChange={(e) => setF('notes', e.target.value)} style={input} />
        </Field>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Check label="Primary" checked={draft.is_primary} onChange={(v) => setF('is_primary', v)} />
          <Check label="Public"  checked={draft.is_public}  onChange={(v) => setF('is_public',  v)} />
          <Check label="Active"  checked={draft.is_active}  onChange={(v) => setF('is_active',  v)} />
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type="button" onClick={onSave} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1B1B1B', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  padding: '7px 14px', background: '#1F3A2E', color: '#FFFFFF',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 12px', background: '#FFFFFF', color: '#1B1B1B',
  border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit',
};
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', background: '#B03826', color: '#FFFFFF',
  border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
};
const input: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid #E6DFCC',
  borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B',
  fontSize: 13, fontFamily: 'inherit',
};
const fieldLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 4,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: '#1F3A2E', margin: '0 0 8px',
};
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  padding: '8px 10px', background: '#FFFFFF',
  border: '1px solid #E6DFCC', borderRadius: 4,
};
function pill(bg: string, color: string): React.CSSProperties {
  return {
    padding: '1px 8px', borderRadius: 99, background: bg, color,
    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
  };
}
