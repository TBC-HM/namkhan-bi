// components/settings/panels/CertificationsPanel.tsx
// PBS 2026-07-03: full CRUD — add · edit · delete · member number + contact.
// Writes via SECURITY DEFINER RPCs (property schema not exposed to PostgREST):
//   fn_upsert_property_certification / fn_delete_property_certification
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';

type CertRow = {
  cert_id: number;
  property_id: number;
  certification_name: string;
  certifying_body: string | null;
  certification_url: string | null;
  member_number: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  level: string | null;
  issued_date: string | null;
  expires_date: string | null;
  is_active: boolean | null;
  notes: string | null;
};

interface Draft {
  cert_id: number | null;
  certification_name: string;
  certifying_body: string;
  certification_url: string;
  member_number: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  level: string;
  issued_date: string;
  expires_date: string;
  is_active: boolean;
  notes: string;
}

const EMPTY: Draft = {
  cert_id: null, certification_name: '', certifying_body: '', certification_url: '',
  member_number: '', contact_person: '', contact_email: '', contact_phone: '',
  level: '', issued_date: '', expires_date: '', is_active: true, notes: '',
};

function toDraft(r: CertRow): Draft {
  return {
    cert_id:            r.cert_id,
    certification_name: r.certification_name ?? '',
    certifying_body:    r.certifying_body ?? '',
    certification_url:  r.certification_url ?? '',
    member_number:      r.member_number ?? '',
    contact_person:     r.contact_person ?? '',
    contact_email:      r.contact_email ?? '',
    contact_phone:      r.contact_phone ?? '',
    level:              r.level ?? '',
    issued_date:        r.issued_date ?? '',
    expires_date:       r.expires_date ?? '',
    is_active:          r.is_active !== false,
    notes:              r.notes ?? '',
  };
}

export default function CertificationsPanel({ data, propertyId }: { data: CertRow[]; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function save() {
    if (!draft) return;
    if (!draft.certification_name.trim()) { setError('Certification name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_certification', {
        p_cert_id:            draft.cert_id,
        p_property_id:        propertyId,
        p_certification_name: draft.certification_name.trim(),
        p_certifying_body:    draft.certifying_body.trim() || null,
        p_certification_url:  draft.certification_url.trim() || null,
        p_member_number:      draft.member_number.trim() || null,
        p_contact_person:     draft.contact_person.trim() || null,
        p_contact_email:      draft.contact_email.trim() || null,
        p_contact_phone:      draft.contact_phone.trim() || null,
        p_level:              draft.level.trim() || null,
        p_issued_date:        draft.issued_date || null,
        p_expires_date:       draft.expires_date || null,
        p_is_active:          draft.is_active,
        p_notes:              draft.notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null);
      router.refresh();
    });
  }

  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_certification', {
        p_cert_id: id, p_property_id: propertyId,
      });
      if (e) { setError(e.message); return; }
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader
        title="Certifications & Affiliations"
        subtitle={`${data.length} entr${data.length === 1 ? 'y' : 'ies'} · SLH · ASEAN Green · etc`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>}
      />

      {error && (
        <div style={{ margin: '12px 20px', padding: 10, background: '#FBE8E4', border: '1px solid #E8B7AB', borderRadius: 4, fontSize: 12, color: '#8A2419' }}>
          {error}
        </div>
      )}

      {draft && <CertForm draft={draft} onChange={setDraft} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy} />}

      {data.length === 0 && !draft ? (
        <EmptyState message="No certifications or affiliations yet." />
      ) : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r) => (
            <div key={r.cert_id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1B1B1B' }}>{r.certification_name}</span>
                  {r.level && <span style={pill('#F5F0E1', '#5A5A5A')}>{r.level}</span>}
                  {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                </div>
                <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {r.certifying_body && <span>{r.certifying_body}</span>}
                  {r.member_number && <span>Member #: <strong style={{ color: '#1B1B1B' }}>{r.member_number}</strong></span>}
                  {r.contact_person && <span>Contact: {r.contact_person}</span>}
                  {r.contact_email && <a href={`mailto:${r.contact_email}`} style={{ color: '#1F3A2E' }}>{r.contact_email}</a>}
                  {r.contact_phone && <span>{r.contact_phone}</span>}
                </div>
                {(r.issued_date || r.expires_date || r.certification_url) && (
                  <div style={{ fontSize: 11, color: '#8A8A8A', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {r.issued_date && <span>issued {r.issued_date.slice(0, 10)}</span>}
                    {r.expires_date && <span>expires {r.expires_date.slice(0, 10)}</span>}
                    {r.certification_url && <a href={r.certification_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1F3A2E' }}>certificate ↗</a>}
                  </div>
                )}
                {r.notes && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                {confirmDelete === r.cert_id ? (
                  <>
                    <button type="button" onClick={() => del(r.cert_id)} disabled={busy} style={btnDanger}>{busy ? '…' : 'Confirm'}</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} style={btnGhost}>Cancel</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(r.cert_id)} style={btnGhost}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CertForm({ draft, onChange, onSave, onCancel, busy }: {
  draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean;
}) {
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div style={{ padding: 20, background: '#FAFAF7', borderBottom: '1px solid #E6DFCC' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1F3A2E', marginBottom: 10 }}>
        {draft.cert_id ? 'Edit certification' : 'New certification / affiliation'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <F label="Certification name *" span={2}>
          <input type="text" value={draft.certification_name} onChange={(e) => setF('certification_name', e.target.value)} placeholder="e.g. Small Luxury Hotels" style={input} />
        </F>
        <F label="Level / tier">
          <input type="text" value={draft.level} onChange={(e) => setF('level', e.target.value)} placeholder="e.g. Gold" style={input} />
        </F>
        <F label="Certifying body">
          <input type="text" value={draft.certifying_body} onChange={(e) => setF('certifying_body', e.target.value)} style={input} />
        </F>
        <F label="Member number">
          <input type="text" value={draft.member_number} onChange={(e) => setF('member_number', e.target.value)} placeholder="Membership ID" style={input} />
        </F>
        <F label="Certificate URL">
          <input type="url" value={draft.certification_url} onChange={(e) => setF('certification_url', e.target.value)} placeholder="https://…" style={input} />
        </F>
        <F label="Contact person">
          <input type="text" value={draft.contact_person} onChange={(e) => setF('contact_person', e.target.value)} style={input} />
        </F>
        <F label="Contact email">
          <input type="email" value={draft.contact_email} onChange={(e) => setF('contact_email', e.target.value)} style={input} />
        </F>
        <F label="Contact phone">
          <input type="text" value={draft.contact_phone} onChange={(e) => setF('contact_phone', e.target.value)} style={input} />
        </F>
        <F label="Issued date">
          <input type="date" value={draft.issued_date} onChange={(e) => setF('issued_date', e.target.value)} style={input} />
        </F>
        <F label="Expires date">
          <input type="date" value={draft.expires_date} onChange={(e) => setF('expires_date', e.target.value)} style={input} />
        </F>
        <F label="Notes" span={3}>
          <input type="text" value={draft.notes} onChange={(e) => setF('notes', e.target.value)} style={input} />
        </F>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1B1B1B', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setF('is_active', e.target.checked)} />
            Active
          </label>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type="button" onClick={onSave} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

function F({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 | 3 }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: '7px 14px', background: '#1F3A2E', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: '#FFFFFF', color: '#1B1B1B', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#B03826', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF', color: '#1B1B1B', fontSize: 13, fontFamily: 'inherit' };
const fieldLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', marginBottom: 4 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 4 };
function pill(bg: string, color: string): React.CSSProperties {
  return { padding: '1px 8px', borderRadius: 99, background: bg, color, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' };
}
