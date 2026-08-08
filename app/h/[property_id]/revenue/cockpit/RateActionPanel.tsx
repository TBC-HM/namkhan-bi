'use client';
// app/h/[property_id]/revenue/cockpit/RateActionPanel.tsx
// Client interaction layer for the Revenue Cockpit (brief revenue-module-v1):
//   · ActionQueue — Approve / Reject on proposed rate actions (PBS gate;
//     nothing auto-executes). 'Mark executed' logs the MANUAL Cloudbeds
//     change (v1 never writes to the PMS — that is its own future ADR).
//   · ProposeForm — PBS/agent proposes a rate action; the server fn
//     validates against public.guardrails BEFORE insert (guardrail > goal).
//   · FindingButton — owner findings channel into governance.module_findings
//     (rule 729), module 'revenue'.
// Hydration-safe: no Date.now()/toLocale* in render; dates arrive as ISO
// strings and are sliced (§0.55/§0.60 family).

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const btn: React.CSSProperties = {
  border: '1px solid var(--hairline, #E6DFCC)',
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  background: 'var(--primary, #1F3A2E)',
  color: 'var(--paper, #FFFFFF)',
  border: '1px solid var(--primary, #1F3A2E)',
};
const btnDanger: React.CSSProperties = {
  ...btn,
  color: 'var(--terracotta, #B8542A)',
  border: '1px solid var(--terracotta, #B8542A)',
};
const inp: React.CSSProperties = {
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12.5,
  color: 'var(--ink, #1B1B1B)',
  background: 'var(--paper, #FFFFFF)',
};

async function post(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; result?: { ok?: boolean; message?: string; blocked_by?: string; guardrail_check_result?: unknown } }> {
  try {
    const res = await fetch('/api/revenue/rate-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok?: boolean; error?: string };
  } catch (e) {
    return { error: String(e) };
  }
}

interface GuardrailCheckResult {
  blocks?: Array<{ rule_key: string; threshold_kind: string; threshold_val: number; observed: number | null; message: string }>;
  warnings?: Array<{ rule_key: string; threshold_kind: string; threshold_val: number; observed: number | null; message: string }>;
  unknown?: string[];
}

// Legacy format (rate_change_gt_50_needs_pbs)
interface LegacyCheck {
  rule?: string;
  result?: string;
  delta?: number;
}

export interface RateActionRow {
  id: number;
  property_id: number;
  stay_date_start: string;
  stay_date_end: string;
  current_rate: number | null;
  proposed_rate: number;
  rationale: string | null;
  guardrail_check_result: GuardrailCheckResult | LegacyCheck[] | null;
  status: 'proposed' | 'approved' | 'rejected' | 'executed';
  proposed_by: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseGuardrailResult(raw: GuardrailCheckResult | LegacyCheck[] | null): {
  warnings: Array<{ rule_key: string; message: string }>;
  requiresPbs: boolean;
} {
  if (raw == null) return { warnings: [], requiresPbs: false };

  // New structure: {blocks, warnings, unknown}
  if (typeof raw === 'object' && !Array.isArray(raw) && 'warnings' in raw) {
    const gcr = raw as GuardrailCheckResult;
    return {
      warnings: (gcr.warnings ?? []).map((w) => ({ rule_key: w.rule_key, message: w.message })),
      requiresPbs: false, // Legacy PBS check is separate now
    };
  }

  // Legacy array structure
  if (Array.isArray(raw)) {
    const requiresPbs = raw.some((c) => c.result === 'requires_pbs');
    return { warnings: [], requiresPbs };
  }

  return { warnings: [], requiresPbs: false };
}

// ─── Action queue (Approve / Reject / Mark executed) ──────────────────────

export function ActionQueue({ rows }: { rows: RateActionRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [showWarningsFor, setShowWarningsFor] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 12.5, fontStyle: 'italic' }}>
        No actions proposed — forecast confident. Run a what-if on the{' '}
        <a href="forecast" style={{ color: 'var(--primary, #1F3A2E)' }}>forecast page</a>{' '}
        to pressure-test rates.
      </p>
    );
  }

  const act = (id: number, decision: 'approve' | 'reject' | 'execute') => {
    setBusyId(id);
    setErr(null);
    void post({ op: 'decide', id, decision, note: note.trim() || undefined, actor: 'pbs' }).then((res) => {
      setBusyId(null);
      const failure = res.error ?? (res.result && res.result.ok === false ? res.result.message ?? 'refused' : null);
      if (failure) setErr(`#${id}: ${failure}`);
      else {
        setNoteFor(null);
        setNote('');
        setShowWarningsFor(null);
        router.refresh();
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {err && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>{err}</p>
      )}
      {rows.map((r) => {
        const { warnings, requiresPbs } = parseGuardrailResult(r.guardrail_check_result);
        const hasWarnings = warnings.length > 0;
        const showWarnings = showWarningsFor === r.id;

        return (
          <div
            key={r.id}
            style={{
              border: '1px solid var(--hairline, #E6DFCC)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {r.stay_date_start.slice(0, 10)} → {r.stay_date_end.slice(0, 10)} ·{' '}
                {r.current_rate != null ? `$${r.current_rate} → ` : ''}${r.proposed_rate}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                by {r.proposed_by}
                {requiresPbs ? ' · Δ>$50 — needs PBS' : ''}
                {hasWarnings && r.status === 'proposed' ? ` · ⚠ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : ''}
              </span>
            </div>
            {r.rationale && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.rationale}</p>
            )}
            
            {/* Warning display for proposed actions */}
            {hasWarnings && r.status === 'proposed' && (
              <div style={{ marginTop: 4 }}>
                <button
                  style={{ ...btn, fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setShowWarningsFor(showWarnings ? null : r.id)}
                >
                  {showWarnings ? 'Hide warnings' : 'Show warnings'}
                </button>
                {showWarnings && (
                  <div style={{ marginTop: 6, padding: 8, background: 'rgba(184, 84, 42, 0.05)', borderRadius: 6 }}>
                    {warnings.map((w, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: 'var(--terracotta, #B8542A)', marginBottom: idx < warnings.length - 1 ? 4 : 0 }}>
                        <strong>{w.rule_key}:</strong> {w.message}
                      </div>
                    ))}
                    <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                      Warnings do not block approval — guardrail beats goal, but proceed with awareness.
                    </p>
                  </div>
                )}
              </div>
            )}

            {r.status === 'proposed' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {noteFor === r.id && (
                  <input
                    style={{ ...inp, flex: 1, minWidth: 160 }}
                    placeholder="decision note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                )}
                <button
                  style={btnPrimary}
                  disabled={busyId === r.id}
                  onClick={() => (noteFor === r.id ? act(r.id, 'approve') : setNoteFor(r.id))}
                >
                  {noteFor === r.id ? 'Confirm approve' : 'Approve'}
                </button>
                <button style={btnDanger} disabled={busyId === r.id} onClick={() => act(r.id, 'reject')}>
                  Reject
                </button>
                {noteFor === r.id && (
                  <button style={btn} onClick={() => { setNoteFor(null); setNote(''); }}>
                    Cancel
                  </button>
                )}
              </div>
            )}
            {r.status === 'approved' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--status-green, #2E7D32)', fontWeight: 600 }}>✓ Approved</span>
                <button style={btn} disabled={busyId === r.id} onClick={() => act(r.id, 'execute')}>
                  Mark executed
                </button>
              </div>
            )}
            {r.status === 'rejected' && (
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>⊗ Rejected</span>
            )}
            {r.status === 'executed' && (
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>→ Executed (manual in PMS)</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Propose form ─────────────────────────────────────────────────────────

export function ProposeForm({ propertyId, prefill }: { propertyId: number; prefill?: { proposed: string; rationale: string } }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy'>('idle');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [current, setCurrent] = useState('');
  const [proposed, setProposed] = useState(prefill?.proposed ?? '');
  const [rationale, setRationale] = useState(prefill?.rationale ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cur = current.trim() === '' ? null : Number(current);
    const prop = Number(proposed);
    if (!start || !end || !Number.isFinite(prop) || prop <= 0) {
      setMsg('All fields required (current rate is optional)');
      return;
    }
    setState('busy');
    setMsg(null);
    void post({
      op: 'propose',
      property_id: propertyId,
      stay_start: start,
      stay_end: end,
      current_rate: cur,
      proposed_rate: prop,
      rationale: rationale.trim() || 'Manual propose from Rate Desk',
      proposed_by: 'pbs',
    }).then((res) => {
      setState('idle');
      if (res.error) {
        setMsg(res.error);
      } else if (res.result && res.result.ok === false) {
        // Blocked by guardrail
        setMsg(res.result.message ?? `blocked by guardrail ${res.result.blocked_by ?? ''}`);
      } else {
        // Success — check for warnings
        const gcr = res.result?.guardrail_check_result as GuardrailCheckResult | undefined;
        const warnings = gcr?.warnings ?? [];
        if (warnings.length > 0) {
          setMsg(`✓ Proposed (with ${warnings.length} warning${warnings.length > 1 ? 's' : ''} — see action queue below)`);
        } else {
          setMsg('✓ Proposed successfully');
        }
        setStart('');
        setEnd('');
        setCurrent('');
        setProposed('');
        setRationale('');
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <input
          style={inp}
          type="date"
          placeholder="Stay start"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
        <input
          style={inp}
          type="date"
          placeholder="Stay end"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
        />
        <input
          style={inp}
          type="number"
          placeholder="Current rate (optional)"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          style={inp}
          type="number"
          placeholder="Proposed rate *"
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
          required
        />
      </div>
      <textarea
        style={{ ...inp, minHeight: 60, fontFamily: 'inherit', resize: 'vertical' }}
        placeholder="Rationale (why this rate for these dates?)"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" style={btnPrimary} disabled={state === 'busy'}>
          {state === 'busy' ? 'Checking guardrails…' : 'Propose'}
        </button>
        {msg && (
          <span style={{ fontSize: 12, color: msg.startsWith('✓') ? 'var(--status-green, #2E7D32)' : 'var(--terracotta, #B8542A)' }}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}

// ─── Finding button ───────────────────────────────────────────────────────

export function FindingButton({ propertyId }: { propertyId: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 10) {
      setMsg('Finding must be at least 10 characters');
      return;
    }
    setBusy(true);
    setMsg(null);
    void post({
      op: 'finding',
      property_id: propertyId,
      finding: note.trim(),
      category: 'rate_desk',
    }).then((res) => {
      setBusy(false);
      if (res.error || (res.result && res.result.ok === false)) {
        setMsg(res.error ?? res.result?.message ?? 'Failed to submit finding');
      } else {
        setMsg('✓ Finding submitted');
        setNote('');
        setTimeout(() => {
          setOpen(false);
          setMsg(null);
          router.refresh();
        }, 1500);
      }
    });
  };

  if (!open) {
    return (
      <button style={btn} onClick={() => setOpen(true)}>
        + Report a revenue finding
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea
        style={{ ...inp, minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
        placeholder="Describe the revenue finding (gap, anomaly, opportunity…)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="submit" style={btnPrimary} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit finding'}
        </button>
        <button type="button" style={btn} onClick={() => { setOpen(false); setNote(''); setMsg(null); }}>
          Cancel
        </button>
        {msg && (
          <span style={{ fontSize: 12, color: msg.startsWith('✓') ? 'var(--status-green, #2E7D32)' : 'var(--terracotta, #B8542A)' }}>
            {msg}
          </span>
        )}
      </div>
    </form>
  );
}
