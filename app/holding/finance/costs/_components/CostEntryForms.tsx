'use client';
// app/holding/finance/costs/_components/CostEntryForms.tsx
// Cost Governance v1.5 (brief cost-governance-v1 · ADR-196 "full ledger now"):
// manual capture UI for the two non-automated cost sources —
//   1. infra / SaaS monthly charges  → POST /api/costs/infra-charge
//   2. PBS build hours               → POST /api/costs/build-labor
// Both bridges ingest into the immutable ledger immediately; the page's
// server-rendered views pick the rows up on refresh (router.refresh()).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const PRIMARY = '#1F3A2E';

const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabel: CSSProperties = { fontSize: 11, letterSpacing: '0.4px', textTransform: 'uppercase', color: INK_M };
const input: CSSProperties = {
  border: `1px solid ${HAIR}`, borderRadius: 6, padding: '7px 10px',
  fontSize: 13, color: INK, background: '#FFFFFF', minWidth: 110,
};
const btn: CSSProperties = {
  background: PRIMARY, color: '#FFFFFF', border: `1px solid ${PRIMARY}`,
  borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
};

const WORK_CLASSES = ['platform_operations', 'platform_build', 'tenant_operations', 'client_special_request'];
const COST_NATURES = ['infrastructure', 'saas', 'ai_inference', 'human_labor', 'other'];
const MODULE_KEYS = ['', 'platform_required', 'finance', 'revenue', 'operations', 'marketing', 'guest_crm', 'sales', 'frontoffice', 'hr_people', 'spa', 'fb_pos', 'activities', 'utilities'];

export default function CostEntryForms() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // infra charge state
  const [icMonth, setIcMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [icProvider, setIcProvider] = useState('');
  const [icDesc, setIcDesc] = useState('');
  const [icAmount, setIcAmount] = useState('');
  const [icClass, setIcClass] = useState('platform_operations');
  const [icNature, setIcNature] = useState('infrastructure');
  const [icEstimate, setIcEstimate] = useState(false);

  // build labor state
  const [blDate, setBlDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [blHours, setBlHours] = useState('');
  const [blInitiative, setBlInitiative] = useState('');
  const [blModule, setBlModule] = useState('');
  const [blNote, setBlNote] = useState('');

  async function post(url: string, body: Record<string, unknown>, okText: string) {
    setBusy(true); setMsg('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({ ok: false, error: `http_${res.status}` })) as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(okText); router.refresh(); }
      else setMsg(`Error: ${j.error ?? 'unknown'}`);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally { setBusy(false); }
  }

  function submitInfra() {
    const amount = Number(icAmount);
    if (!icProvider.trim()) { setMsg('Provider is required.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setMsg('Amount must be a positive number.'); return; }
    void post('/api/costs/infra-charge', {
      charge_month: icMonth, provider: icProvider, description: icDesc,
      amount_usd: amount, work_class: icClass, cost_nature: icNature, is_estimate: icEstimate,
    }, `Charge recorded: ${icProvider} $${amount} · ${icMonth}`);
    setIcProvider(''); setIcDesc(''); setIcAmount('');
  }

  function submitLabor() {
    const hours = Number(blHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) { setMsg('Hours must be between 0 and 24.'); return; }
    void post('/api/costs/build-labor', {
      work_date: blDate, hours, initiative: blInitiative, module_key: blModule || null, note: blNote,
    }, `Logged ${hours}h on ${blDate}${blInitiative ? ` · ${blInitiative}` : ''}`);
    setBlHours(''); setBlInitiative(''); setBlNote('');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
      {/* infra / SaaS charge */}
      <div style={{ border: `1px solid ${HAIR}`, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13, color: INK, marginBottom: 10 }}>Infra / SaaS charge (monthly)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={fieldWrap}><span style={fieldLabel}>Month</span>
            <input type="month" value={icMonth} onChange={(e) => setIcMonth(e.target.value)} style={input} /></label>
          <label style={fieldWrap}><span style={fieldLabel}>Provider</span>
            <input value={icProvider} onChange={(e) => setIcProvider(e.target.value)} placeholder="supabase / vercel / resend" style={input} /></label>
          <label style={fieldWrap}><span style={fieldLabel}>Amount USD</span>
            <input type="number" min={0} step={0.01} value={icAmount} onChange={(e) => setIcAmount(e.target.value)} style={{ ...input, minWidth: 90 }} /></label>
          <label style={fieldWrap}><span style={fieldLabel}>Class</span>
            <select value={icClass} onChange={(e) => setIcClass(e.target.value)} style={input}>
              {WORK_CLASSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select></label>
          <label style={fieldWrap}><span style={fieldLabel}>Nature</span>
            <select value={icNature} onChange={(e) => setIcNature(e.target.value)} style={input}>
              {COST_NATURES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select></label>
          <label style={fieldWrap}><span style={fieldLabel}>Description</span>
            <input value={icDesc} onChange={(e) => setIcDesc(e.target.value)} placeholder="optional" style={{ ...input, minWidth: 160 }} /></label>
          <label style={{ ...fieldWrap, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={icEstimate} onChange={(e) => setIcEstimate(e.target.checked)} />
            <span style={{ fontSize: 12, color: INK_M }}>estimate</span></label>
          <button type="button" onClick={submitInfra} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>Record charge</button>
        </div>
      </div>

      {/* build labor */}
      <div style={{ border: `1px solid ${HAIR}`, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 13, color: INK, marginBottom: 10 }}>Build hours (PBS · price-book rate unless overridden)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={fieldWrap}><span style={fieldLabel}>Date</span>
            <input type="date" value={blDate} onChange={(e) => setBlDate(e.target.value)} style={input} /></label>
          <label style={fieldWrap}><span style={fieldLabel}>Hours</span>
            <input type="number" min={0} max={24} step={0.25} value={blHours} onChange={(e) => setBlHours(e.target.value)} style={{ ...input, minWidth: 80 }} /></label>
          <label style={fieldWrap}><span style={fieldLabel}>Initiative</span>
            <input value={blInitiative} onChange={(e) => setBlInitiative(e.target.value)} placeholder="e.g. cost-governance-v1" style={{ ...input, minWidth: 170 }} /></label>
          <label style={fieldWrap}><span style={fieldLabel}>Module</span>
            <select value={blModule} onChange={(e) => setBlModule(e.target.value)} style={input}>
              {MODULE_KEYS.map((m) => <option key={m} value={m}>{m === '' ? '(none)' : m.replace(/_/g, ' ')}</option>)}
            </select></label>
          <label style={fieldWrap}><span style={fieldLabel}>Note</span>
            <input value={blNote} onChange={(e) => setBlNote(e.target.value)} placeholder="optional" style={{ ...input, minWidth: 160 }} /></label>
          <button type="button" onClick={submitLabor} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>Log hours</button>
        </div>
      </div>

      {msg ? <div style={{ gridColumn: '1 / -1', fontSize: 13, color: msg.startsWith('Error') ? '#B8542A' : PRIMARY }}>{msg}</div> : null}
    </div>
  );
}
