// app/holding/legal/contracts/new/page.tsx
// PBS 2026-07-07: New Revenue Contract form. Calls /api/contracts/create,
// which relays to the create-revenue-contract edge fn with service-role auth.
// On success, displays the client + Beyond signing links.

'use client';

import Link from 'next/link';
import { useState } from 'react';

interface RateRow { room_type: string; min: string; max: string }
interface OtaRow { name: string; commission_pct: string }

interface CreateResp {
  agreement_id?: number;
  code?: string;
  client_sign_url?: string;
  beyond_sign_url?: string;
  error?: string;
}

export default function NewContractPage() {
  // Client
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [regNo, setRegNo] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [representative, setRepresentative] = useState('');
  const [email, setEmail] = useState('');
  const [propertyDetails, setPropertyDetails] = useState('');
  const [propertyId, setPropertyId] = useState<string>('');

  // Services
  const [svcAudit, setSvcAudit] = useState(false);
  const [svcConsulting, setSvcConsulting] = useState(true);
  const [svcOutsourced, setSvcOutsourced] = useState(true);
  const [svcTraining, setSvcTraining] = useState(false);
  const [svcOta, setSvcOta] = useState(true);

  // Terms
  const [fixedFee, setFixedFee] = useState('');
  const [bonusPct, setBonusPct] = useState('');
  const [stepupFee, setStepupFee] = useState('');
  const [minBonus, setMinBonus] = useState('');
  const [bonusCap, setBonusCap] = useState('');
  const [netRevDef, setNetRevDef] = useState('');
  const [exclusivity, setExclusivity] = useState('similar');
  const [tradeLicence, setTradeLicence] = useState('');

  // Appendix A
  const [rateRows, setRateRows] = useState<RateRow[]>([{ room_type: '', min: '', max: '' }]);
  const [otaRows, setOtaRows] = useState<OtaRow[]>([{ name: '', commission_pct: '' }]);
  const [chWholesale, setChWholesale] = useState('');
  const [chIbe, setChIbe] = useState('');
  const [chGds, setChGds] = useState('');
  const [chCorp, setChCorp] = useState('');
  const [chCm, setChCm] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [minlos, setMinlos] = useState('');
  const [approvalHours, setApprovalHours] = useState('');
  const [ctaCtd, setCtaCtd] = useState('');
  const [stopSell, setStopSell] = useState('');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    if (!legalName.trim()) { setError('Client legal name is required.'); setBusy(false); return; }
    if (!fixedFee || !Number.isFinite(Number(fixedFee))) { setError('Fixed fee (USD) is required and must be a number.'); setBusy(false); return; }

    const appendix_a = {
      rate_grid: rateRows.filter(r => r.room_type.trim()).map(r => ({ room_type: r.room_type, min: Number(r.min) || 0, max: Number(r.max) || 0 })),
      ota: otaRows.filter(o => o.name.trim()).map(o => ({ name: o.name, commission_pct: Number(o.commission_pct) || 0 })),
      channels: { wholesale: chWholesale, ibe: chIbe, gds: chGds, corp: chCorp, cm: chCm },
      discount_pct: Number(discountPct) || undefined,
      minlos: Number(minlos) || undefined,
      approval_hours: Number(approvalHours) || undefined,
      cta_ctd: ctaCtd || undefined,
      stop_sell: stopSell || undefined,
    };

    const body = {
      property_id: propertyId ? Number(propertyId) : null,
      client: { legal_name: legalName, address, reg_no: regNo, jurisdiction, representative, email, property_details: propertyDetails },
      services: { audit: svcAudit, consulting: svcConsulting, outsourced: svcOutsourced, training: svcTraining, ota: svcOta },
      terms: {
        fixed_fee_usd: Number(fixedFee),
        bonus_pct: Number(bonusPct) || 0,
        stepup_fee_usd: stepupFee ? Number(stepupFee) : null,
        min_bonus_usd: minBonus ? Number(minBonus) : null,
        bonus_cap_usd: bonusCap ? Number(bonusCap) : null,
        net_revenue_definition: netRevDef || null,
        exclusivity_scope: exclusivity,
        appendix_a,
      },
      trade_licence: tradeLicence,
    };

    try {
      const r = await fetch('/api/contracts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as CreateResp;
      if (!r.ok || j.error) { setError(j.error ?? `HTTP ${r.status}`); }
      else { setResult(j); }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', minHeight: '100vh', padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/holding/legal/contracts" style={{ fontSize: 12, color: '#5A5A5A', textDecoration: 'none' }}>← All contracts</Link>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 700 }}>New revenue contract</h1>
        <p style={{ margin: 0, fontSize: 12, color: '#5A5A5A' }}>Beyond Circle ↔ Client · fills the PDF template + creates 2 signing sessions (client + Beyond).</p>
      </div>

      {result ? (
        <Success r={result} />
      ) : (
        <>
          <Section title="Client" subtitle="Counterparty details (goes onto the agreement + into contracts.parties).">
            <Field label="Legal name *"><input value={legalName} onChange={e => setLegalName(e.target.value)} style={inp} /></Field>
            <Field label="Registered address"><input value={address} onChange={e => setAddress(e.target.value)} style={inp} /></Field>
            <Row>
              <Field label="Registration no."><input value={regNo} onChange={e => setRegNo(e.target.value)} style={inp} /></Field>
              <Field label="Jurisdiction"><input value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} placeholder="e.g. UAE" style={inp} /></Field>
            </Row>
            <Row>
              <Field label="Representative name"><input value={representative} onChange={e => setRepresentative(e.target.value)} style={inp} /></Field>
              <Field label="Email"><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inp} /></Field>
            </Row>
            <Row>
              <Field label="Property (namkhan-bi property_id, optional)"><input value={propertyId} onChange={e => setPropertyId(e.target.value)} placeholder="e.g. 260955" style={inp} /></Field>
              <Field label="Property details"><input value={propertyDetails} onChange={e => setPropertyDetails(e.target.value)} placeholder="e.g. Luang Prabang, Laos" style={inp} /></Field>
            </Row>
          </Section>

          <Section title="Services" subtitle="Which service lines are in scope.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              <Check checked={svcAudit}      onChange={setSvcAudit}      label="Audit" />
              <Check checked={svcConsulting} onChange={setSvcConsulting} label="Consulting" />
              <Check checked={svcOutsourced} onChange={setSvcOutsourced} label="Outsourced rev-mgmt" />
              <Check checked={svcTraining}   onChange={setSvcTraining}   label="Training" />
              <Check checked={svcOta}        onChange={setSvcOta}        label="OTA management" />
            </div>
          </Section>

          <Section title="Commercial terms" subtitle="Only Fixed fee (USD) is required. Blanks stay blank on the PDF.">
            <Row>
              <Field label="Fixed fee (USD/month) *"><input value={fixedFee} onChange={e => setFixedFee(e.target.value)} type="number" style={inp} /></Field>
              <Field label="Bonus %"><input value={bonusPct} onChange={e => setBonusPct(e.target.value)} type="number" step="0.01" style={inp} /></Field>
            </Row>
            <Row>
              <Field label="Step-up fee (USD)"><input value={stepupFee} onChange={e => setStepupFee(e.target.value)} type="number" style={inp} /></Field>
              <Field label="Min bonus (USD)"><input value={minBonus} onChange={e => setMinBonus(e.target.value)} type="number" style={inp} /></Field>
            </Row>
            <Row>
              <Field label="Bonus cap (USD)"><input value={bonusCap} onChange={e => setBonusCap(e.target.value)} type="number" style={inp} /></Field>
              <Field label="Exclusivity scope">
                <select value={exclusivity} onChange={e => setExclusivity(e.target.value)} style={inp}>
                  <option value="similar">Similar properties only</option>
                  <option value="none">Non-exclusive</option>
                  <option value="strict">Strict / all revenue-mgmt</option>
                </select>
              </Field>
            </Row>
            <Field label="Net revenue definition (Schedule 1 §3)">
              <textarea value={netRevDef} onChange={e => setNetRevDef(e.target.value)} rows={2} style={{ ...inp, minHeight: 48 }} />
            </Field>
            <Field label="Beyond trade licence no."><input value={tradeLicence} onChange={e => setTradeLicence(e.target.value)} style={inp} /></Field>
          </Section>

          <Section title="Appendix A · Rate ladder" subtitle="Room-type min/max — up to 20 rows. Add or leave blank.">
            {rateRows.map((r, i) => (
              <Row key={i}>
                <Field label={`Room type ${i + 1}`}><input value={r.room_type} onChange={e => setRateRows(prev => prev.map((x, j) => j === i ? { ...x, room_type: e.target.value } : x))} style={inp} /></Field>
                <Field label="Min USD"><input value={r.min} onChange={e => setRateRows(prev => prev.map((x, j) => j === i ? { ...x, min: e.target.value } : x))} type="number" style={inp} /></Field>
                <Field label="Max USD"><input value={r.max} onChange={e => setRateRows(prev => prev.map((x, j) => j === i ? { ...x, max: e.target.value } : x))} type="number" style={inp} /></Field>
              </Row>
            ))}
            <button type="button" onClick={() => setRateRows(prev => [...prev, { room_type: '', min: '', max: '' }])} style={btnGhost}>+ add row</button>
          </Section>

          <Section title="Appendix A · OTA commissions" subtitle="Name + commission % — up to 12 rows.">
            {otaRows.map((o, i) => (
              <Row key={i}>
                <Field label={`OTA ${i + 1}`}><input value={o.name} onChange={e => setOtaRows(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Booking.com" style={inp} /></Field>
                <Field label="Commission %"><input value={o.commission_pct} onChange={e => setOtaRows(prev => prev.map((x, j) => j === i ? { ...x, commission_pct: e.target.value } : x))} type="number" step="0.01" style={inp} /></Field>
              </Row>
            ))}
            <button type="button" onClick={() => setOtaRows(prev => [...prev, { name: '', commission_pct: '' }])} style={btnGhost}>+ add row</button>
          </Section>

          <Section title="Appendix A · Channels & limits" subtitle="Fill only what applies.">
            <Row><Field label="Wholesale"><input value={chWholesale} onChange={e => setChWholesale(e.target.value)} style={inp} /></Field><Field label="IBE"><input value={chIbe} onChange={e => setChIbe(e.target.value)} style={inp} /></Field></Row>
            <Row><Field label="GDS"><input value={chGds} onChange={e => setChGds(e.target.value)} style={inp} /></Field><Field label="Corporate"><input value={chCorp} onChange={e => setChCorp(e.target.value)} style={inp} /></Field></Row>
            <Row><Field label="Channel manager"><input value={chCm} onChange={e => setChCm(e.target.value)} style={inp} /></Field><Field label="Max discount %"><input value={discountPct} onChange={e => setDiscountPct(e.target.value)} type="number" step="0.01" style={inp} /></Field></Row>
            <Row><Field label="Min LOS"><input value={minlos} onChange={e => setMinlos(e.target.value)} type="number" style={inp} /></Field><Field label="Approval hours"><input value={approvalHours} onChange={e => setApprovalHours(e.target.value)} type="number" style={inp} /></Field></Row>
            <Row><Field label="CTA / CTD rules"><input value={ctaCtd} onChange={e => setCtaCtd(e.target.value)} style={inp} /></Field><Field label="Stop-sell rules"><input value={stopSell} onChange={e => setStopSell(e.target.value)} style={inp} /></Field></Row>
          </Section>

          {error && (
            <div style={{ padding: '10px 14px', background: '#FFF3F1', border: '1px solid #B04A2F33', color: '#B04A2F', borderRadius: 6, marginBottom: 12, fontSize: 12 }}>
              {error}
              {/template not found/i.test(error) && (
                <div style={{ marginTop: 6, color: '#3A3A3A' }}>
                  Upload the PDF template to Storage bucket <code>contracts</code> at path <code>templates/Beyond_Service_Agreement_FILLABLE.pdf</code> and retry.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={submit} disabled={busy} style={btnPrimary}>{busy ? 'Creating…' : 'Create + generate signing links'}</button>
            <Link href="/holding/legal/contracts" style={{ ...btnGhost, padding: '10px 14px', textDecoration: 'none' }}>Cancel</Link>
          </div>
        </>
      )}
    </div>
  );
}

function Success({ r }: { r: CreateResp }) {
  const copy = (s: string) => { navigator.clipboard.writeText(s); };
  return (
    <div style={{ background: '#F0F7F2', border: '1px solid #084838', borderRadius: 6, padding: 24 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, color: '#084838' }}>Contract created — {r.code}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#3A3A3A' }}>
        Agreement id: <code>{r.agreement_id}</code>. Send the client link to the counterparty. Beyond signs from the detail page after the client submits.
      </p>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#5A5A5A' }}>Client signing link</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input readOnly value={r.client_sign_url ?? ''} style={{ ...inp, fontFamily: 'monospace' }} />
          <button type="button" onClick={() => copy(r.client_sign_url ?? '')} style={btnGhost}>Copy</button>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#5A5A5A' }}>Beyond signing link (internal)</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input readOnly value={r.beyond_sign_url ?? ''} style={{ ...inp, fontFamily: 'monospace' }} />
          <button type="button" onClick={() => copy(r.beyond_sign_url ?? '')} style={btnGhost}>Copy</button>
        </div>
      </div>
      <Link href="/holding/legal/contracts" style={{ ...btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Back to list</Link>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #E6DFCC', borderRadius: 6, background: '#FFFFFF', marginBottom: 14 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #E6DFCC', background: '#FAFAF7' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1B1B1B' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>{label}</span>
      {children}
    </label>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>;
}
function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 13, background: '#FFFFFF', color: '#1B1B1B', width: '100%' };
const btnPrimary: React.CSSProperties = { padding: '10px 16px', background: '#084838', color: '#FFFFFF', border: '1px solid #084838', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: '#FFFFFF', color: '#3A3A3A', border: '1px solid #E6DFCC', borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: 'pointer' };
