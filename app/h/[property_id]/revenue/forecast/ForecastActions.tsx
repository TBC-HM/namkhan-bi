'use client';
// app/h/[property_id]/revenue/forecast/ForecastActions.tsx
// Client-side interaction layer for the Forecasting page (v1.1, findings 7-8):
//   · RecommendationList — accept / dismiss / mark-executed on engine
//     recommendations (MD success metric: acceptance + success rate).
//   · ScenarioPanel — run seeded what-if scenarios on demand ("what if rate
//     +8%?"). Deterministic recompute server-side; nothing here executes a
//     price, inventory or channel change (recommend-never-execute, BINDING).
//   · FindingButton — owner findings channel straight into
//     governance.module_findings (rule 729).
// Hydration-safe: no Date.now()/toLocale* in render (§0.55/§0.60 family);
// dates arrive as ISO strings and are sliced.

import { useState, useTransition } from 'react';
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

async function post(body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/forecast/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok?: boolean; error?: string };
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── Recommendations ──────────────────────────────────────────────────────

export interface RecommendationRow {
  id: number;
  run_date: string;
  action: string;
  rationale: string | null;
  status: 'proposed' | 'accepted' | 'dismissed' | 'executed';
  acted_by: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'var(--status-grey, #8A8A8A)',
  accepted: 'var(--status-green, #2E7D32)',
  executed: 'var(--status-green, #2E7D32)',
  dismissed: 'var(--terracotta, #B8542A)',
};

export function RecommendationList({ rows }: { rows: RecommendationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 12.5, fontStyle: 'italic' }}>
        No recommendations yet — the nightly Insight agent proposes commercial responses after each
        run. Recommendations are options only; nothing executes without a human.
      </p>
    );
  }

  const act = (id: number, status: RecommendationRow['status']) => {
    setBusyId(id);
    void post({ op: 'recommendation', recommendation_id: id, status }).then(() => {
      setBusyId(null);
      startTransition(() => router.refresh());
    });
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'grid',
            gap: 4,
            padding: '8px 10px',
            border: '1px solid var(--hairline, #E6DFCC)',
            borderRadius: 8,
            background: 'var(--paper, #FFFFFF)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status] }}>
              {r.status.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' }}>run {r.run_date.slice(0, 10)}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink, #1B1B1B)', lineHeight: 1.5 }}>{r.action}</p>
          {r.rationale ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', lineHeight: 1.5 }}>{r.rationale}</p>
          ) : null}
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            {r.status === 'proposed' ? (
              <>
                <button style={btnPrimary} disabled={busyId === r.id || pending} onClick={() => act(r.id, 'accepted')}>
                  Accept
                </button>
                <button style={btn} disabled={busyId === r.id || pending} onClick={() => act(r.id, 'dismissed')}>
                  Dismiss
                </button>
              </>
            ) : null}
            {r.status === 'accepted' ? (
              <button style={btnPrimary} disabled={busyId === r.id || pending} onClick={() => act(r.id, 'executed')}>
                Mark executed
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Scenario panel ───────────────────────────────────────────────────────

export interface ScenarioDef {
  id: number;
  scenario_kind: string;
  title: string;
  description: string | null;
}

export function ScenarioRunButtons({ propertyId, scenarios }: { propertyId: number; scenarios: ScenarioDef[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = (id: number) => {
    setBusyId(id);
    setErr(null);
    void post({ op: 'run_scenario', property_id: propertyId, scenario_id: id }).then((res) => {
      setBusyId(null);
      if (res.error) setErr(res.error);
      else startTransition(() => router.refresh());
    });
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {scenarios.map((s) => (
          <button key={s.id} style={btn} disabled={busyId !== null || pending} onClick={() => run(s.id)} title={s.description ?? ''}>
            {busyId === s.id ? 'Running…' : `Re-run: ${s.title}`}
          </button>
        ))}
      </div>
      {err ? <p style={{ margin: 0, fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>{err}</p> : null}
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-soft, #5A5A5A)' }}>
        Runs are deterministic recomputes over the current statistical forecast — simulations only,
        never a price or inventory change.
      </p>
    </div>
  );
}

// ─── Findings button ──────────────────────────────────────────────────────

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
    <div style={{ display: 'grid', gap: 6, minWidth: 260 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What is wrong or missing on this page?"
        style={{
          border: '1px solid var(--hairline, #E6DFCC)',
          borderRadius: 6,
          padding: 8,
          fontSize: 12.5,
          fontFamily: 'inherit',
          color: 'var(--ink, #1B1B1B)',
          background: 'var(--paper, #FFFFFF)',
        }}
      />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as 'low' | 'medium' | 'high')}
          style={{ ...btn, padding: '4px 6px' }}
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
        {state === 'sent' ? <span style={{ fontSize: 12, color: 'var(--status-green, #2E7D32)' }}>Filed ✓</span> : null}
        {state === 'error' ? <span style={{ fontSize: 12, color: 'var(--terracotta, #B8542A)' }}>Failed — retry</span> : null}
      </div>
    </div>
  );
}
