// app/operations/staff/_components/OnboardingContractAndCheckPanel.tsx
//
// PBS 2026-05-15: Replaces the disabled grey "Generate contract PDF" placeholder
// at the bottom of OnboardingTabContent. Two stages:
//   1. Lince pre-check — HR clicks "Run Lince background check" → /api/hr/lince-precheck
//      → ticket files to Carla's queue · returns verdict GREEN/YELLOW/RED
//   2. Contract generator — only enabled after a verdict comes back · picks
//      contract type from Vera's 4 templates · personalises via /api/hr/contract-letter
//      → contract lands in Reports inbox + dms.documents

'use client';

import Panel from '@/components/page/Panel';
import { useState, useTransition } from 'react';

type ContractType =
  | 'hr_contract_indefinido'
  | 'hr_contract_eventual'
  | 'hr_contract_fijo_discontinuo'
  | 'hr_contract_autonomo';

const CONTRACT_OPTIONS: { value: ContractType; label: string; hint: string }[] = [
  { value: 'hr_contract_indefinido',       label: 'Indefinido (long-term)',           hint: 'ET Art. 15.1 · canonical' },
  { value: 'hr_contract_fijo_discontinuo', label: 'Fijo-discontinuo (seasonal)',      hint: 'ET Art. 16 · preferred for seasonal hires post-2022' },
  { value: 'hr_contract_eventual',         label: 'Eventual 9-meses (temporal)',      hint: 'ET Art. 15.2 · 12d/yr indemnización' },
  { value: 'hr_contract_autonomo',         label: 'Autónomo (mercantil · NOT laboral)', hint: 'Cód. Civil 1544 · only for genuine self-employed' },
];

export default function OnboardingContractAndCheckPanel({ propertyId }: { propertyId: number }) {
  // Candidate input fields
  const [fullName, setFullName] = useState('');
  const [nif, setNif] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [nationality, setNationality] = useState('ES');
  const [minorContact, setMinorContact] = useState(false);
  const [salarioAnual, setSalarioAnual] = useState('');
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [contractType, setContractType] = useState<ContractType>('hr_contract_indefinido');

  // Workflow state
  const [precheckPending, startPrecheck] = useTransition();
  const [precheckResult, setPrecheckResult] = useState<null | {
    ok: boolean;
    verdict?: 'GREEN' | 'YELLOW' | 'RED';
    ticket_id?: number;
    verdict_notes?: string;
    checklist?: { skill: string; status: string; reason?: string }[];
    error?: string;
  }>(null);

  const [contractPending, startContract] = useTransition();
  const [contractResult, setContractResult] = useState<null | {
    ok: boolean;
    ticket_id?: number;
    dms_doc_id?: string;
    contract_chars?: number;
    error?: string;
  }>(null);

  const [hrOverride, setHrOverride] = useState('');

  const minimalForCheck = fullName.trim().length > 0;
  const minimalForContract = fullName.trim().length > 0 && position && salarioAnual;
  const checkPassed = precheckResult?.ok && (precheckResult.verdict === 'GREEN' || (precheckResult.verdict === 'YELLOW' && hrOverride.trim().length > 10));
  const contractEnabled = checkPassed && minimalForContract;

  const runPrecheck = () => {
    setPrecheckResult(null);
    startPrecheck(async () => {
      try {
        const res = await fetch('/api/hr/lince-precheck', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            candidate: {
              full_name: fullName,
              nif: nif || undefined,
              nationality,
              claimed_position: position,
              minor_contact_role: minorContact,
            },
          }),
        });
        const j = await res.json();
        if (res.ok && j.ok) {
          setPrecheckResult({ ok: true, verdict: j.verdict, ticket_id: j.ticket_id, verdict_notes: j.verdict_notes, checklist: j.checklist });
        } else {
          setPrecheckResult({ ok: false, error: j.error || `HTTP ${res.status}` });
        }
      } catch (e) {
        setPrecheckResult({ ok: false, error: e instanceof Error ? e.message : 'Network error' });
      }
    });
  };

  const generateContract = () => {
    setContractResult(null);
    startContract(async () => {
      try {
        const res = await fetch('/api/hr/contract-letter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            contract_type: contractType,
            candidate: {
              trabajador_nombre: fullName,
              trabajador_nif: nif,
              categoria: position,
              departamento: department,
              trabajador_nacionalidad: nationality,
              salario_anual: salarioAnual,
              fecha_inicio: fechaInicio,
              fecha_firma: new Date().toISOString().slice(0, 10),
              lugar_firma: 'Mallorca',
              empresa_cif: '[CIF Donna]',
              empresa_representante: '[Apoderado Donna]',
              empresa_domicilio: '[Domicilio Donna]',
              precheck_ticket_id: precheckResult?.ticket_id ?? null,
              precheck_verdict: precheckResult?.verdict ?? null,
              hr_override_reasoning: hrOverride || null,
            },
          }),
        });
        const j = await res.json();
        if (res.ok && j.ok) {
          setContractResult({ ok: true, ticket_id: j.ticket_id, dms_doc_id: j.dms_doc_id, contract_chars: j.contract_chars });
        } else {
          setContractResult({ ok: false, error: j.error || `HTTP ${res.status}` });
        }
      } catch (e) {
        setContractResult({ ok: false, error: e instanceof Error ? e.message : 'Network error' });
      }
    });
  };

  return (
    <>
      <Panel title="A · Candidate data" eyebrow="Minimum fields needed for Lince check + contract generator">
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="Nombre completo *" value={fullName} onChange={setFullName} />
          <Field label="DNI / NIE" value={nif} onChange={setNif} />
          <Field label="Puesto / Categoría *" value={position} onChange={setPosition} />
          <Field label="Departamento" value={department} onChange={setDepartment} />
          <Field label="Nacionalidad" value={nationality} onChange={setNationality} />
          <Field label="Salario bruto anual (€) *" value={salarioAnual} onChange={setSalarioAnual} type="number" />
          <Field label="Fecha inicio" value={fechaInicio} onChange={setFechaInicio} type="date" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--t-sm)' }}>
            <input type="checkbox" checked={minorContact} onChange={(e) => setMinorContact(e.target.checked)} />
            <span style={labelStyle()}>Minor-contact role (kids-club, kitchen apprentices…)</span>
          </label>
        </div>
      </Panel>

      <Panel
        title="B · Lince pre-contract background check"
        eyebrow="Required before contract can be generated · MVP files a ticket to Carla's queue · paid integrations pending API keys"
      >
        <div style={{ padding: 14, fontSize: 'var(--t-sm)' }}>
          <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>
            Lince builds a checklist (OSINT / Onfido / vida laboral / antecedentes penales / eInforma if HoD-level / HireRight if non-EU) and files a ticket to the legal-team queue. Until paid integrations are wired, Lince returns verdict <strong>YELLOW</strong> by default — HR must document override reasoning to proceed.
          </p>
          <button
            disabled={!minimalForCheck || precheckPending}
            onClick={runPrecheck}
            style={primaryButton(precheckPending)}
          >
            {precheckPending ? 'Running Lince check…' : 'Run Lince background check'}
          </button>

          {precheckResult && precheckResult.ok && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                padding: '10px 12px',
                background: precheckResult.verdict === 'GREEN' ? 'rgba(60,130,80,0.10)' : precheckResult.verdict === 'YELLOW' ? 'rgba(194,143,44,0.10)' : 'rgba(178,59,59,0.10)',
                border: `1px solid ${precheckResult.verdict === 'GREEN' ? 'rgba(60,130,80,0.4)' : precheckResult.verdict === 'YELLOW' ? 'rgba(194,143,44,0.4)' : 'rgba(178,59,59,0.4)'}`,
                borderRadius: 4,
              }}>
                <strong>Verdict: {precheckResult.verdict}</strong> · ticket #{precheckResult.ticket_id}
                <div style={{ marginTop: 6, color: 'var(--ink-soft)' }}>{precheckResult.verdict_notes}</div>
                {precheckResult.checklist && (
                  <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
                    {precheckResult.checklist.map((c, i) => (
                      <li key={i}><code>{c.skill}</code> · {c.status}{c.reason ? ` · ${c.reason}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
              {precheckResult.verdict === 'YELLOW' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, fontSize: 'var(--t-sm)' }}>
                  <span style={labelStyle()}>HR override reasoning (≥10 chars to enable contract)</span>
                  <textarea
                    value={hrOverride}
                    onChange={(e) => setHrOverride(e.target.value)}
                    rows={2}
                    placeholder="e.g. Internal referral by Mira; identity confirmed in person on 2026-05-14."
                    style={{ ...inputStyle(), width: '100%', resize: 'vertical' }}
                  />
                </label>
              )}
            </div>
          )}
          {precheckResult && !precheckResult.ok && (
            <div style={errorBox()}>{precheckResult.error}</div>
          )}
        </div>
      </Panel>

      <Panel
        title="C · Generate contract PDF (Vera template)"
        eyebrow={contractEnabled ? 'Pick template · personalise · file in Reports inbox' : 'Locked until Lince verdict is GREEN or YELLOW with HR override'}
      >
        <div style={{ padding: 14, fontSize: 'var(--t-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={labelStyle()}>Contract type</span>
              <select value={contractType} onChange={(e) => setContractType(e.target.value as ContractType)} style={inputStyle()}>
                {CONTRACT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-mute)' }}>
                {CONTRACT_OPTIONS.find((o) => o.value === contractType)?.hint}
              </span>
            </label>
          </div>
          <button
            disabled={!contractEnabled || contractPending}
            onClick={generateContract}
            style={{ ...primaryButton(contractPending), marginTop: 14 }}
            title={!checkPassed ? 'Run Lince check first (GREEN or YELLOW with override)' : !minimalForContract ? 'Fill candidate name + position + salary first' : ''}
          >
            {contractPending ? 'Generating contract…' : 'Generate contract PDF'}
          </button>

          {contractResult && contractResult.ok && (
            <div style={{
              marginTop: 14,
              padding: '10px 12px',
              background: 'rgba(60,130,80,0.10)',
              border: '1px solid rgba(60,130,80,0.4)',
              borderRadius: 4,
            }}>
              ✓ Contract drafted ({contractResult.contract_chars} chars). Filed to Reports inbox · ticket #{contractResult.ticket_id}.{' '}
              <a href={`/h/${propertyId}/inbox`} style={{ color: 'inherit', fontWeight: 600 }}>Open inbox →</a>
              {contractResult.dms_doc_id && (
                <> · dms.documents row <code>{contractResult.dms_doc_id}</code></>
              )}
            </div>
          )}
          {contractResult && !contractResult.ok && <div style={errorBox()}>{contractResult.error}</div>}
        </div>
      </Panel>
    </>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--t-sm)' }}>
      <span style={labelStyle()}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle()} />
    </label>
  );
}

function labelStyle(): React.CSSProperties {
  return {
    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
    color: 'var(--ink-mute)',
  };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: '6px 10px', border: '1px solid var(--rule)',
    borderRadius: 4, font: 'inherit', background: 'var(--paper)',
    color: 'var(--ink)',
  };
}

function primaryButton(pending: boolean): React.CSSProperties {
  return {
    padding: '10px 20px',
    fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
    background: 'var(--brass)', color: '#fff',
    border: 'none', borderRadius: 4, fontWeight: 700,
    cursor: pending ? 'wait' : 'pointer',
    opacity: pending ? 0.7 : 1,
  };
}

function errorBox(): React.CSSProperties {
  return {
    marginTop: 14, padding: '10px 12px',
    background: 'rgba(178,59,59,0.08)', border: '1px solid rgba(178,59,59,0.3)',
    borderRadius: 4, color: '#B23B3B',
  };
}
