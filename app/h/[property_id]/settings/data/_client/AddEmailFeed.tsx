'use client';
// Lets a user configure email-based ingest for an integration.
// Updates property.data_integrations via /api/settings/upsert.
import { useState } from 'react';

const T = { forest: '#1F3A2E', border: '#E6DFCC', ink: '#1B1B1B', inkSoft: '#5A5A5A',
  paper: '#FFFFFF', bg: '#F4EFE2', amber: '#B48A3A', amberTint: '#FAF6E9', red: '#B03826' };

interface Props {
  propertyId: number;
  integrationSlug: string;
  integrationName: string;
  currentAddress?: string | null;
  currentSubject?: string | null;
  currentFrom?: string | null;
  currentEnabled?: boolean;
}

export default function AddEmailFeed({ propertyId, integrationSlug, integrationName,
  currentAddress, currentSubject, currentFrom, currentEnabled }: Props) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(currentAddress ?? '');
  const [subject, setSubject] = useState(currentSubject ?? '');
  const [from, setFrom] = useState(currentFrom ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    if (!address.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/settings/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'data_integration_email',
          table: 'data_integrations',
          pk: 'slug',
          row: {
            property_id: propertyId,
            slug: integrationSlug,
            email_ingest_enabled: true,
            email_ingest_address: address.trim(),
            email_ingest_subject_pattern: subject.trim() || null,
            email_ingest_from_pattern: from.trim() || null,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setMsg({ ok: false, text: j.error ?? 'failed' }); }
      else { setMsg({ ok: true, text: 'Email feed saved — Gmail scan cron will pick up matching emails automatically.' }); setOpen(false); }
    } catch { setMsg({ ok: false, text: 'network error' }); }
    setBusy(false);
  }

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{
        fontSize: 10, color: T.amber, background: T.amberTint, border: `1px solid ${T.amber}`,
        borderRadius: 3, padding: '3px 10px', cursor: 'pointer', fontWeight: 600,
      }}>
        {currentEnabled ? '✏ Edit email feed' : '+ Configure email feed'}
      </button>

      {open && (
        <div style={{ marginTop: 10, background: T.amberTint, border: `1px solid ${T.amber}`, borderRadius: 4, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 8 }}>
            Email feed — {integrationName}
          </div>
          <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 10 }}>
            Forward reports to your inbox. The Gmail scan cron picks up emails matching the subject pattern and routes them to this integration automatically.
          </div>

          {[
            { label: 'Forward reports to this email address', val: address, set: setAddress, placeholder: 'reservations@thenamkhan.com', required: true },
            { label: 'Subject line must contain (SQL LIKE pattern)', val: subject, set: setSubject, placeholder: 'Lighthouse%rate%' },
            { label: 'Sender email contains (optional)', val: from, set: setFrom, placeholder: '%lighthouse%' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 10.5, color: T.inkSoft, display: 'block', marginBottom: 3 }}>
                {f.label}{f.required ? ' *' : ''}
              </label>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 12, fontFamily: 'ui-monospace,monospace', boxSizing: 'border-box' }} />
            </div>
          ))}

          {msg && <div style={{ fontSize: 11, color: msg.ok ? T.forest : T.red, marginBottom: 8 }}>{msg.text}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={busy || !address.trim()} style={{
              padding: '6px 14px', background: T.forest, color: '#fff', border: 'none',
              borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: !address.trim() ? 0.5 : 1,
            }}>{busy ? 'Saving…' : 'Save email feed'}</button>
            <button onClick={() => setOpen(false)} style={{
              padding: '6px 10px', background: T.paper, color: T.inkSoft, border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 11, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
