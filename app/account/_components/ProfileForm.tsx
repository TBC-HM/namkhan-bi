// app/account/_components/ProfileForm.tsx
// PBS 2026-07-09: client form for the /account personal profile page.
// Posts to /api/account/update which calls fn_profile_upsert_self (SECURITY DEFINER).
'use client';

import { useState, useTransition, type CSSProperties } from 'react';

export interface ProfileInitial {
  full_name: string;
  preferred_name: string;
  phone: string;
  job_title: string;
  language_pref: string;
  email: string;
  dept_code: string | null;
  property_id: number | null;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'lo', label: 'ພາສາລາວ (Lao)' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];

function companyLabel(pid: number | null): string {
  if (pid === 260955) return 'The Namkhan';
  if (pid === 1000001) return 'Donna Portals (Holding)';
  return '—';
}

export default function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [fullName, setFullName] = useState(initial.full_name);
  const [preferred, setPreferred] = useState(initial.preferred_name);
  const [phone, setPhone] = useState(initial.phone);
  const [jobTitle, setJobTitle] = useState(initial.job_title);
  const [lang, setLang] = useState(initial.language_pref || 'en');
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    startTransition(async () => {
      setErr(null); setOk(false);
      const r = await fetch('/api/account/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim() || null,
          preferred_name: preferred.trim() || null,
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          language_pref: lang || 'en',
        }),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(b.error ?? `save failed (${r.status})`); return; }
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    });
  };

  return (
    <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={grid2}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Full name</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Preferred name</span>
          <input value={preferred} onChange={(e) => setPreferred(e.target.value)} style={inputStyle} placeholder="How we should address you" />
        </label>
      </div>
      <div style={grid2}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+856 20 …" />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Job title / position</span>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} style={inputStyle} placeholder="e.g. F&amp;B Manager" />
        </label>
      </div>
      <div style={grid2}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Email (login)</span>
          <input value={initial.email} disabled style={{ ...inputStyle, background: '#F8F5EC', color: '#7A7A7A' }} />
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Company</span>
          <input value={companyLabel(initial.property_id)} disabled style={{ ...inputStyle, background: '#F8F5EC', color: '#7A7A7A' }} />
        </label>
      </div>
      <div style={grid2}>
        <label style={fieldStyle}>
          <span style={labelStyle}>Language preference</span>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={inputStyle}>
            {LANGUAGES.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
          </select>
        </label>
        <label style={fieldStyle}>
          <span style={labelStyle}>Department (read-only)</span>
          <input value={initial.dept_code ?? '—'} disabled style={{ ...inputStyle, background: '#F8F5EC', color: '#7A7A7A' }} />
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <button type="button" onClick={save} disabled={pending} style={submitStyle}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>
        {ok && <span style={{ fontSize: 11, color: '#0B5B3A' }}>✓ saved</span>}
        {err && <span style={{ fontSize: 11, color: '#B04A2F' }}>{err}</span>}
      </div>
      <div style={{ fontSize: 10, color: '#7A7A7A', marginTop: 4 }}>
        Login email + company + department come from tenancy. To change those, ask a Holding admin on /settings/users.
      </div>
    </div>
  );
}

const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 };
const fieldStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const labelStyle: CSSProperties = { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600 };
const inputStyle: CSSProperties = { padding: '8px 10px', fontSize: 12, border: '1px solid #E6DFCC', borderRadius: 4, background: '#FFFFFF' };
const submitStyle: CSSProperties = {
  padding: '6px 14px', borderRadius: 4, border: 'none',
  background: '#084838', color: '#FFFFFF', fontSize: 11,
  letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer',
};
