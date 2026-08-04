'use client';
// app/holding/commercial/CommercialActions.tsx
// Monetization Engine v2 — Business Model Designer + Findings button (client island).
// A13: PBS composes membership / usage / hybrid plans and assigns them to a tenant
// entirely in the UI — zero deploy. Writes go through /api/commercial/designer →
// service-role RPCs. Findings post to the standing owner-findings channel
// (/api/holding/module-findings, module='monetization') per law 729.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type MeterOption = { meter_code: string; name: string; unit: string };

type MeterRow = {
  meter_code: string;
  price_model: string;
  unit_amount: string;
  included_quantity: string;
};

const PRICE_MODELS = ['per_unit', 'graduated', 'volume', 'stairstep', 'package', 'cost_plus', 'flat', 'custom'];
const PROPERTIES = [
  { id: 260955, label: 'The Namkhan' },
  { id: 1000001, label: 'Donna Portals' },
];

const box: React.CSSProperties = {
  border: '1px solid var(--hairline)', borderRadius: 8, padding: 12, background: 'var(--paper)',
};
const inp: React.CSSProperties = {
  border: '1px solid var(--hairline)', borderRadius: 6, padding: '6px 8px', fontSize: 13, width: '100%',
};
const btn: React.CSSProperties = {
  background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6,
  padding: '8px 14px', fontSize: 13, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--ink)', border: '1px solid var(--hairline)',
  borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
};

export default function CommercialActions({ meters }: { meters: MeterOption[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create plan state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('plan');
  const [basePrice, setBasePrice] = useState('');
  const [interval, setInterval_] = useState('month');
  const [seats, setSeats] = useState('');
  const [credits, setCredits] = useState('');
  const [meterRows, setMeterRows] = useState<MeterRow[]>([]);

  // assign state
  const [assignPid, setAssignPid] = useState('260955');
  const [assignCode, setAssignCode] = useState('');

  // finding state
  const [findingText, setFindingText] = useState('');
  const [findingSev, setFindingSev] = useState('medium');

  async function post(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch('/api/commercial/designer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function createPlan() {
    setBusy(true); setMsg(null);
    const entitlements: Record<string, unknown> = {};
    if (seats) entitlements['seats'] = Number(seats);
    if (credits) entitlements['included_credits_usd'] = Number(credits);
    const payload = {
      action: 'create_plan',
      product_code: code, name, kind,
      base_price: basePrice === '' ? null : Number(basePrice),
      interval,
      meters: meterRows
        .filter((m) => m.meter_code)
        .map((m) => ({
          meter_code: m.meter_code,
          price_model: m.price_model,
          unit_amount: m.unit_amount === '' ? null : Number(m.unit_amount),
          included_quantity: m.included_quantity === '' ? 0 : Number(m.included_quantity),
        })),
      entitlements,
    };
    const out = await post(payload);
    setBusy(false);
    if (out && out['ok']) {
      setMsg(`Created ${code} v${String(out['version'])} (draft price book). Assign it below to see it flow.`);
      router.refresh();
    } else {
      setMsg(`Error: ${String(out?.['error'] ?? 'unknown')}`);
    }
  }

  async function assignPlan() {
    setBusy(true); setMsg(null);
    const out = await post({ action: 'assign_plan', property_id: Number(assignPid), product_code: assignCode });
    setBusy(false);
    if (out && out['ok']) {
      setMsg(`Assigned ${assignCode.toUpperCase()} to property ${assignPid} — contract + subscription + entitlements written.`);
      router.refresh();
    } else {
      setMsg(`Error: ${String(out?.['error'] ?? 'unknown')}`);
    }
  }

  async function sendFinding() {
    if (findingText.trim().length < 5) { setMsg('Finding text too short.'); return; }
    setBusy(true); setMsg(null);
    const fd = new FormData();
    fd.set('module', 'monetization');
    fd.set('finding', findingText.trim());
    fd.set('severity', findingSev);
    const res = await fetch('/api/holding/module-findings', { method: 'POST', body: fd });
    const out = (await res.json()) as Record<string, unknown>;
    setBusy(false);
    setMsg(res.ok ? 'Finding filed — it blocks completion until resolved (law 729).' : `Error: ${String(out?.['error'] ?? 'unknown')}`);
    if (res.ok) setFindingText('');
  }

  function addMeterRow() {
    setMeterRows((r) => [...r, { meter_code: '', price_model: 'per_unit', unit_amount: '', included_quantity: '' }]);
  }
  function setRow(i: number, patch: Partial<MeterRow>) {
    setMeterRows((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
      <div style={box}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Create a business model</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <input style={inp} placeholder="Code (e.g. PLAN-BOUTIQUE)" value={code} onChange={(e) => setCode(e.target.value)} />
          <input style={inp} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <select style={inp} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="plan">plan (membership)</option>
              <option value="module">module add-on</option>
              <option value="package">package</option>
              <option value="usage_product">usage product</option>
            </select>
            <select style={inp} value={interval} onChange={(e) => setInterval_(e.target.value)}>
              <option value="month">monthly</option>
              <option value="year">annual</option>
            </select>
          </div>
          <input style={inp} placeholder="Base fee USD/interval — empty = pure usage" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={inp} placeholder="Seats" value={seats} onChange={(e) => setSeats(e.target.value)} />
            <input style={inp} placeholder="Incl. credits $" value={credits} onChange={(e) => setCredits(e.target.value)} />
          </div>
          {meterRows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <select style={inp} value={r.meter_code} onChange={(e) => setRow(i, { meter_code: e.target.value })}>
                <option value="">— meter —</option>
                {meters.map((m) => <option key={m.meter_code} value={m.meter_code}>{m.name} ({m.unit})</option>)}
              </select>
              <select style={inp} value={r.price_model} onChange={(e) => setRow(i, { price_model: e.target.value })}>
                {PRICE_MODELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input style={{ ...inp, width: 80 }} placeholder="$/unit" value={r.unit_amount} onChange={(e) => setRow(i, { unit_amount: e.target.value })} />
              <input style={{ ...inp, width: 70 }} placeholder="incl." value={r.included_quantity} onChange={(e) => setRow(i, { included_quantity: e.target.value })} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btnGhost} onClick={addMeterRow} type="button">+ metered component</button>
            <button style={btn} onClick={createPlan} disabled={busy} type="button">
              {busy ? 'Working…' : 'Create (draft)'}
            </button>
          </div>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Assign a model to a tenant</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <select style={inp} value={assignPid} onChange={(e) => setAssignPid(e.target.value)}>
            {PROPERTIES.map((p) => <option key={p.id} value={String(p.id)}>{p.label}</option>)}
          </select>
          <input style={inp} placeholder="Product code (e.g. PLAN-PRO)" value={assignCode} onChange={(e) => setAssignCode(e.target.value)} />
          <button style={btn} onClick={assignPlan} disabled={busy} type="button">
            {busy ? 'Working…' : 'Assign (draft contract)'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            Writes contract + subscription + entitlements. Shadow-rated only — external billing stays gated (ADR-197).
          </div>
        </div>
      </div>

      <div style={box}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>File a finding on this module</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <textarea style={{ ...inp, minHeight: 64 }} placeholder="What is wrong or missing?" value={findingText} onChange={(e) => setFindingText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...inp, width: 120 }} value={findingSev} onChange={(e) => setFindingSev(e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <button style={btn} onClick={sendFinding} disabled={busy} type="button">File finding</button>
          </div>
        </div>
      </div>

      {msg ? (
        <div style={{ gridColumn: '1 / -1', fontSize: 12, color: msg.startsWith('Error') ? 'var(--terracotta)' : 'var(--primary)' }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
