'use client';

// ScheduledReportsPanel · 2026-07-08
// 3 side-by-side cards (Daily / Weekly / Monthly) for the Revenue HoD landing.
// Additive – lives NEXT TO the existing "My Reports" container, does not replace it.

import React, { useEffect, useMemo, useState, useTransition } from 'react';

type TemplateKey = 'daily' | 'weekly' | 'monthly';

interface Recipient {
  id: number;
  property_id: number;
  template_key: TemplateKey;
  email: string;
  name: string | null;
  active: boolean;
  created_at: string;
}

interface Props {
  propertyId: number;
  initialRecipients?: Recipient[];
}

const CADENCE: Record<TemplateKey, { label: string; cadence: string }> = {
  daily:   { label: 'Daily',   cadence: 'Every day at 08:00 UTC' },
  weekly:  { label: 'Weekly',  cadence: 'Every Monday at 08:00 UTC' },
  monthly: { label: 'Monthly', cadence: '1st of month at 08:00 UTC' },
};

const CARD_STYLE: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 };
const HEADER_STYLE: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: '#0F4C3A', letterSpacing: '-0.01em' };
const CADENCE_LINE_STYLE: React.CSSProperties = { fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 };
const CHIP_STYLE: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#FFFFFF', border: '1px solid #E6DFCC', borderRadius: 999, fontSize: 11, color: '#1B1B1B', maxWidth: '100%' };
const CHIP_INACTIVE: React.CSSProperties = { ...CHIP_STYLE, opacity: 0.5 };
const INPUT_STYLE: React.CSSProperties = { flex: 1, minWidth: 80, padding: '6px 8px', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, color: '#1B1B1B', background: '#FFFFFF', outline: 'none' };
const BTN_PRIMARY: React.CSSProperties = { padding: '6px 12px', background: '#0F4C3A', color: '#FFFFFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const BTN_SECONDARY: React.CSSProperties = { padding: '6px 12px', background: '#FFFFFF', color: '#0F4C3A', border: '1px solid #0F4C3A', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };

function previewHref(templateKey: TemplateKey, propertyId: number): string {
  const qs = propertyId ? `?property_id=${propertyId}` : '';
  return `/revenue/reports/scheduled/${templateKey}/preview${qs}`;
}

function ReportCard({ templateKey, propertyId, recipients, onRefresh }: { templateKey: TemplateKey; propertyId: number; recipients: Recipient[]; onRefresh: () => void; }) {
  const meta = CADENCE[templateKey];
  const [email, setEmail] = useState('');
  const [name, setName]   = useState('');
  const [busy, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const addRecipient = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await fetch('/api/revenue/reports/recipient/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, template_key: templateKey, email: trimmed, name: name.trim() || null }),
      });
      if (res.ok) { setEmail(''); setName(''); setMsg('added'); onRefresh(); }
      else { const t = await res.text().catch(() => ''); setMsg('error: ' + (t || res.status)); }
      setTimeout(() => setMsg(null), 2400);
    });
  };
  const removeRecipient = async (id: number) => {
    startTransition(async () => {
      const res = await fetch('/api/revenue/reports/recipient/remove', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      if (res.ok) onRefresh();
    });
  };
  const sendNow = async () => {
    startTransition(async () => {
      const res = await fetch('/api/revenue/reports/send-now', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, template_key: templateKey }),
      });
      setMsg(res.ok ? 'queued' : 'send error');
      setTimeout(() => setMsg(null), 2400);
    });
  };

  return (
    <div style={CARD_STYLE}>
      <div>
        <div style={HEADER_STYLE}>{meta.label} report</div>
        <div style={CADENCE_LINE_STYLE}>{meta.cadence}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 24 }}>
        {recipients.length === 0 && (<span style={{ fontSize: 11, color: '#999' }}>No recipients yet</span>)}
        {recipients.map((r) => (
          <span key={r.id} style={r.active ? CHIP_STYLE : CHIP_INACTIVE} title={r.email}>
            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name ? `${r.name} <${r.email}>` : r.email}
            </span>
            <button onClick={() => removeRecipient(r.id)} disabled={busy} aria-label={`remove ${r.email}`}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#666', padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={INPUT_STYLE} type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
          <input style={INPUT_STYLE} type="text"  placeholder="Name (optional)"    value={name}  onChange={(e) => setName(e.target.value)}  disabled={busy} />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={BTN_PRIMARY}   onClick={addRecipient} disabled={busy || !email.trim()}>+ Add</button>
          <button style={BTN_SECONDARY} onClick={sendNow}      disabled={busy || recipients.length === 0}>Send now</button>
          <a href={previewHref(templateKey, propertyId)} style={{ fontSize: 11, color: '#0F4C3A', textDecoration: 'underline', marginLeft: 'auto' }}>Preview →</a>
        </div>
        {msg && <div style={{ fontSize: 11, color: msg.startsWith('error') ? '#B00020' : '#0F4C3A' }}>{msg}</div>}
      </div>
    </div>
  );
}

export default function ScheduledReportsPanel({ propertyId, initialRecipients = [] }: Props) {
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [loading, setLoading]       = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/revenue/reports/recipient/list?property_id=${propertyId}`, { cache: 'no-store' });
      if (res.ok) { const j = await res.json(); setRecipients(j.recipients ?? []); }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (initialRecipients.length === 0) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const grouped = useMemo(() => {
    const out: Record<TemplateKey, Recipient[]> = { daily: [], weekly: [], monthly: [] };
    for (const r of recipients) if (out[r.template_key]) out[r.template_key].push(r);
    return out;
  }, [recipients]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, opacity: loading ? 0.7 : 1 }}>
      <ReportCard templateKey="daily"   propertyId={propertyId} recipients={grouped.daily}   onRefresh={refresh} />
      <ReportCard templateKey="weekly"  propertyId={propertyId} recipients={grouped.weekly}  onRefresh={refresh} />
      <ReportCard templateKey="monthly" propertyId={propertyId} recipients={grouped.monthly} onRefresh={refresh} />
    </div>
  );
}
