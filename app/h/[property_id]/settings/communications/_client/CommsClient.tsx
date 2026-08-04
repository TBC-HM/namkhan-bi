'use client';
// app/h/[property_id]/settings/communications/_client/CommsClient.tsx
// Editable comms identity settings. footer_address fixes the newsletter footer.

import { useState } from 'react';

interface CommsData {
  property_id: number;
  sender_name?: string | null;
  from_email?: string | null;
  reply_to_email?: string | null;
  footer_address?: string | null;
  unsubscribe_text?: string | null;
  email_signature?: string | null;
  whatsapp_number?: string | null;
  website_url?: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid #E6DFCC', borderRadius: 4,
  background: '#FAFAF7', color: '#1B1B1B', fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#5A5A5A', marginBottom: 4,
};
const hintStyle: React.CSSProperties = {
  fontSize: 11, color: '#8A7F6E', marginTop: 3,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

export default function CommsClient({ initial }: { initial: CommsData }) {
  const [form, setForm] = useState<CommsData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof CommsData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  async function save() {
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch('/api/settings/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Field label="Sender Name" hint="Shown as 'From' name in email clients">
          <input style={inputStyle} value={form.sender_name ?? ''} onChange={set('sender_name')} placeholder="The Namkhan Project" />
        </Field>
        <Field label="From Email" hint="Sending address (must be verified in your ESP)">
          <input style={inputStyle} type="email" value={form.from_email ?? ''} onChange={set('from_email')} placeholder="hello@thenamkhan.com" />
        </Field>
        <Field label="Reply-To Email">
          <input style={inputStyle} type="email" value={form.reply_to_email ?? ''} onChange={set('reply_to_email')} placeholder="reservations@thenamkhan.com" />
        </Field>
        <Field label="WhatsApp Number" hint="International format: +856...">
          <input style={inputStyle} value={form.whatsapp_number ?? ''} onChange={set('whatsapp_number')} placeholder="+856 20 ..." />
        </Field>
        <Field label="Website URL">
          <input style={inputStyle} value={form.website_url ?? ''} onChange={set('website_url')} placeholder="https://thenamkhan.com" />
        </Field>
      </div>

      <Field
        label="Physical Footer Address"
        hint="Required by CAN-SPAM / GDPR — appears in every email footer. Fix this to correct the newsletter location bug."
      >
        <textarea
          style={{ ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'inherit' }}
          value={form.footer_address ?? ''}
          onChange={set('footer_address')}
          placeholder={'The Namkhan Project\nBan Namkhan, Luang Prabang Province\nLao PDR'}
        />
      </Field>

      <Field label="Unsubscribe Footer Text" hint="Override the default unsubscribe line (optional)">
        <input style={inputStyle} value={form.unsubscribe_text ?? ''} onChange={set('unsubscribe_text')} placeholder="You received this because you stayed with us. Unsubscribe anytime." />
      </Field>

      <Field label="Email Signature" hint="Plain-text closing used in transactional emails">
        <textarea
          style={{ ...inputStyle, height: 64, resize: 'vertical', fontFamily: 'inherit' }}
          value={form.email_signature ?? ''}
          onChange={set('email_signature')}
          placeholder={'Warm regards,\nThe Namkhan Team'}
        />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 4, cursor: saving ? 'wait' : 'pointer',
            background: '#1F3A2E', color: '#FFFFFF', border: 'none',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#2E7D32', fontWeight: 500 }}>✓ Saved</span>}
        {error && <span style={{ fontSize: 12, color: '#C62828' }}>{error}</span>}
      </div>
    </div>
  );
}
