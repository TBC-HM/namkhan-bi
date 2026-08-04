'use client';
// app/h/[property_id]/settings/sales/_client/SalesClient.tsx
// Sales & Groups config — group thresholds, discount tiers, SLA, contacts.

import { useState } from 'react';

interface SalesData {
  property_id: number;
  group_min_rooms?: number | null;
  group_deposit_pct?: number | null;
  group_cancellation_days?: number | null;
  group_contact_name?: string | null;
  group_contact_email?: string | null;
  discount_junior_pct?: number | null;
  discount_manager_pct?: number | null;
  discount_director_pct?: number | null;
  inquiry_sla_hours?: number | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid #E6DFCC', borderRadius: 4,
  background: '#FAFAF7', color: '#1B1B1B', fontFamily: 'inherit',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#5A5A5A', marginBottom: 4,
};
const hintStyle: React.CSSProperties = { fontSize: 11, color: '#8A7F6E', marginTop: 3 };
const sectionHead: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#8A7F6E', padding: '12px 0 6px', marginBottom: 8, borderBottom: '1px solid #F0EBE0',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

export default function SalesClient({ initial }: { initial: SalesData }) {
  const [form, setForm] = useState<SalesData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const setNum = (key: keyof SalesData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value === '' ? null : Number(e.target.value) }));
  const setStr = (key: keyof SalesData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  async function save() {
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch('/api/settings/sales', {
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
      <div style={sectionHead}>Group Booking Thresholds</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 24px' }}>
        <Field label="Min Rooms (Group)" hint="Rooms that qualify as a group booking">
          <input style={inputStyle} type="number" min={1} value={form.group_min_rooms ?? ''} onChange={setNum('group_min_rooms')} placeholder="5" />
        </Field>
        <Field label="Group Deposit %" hint="Required deposit at booking confirmation">
          <input style={inputStyle} type="number" min={0} max={100} value={form.group_deposit_pct ?? ''} onChange={setNum('group_deposit_pct')} placeholder="30" />
        </Field>
        <Field label="Cancellation Window (days)" hint="Days before arrival for full refund">
          <input style={inputStyle} type="number" min={0} value={form.group_cancellation_days ?? ''} onChange={setNum('group_cancellation_days')} placeholder="30" />
        </Field>
      </div>

      <div style={sectionHead}>Group Contact</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Field label="Group Coordinator Name" hint="Auto-signed on group proposals">
          <input style={inputStyle} value={form.group_contact_name ?? ''} onChange={setStr('group_contact_name')} placeholder="Sales Manager name" />
        </Field>
        <Field label="Group Coordinator Email">
          <input style={inputStyle} type="email" value={form.group_contact_email ?? ''} onChange={setStr('group_contact_email')} placeholder="groups@thenamkhan.com" />
        </Field>
      </div>

      <div style={sectionHead}>Discount Authority</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0 24px' }}>
        <Field label="Junior (Sales Executive)" hint="Max % they can approve solo">
          <input style={inputStyle} type="number" min={0} max={100} value={form.discount_junior_pct ?? ''} onChange={setNum('discount_junior_pct')} placeholder="10" />
        </Field>
        <Field label="Manager" hint="Max % without Director sign-off">
          <input style={inputStyle} type="number" min={0} max={100} value={form.discount_manager_pct ?? ''} onChange={setNum('discount_manager_pct')} placeholder="20" />
        </Field>
        <Field label="Director" hint="Ceiling — above this needs owner approval">
          <input style={inputStyle} type="number" min={0} max={100} value={form.discount_director_pct ?? ''} onChange={setNum('discount_director_pct')} placeholder="30" />
        </Field>
      </div>

      <div style={sectionHead}>Inquiry SLA</div>
      <div style={{ maxWidth: 240 }}>
        <Field label="Respond Within (hours)" hint="Overdue flag fires in Action Center">
          <input style={inputStyle} type="number" min={1} value={form.inquiry_sla_hours ?? ''} onChange={setNum('inquiry_sla_hours')} placeholder="24" />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '8px 20px', fontSize: 13, fontWeight: 600, borderRadius: 4,
            cursor: saving ? 'wait' : 'pointer',
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
