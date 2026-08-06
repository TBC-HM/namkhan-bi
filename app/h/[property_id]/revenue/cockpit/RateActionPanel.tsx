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

async function post(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; result?: { ok?: boolean; message?: string; blocked_by?: string } }> {
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

export interface RateActionRow {
  id: number;
  property_id: number;
  stay_date_start: string;
  stay_date_end: string;
  current_rate: number | null;
  proposed_rate: number;
  rationale: string | null;
  guardrail_check_result: Array<{ rule?: string; result?: string; delta?: number }> | null;
  status: 'proposed' | 'approved' | 'rejected' | 'executed';
  proposed_by: string;
  created_at: string;
}

// ─── Action queue (Approve / Reject / Mark executed) ──────────────────────

export function ActionQueue({ rows }: { rows: RateActionRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

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
        const requiresPbs = (r.guardrail_check_result ?? []).some((c) => c.result === 'requires_pbs');
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
              </span>
            </div>
            {r.rationale && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.rationale}</p>
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
              </div>
            )}
            {r.status === 'approved' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--status-green, #2E7D32)', fontWeight: 600 }}>
                  Approved — set the rate in Cloudbeds, then log it:
                </span>
                <button style={btn} disabled={busyId === r.id} onClick={() => act(r.id, 'execute')}>
                  Mark executed
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Propose form ─────────────────────────────────────────────────────────

export function ProposeForm({
  propertyId,
  prefill,
}: {
  propertyId: number;
  // G4 (brief revenue-module-v1): forecast scenario → rate action handoff.
  // The cockpit page parses ?propose_rate/&scenario_id/... query params and
  // passes them here so the form opens pre-filled; the rationale carries the
  // scenario id + run date, which is the back-link of the two-way tie.
  prefill?: { proposed?: string; rationale?: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(prefill));
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [current, setCurrent] = useState('');
  const [proposed, setProposed] = useState(prefill?.proposed ?? '');
  const [why, setWhy] = useState(prefill?.rationale ?? '');
  const [state, setState] = useState<'idle' | 'busy' | 'error' | 'blocked'>('idle');
  const [msg, setMsg] = useState('');

  if (!open) {
    return (
      <button style={btn} onClick={() => setOpen(true)}>
        Propose rate action
      </button>
    );
  }

  const submit = () => {
    if (!start || !end || !proposed) return;
    setState('busy');
    void post({
      op: 'propose',
      property_id: propertyId,
      stay_start: start,
      stay_end: end,
      current_rate: current ? Number(current) : undefined,
      proposed_rate: Number(proposed),
      rationale: why.trim() || undefined,
      actor: 'pbs',
    }).then((res) => {
      if (res.error) {
        setState('error');
        setMsg(res.error);
      } else if (res.result && res.result.ok === false) {
        setState('blocked');
        setMsg(res.result.message ?? `blocked by guardrail ${res.result.blocked_by ?? ''}`);
      } else {
        setState('idle');
        setMsg('');
        setOpen(false);
        setWhy('');
        setProposed('');
        router.refresh();
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={inp} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <input style={inp} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        <input
          style={{ ...inp, width: 110 }}
          type="number"
          placeholder="current $"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <input
          style={{ ...inp, width: 110 }}
          type="number"
          placeholder="proposed $"
          value={proposed}
          onChange={(e) => setProposed(e.target.value)}
        />
      </div>
      <input
        style={inp}
        placeholder="rationale — what pressure/opportunity is this responding to?"
        value={why}
        onChange={(e) => setWhy(e.target.value)}
      />
      {(state === 'error' || state === 'blocked') && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>{msg}</p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} disabled={state === 'busy'} onClick={submit}>
          {state === 'busy' ? 'Checking guardrails…' : 'Propose'}
        </button>
        <button style={btn} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Findings button (rule 729) ───────────────────────────────────────────

export function FindingButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');

  const submit = () => {
    if (text.trim().length < 5) return;
    setState('busy');
    void post({ op: 'finding', finding: text.trim(), severity }).then((res) => {
      if (res.error) setState('error');
      else {
        setState('sent');
        setText('');
      }
    });
  };

  if (!open) {
    return (
      <button style={btn} onClick={() => { setOpen(true); setState('idle'); }}>
        Report finding
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
      <textarea
        style={{ ...inp, minHeight: 60, resize: 'vertical' }}
        placeholder="What is wrong or missing on this page?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          style={inp}
          value={severity}
          onChange={(e) => setSeverity(e.target.value as 'low' | 'medium' | 'high')}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <button style={btnPrimary} disabled={state === 'busy'} onClick={submit}>
          {state === 'busy' ? 'Sending…' : 'File finding'}
        </button>
        <button style={btn} onClick={() => setOpen(false)}>
          Close
        </button>
        {state === 'sent' && (
          <span style={{ fontSize: 12, color: 'var(--status-green, #2E7D32)' }}>Filed ✓</span>
        )}
        {state === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>Failed — retry</span>
        )}
      </div>
    </div>
  );
}
