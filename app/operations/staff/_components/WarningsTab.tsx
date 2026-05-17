// app/operations/staff/_components/WarningsTab.tsx
//
// PBS 2026-05-15: Warnings tab. Pick employee + 1-sentence incident → AI drafts
// a formal warning letter → POST /api/hr/warning-letter → lands in dms.documents
// (category='warning', metadata.employee_id) AND in Reports inbox (cockpit_tickets,
// source='agent_delivery', intent='warning_letter').
//
// System auto-proposals from attendance/clock-in patterns (last 30d) are
// stubbed — the panel renders empty until the attendance feed is wired.

'use client';

import Panel from '@/components/page/Panel';
import { useState, useTransition } from 'react';
import type { SeniorityBundle } from '@/lib/hr/seniority';

interface AutoProposal {
  employeeId: number;
  employeeName: string;
  pattern: string;
  evidence: string;
  severity: 'minor' | 'moderate' | 'serious';
}

export default function WarningsTab({
  propertyId, bundle, autoProposals = [],
}: {
  propertyId: number;
  bundle: SeniorityBundle;
  autoProposals?: AutoProposal[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [incident, setIncident] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'serious'>('moderate');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; ticket_id?: number } | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const isDonna = bundle.isDonna;
  const employee = bundle.rows.find((r) => r.id === selectedId);

  const submitWarning = (overrideId?: number, overrideText?: string, overrideSeverity?: 'minor' | 'moderate' | 'serious') => {
    const empId = overrideId ?? selectedId;
    const text  = overrideText ?? incident;
    const sev   = overrideSeverity ?? severity;
    const emp   = bundle.rows.find((r) => r.id === empId);
    if (!emp || !text.trim()) return;
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/hr/warning-letter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            employee_id: emp.id,
            employee_name: emp.full_name_en,
            position: emp.current_position_code,
            department: emp.current_dept_code,
            incident: text,
            severity: sev,
            jurisdiction: isDonna ? 'ES' : 'LA',
          }),
        });
        const j = await res.json();
        if (res.ok && j.ok) {
          setResult({ ok: true, message: `Warning issued for ${emp.full_name_en} — filed in docs + Reports inbox.`, ticket_id: j.ticket_id });
          setIncident('');
        } else {
          setResult({ ok: false, message: j.error || `HTTP ${res.status}` });
        }
      } catch (e) {
        setResult({ ok: false, message: e instanceof Error ? e.message : 'Network error' });
      }
    });
  };

  return (
    <>
      <Panel title="1 · Issue a warning" eyebrow="Pick employee · 1-sentence incident · AI drafts formal letter">
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--t-sm)' }}>
            <span style={labelStyle()}>Employee</span>
            <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)} style={inputStyle()}>
              <option value="">— select active employee —</option>
              {bundle.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name_en ?? `#${r.id}`} · {r.current_dept_code ?? '—'}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--t-sm)' }}>
            <span style={labelStyle()}>Severity</span>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} style={inputStyle()}>
              <option value="minor">Minor (verbal note → written)</option>
              <option value="moderate">Moderate (formal first written warning)</option>
              <option value="serious">Serious (final written · pre-dismissal)</option>
            </select>
          </label>
        </div>
        <div style={{ padding: '0 14px 14px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 'var(--t-sm)' }}>
            <span style={labelStyle()}>Incident · 1 sentence</span>
            <textarea
              value={incident}
              onChange={(e) => setIncident(e.target.value)}
              rows={2}
              placeholder={isDonna
                ? 'p.ej. "Llegó 35 min tarde al turno del lunes 12-mayo sin avisar a su HoD"'
                : 'e.g. "Arrived 35 min late on Monday 12 May without notifying their HoD"'}
              style={{ ...inputStyle(), width: '100%', resize: 'vertical' }}
            />
          </label>
          <button
            disabled={!employee || !incident.trim() || pending}
            onClick={() => submitWarning()}
            style={{
              marginTop: 12,
              padding: '10px 20px', fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
              letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase',
              background: 'var(--brass)', color: '#fff',
              border: 'none', borderRadius: 4, fontWeight: 700,
              cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? 'Issuing…' : 'Issue formal warning'}
          </button>
          {result && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: result.ok ? 'rgba(60, 130, 80, 0.08)' : 'rgba(178, 59, 59, 0.08)',
              border: `1px solid ${result.ok ? 'rgba(60, 130, 80, 0.3)' : 'rgba(178, 59, 59, 0.3)'}`,
              borderRadius: 4,
              color: result.ok ? '#3c8250' : '#B23B3B',
            }}>
              {result.message}
              {result.ticket_id && (
                <> · <a href={`/h/${propertyId}/inbox`} style={{ color: 'inherit', fontWeight: 600 }}>Open inbox →</a></>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="2 · System-proposed warnings · last 30 days"
        eyebrow="Pattern detection across attendance + clock-ins · accept → warning issued · dismiss → drop"
      >
        <div style={{ padding: 14, fontSize: 'var(--t-sm)' }}>
          {autoProposals.length === 0 ? (
            <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic' }}>
              No warning patterns surfaced for the last 30 days. The detector scans
              <code> hr.clock_ins </code> + <code>hr.leave_records</code> for late arrivals
              (≥10 min, ≥5×/month), no-shows (unscheduled absence), and missed-clock-out
              streaks. When the attendance feed is fully wired, suggestions appear here
              ready to accept or dismiss.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {autoProposals.filter((p) => !dismissedIds.has(p.employeeId)).map((p, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'var(--paper-warm)',
                  border: '1px solid var(--paper-deep)',
                  borderLeft: `3px solid ${p.severity === 'serious' ? 'var(--st-bad, #B23B3B)' : p.severity === 'moderate' ? 'var(--st-warn, #C28F2C)' : 'var(--brass)'}`,
                  borderRadius: 4,
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.employeeName} · {p.pattern}</div>
                    <div style={{ marginTop: 3, fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>{p.evidence}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => submitWarning(p.employeeId, p.evidence, p.severity)}
                      disabled={pending}
                      style={{
                        padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 11,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        background: 'var(--brass)', color: '#fff', border: 'none',
                        borderRadius: 4, cursor: pending ? 'wait' : 'pointer',
                      }}
                    >Accept</button>
                    <button
                      onClick={() => setDismissedIds(new Set([...dismissedIds, p.employeeId]))}
                      style={{
                        padding: '6px 12px', fontFamily: 'var(--mono)', fontSize: 11,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        background: 'transparent', color: 'var(--ink-mute)',
                        border: '1px solid var(--paper-deep)',
                        borderRadius: 4, cursor: 'pointer',
                      }}
                    >Dismiss</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </>
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
