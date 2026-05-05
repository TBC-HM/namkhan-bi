'use client';

// app/marketing/compiler/[run_id]/_components/OfferConfigForm.tsx
// v1.4 — visible state machine, always-clickable when valid, loud errors,
// "last action" status line so the operator sees what happened.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface RoomType { room_type_id: number; room_type_name: string; max_guests: number | null; quantity: number | null; }
interface RatePlan { rate_id: number; rate_name: string; }

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; msg: string }
  | { kind: 'ok'; msg: string }
  | { kind: 'err'; msg: string };

export default function OfferConfigForm({
  runId,
  initial,
}: {
  runId: string;
  initial?: { window_from?: string; window_to?: string; room_type_ids?: number[]; rate_plan_id?: number };
}) {
  const router = useRouter();
  const [opts, setOpts] = useState<{ roomTypes: RoomType[]; ratePlans: RatePlan[]; defaultRatePlanId: number } | null>(null);
  const [windowFrom, setWindowFrom] = useState(initial?.window_from ?? '2026-05-01');
  const [windowTo, setWindowTo] = useState(initial?.window_to ?? '2026-09-30');
  const [roomIds, setRoomIds] = useState<number[]>(initial?.room_type_ids ?? []);
  const [ratePlanId, setRatePlanId] = useState<number>(initial?.rate_plan_id ?? 0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    setStatus({ kind: 'busy', msg: 'Loading rate plans + room types…' });
    fetch('/api/compiler/options')
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error ?? 'options fetch failed');
        setOpts(j);
        if (!ratePlanId) setRatePlanId(j.defaultRatePlanId);
        setStatus({ kind: 'idle' });
      })
      .catch(e => setStatus({ kind: 'err', msg: `Options failed · ${e.message ?? e}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRoom = (id: number) => {
    setRoomIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const valid = roomIds.length > 0 && !!ratePlanId && !!windowFrom && !!windowTo;

  const submit = async () => {
    if (!valid) {
      setStatus({ kind: 'err', msg: 'Pick at least one room before building.' });
      return;
    }
    setStatus({ kind: 'busy', msg: `Pulling median rates for ${roomIds.length} room(s) × ${windowFrom}→${windowTo}…` });
    try {
      const res = await fetch(`/api/compiler/runs/${runId}/offer`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          window_from: windowFrom, window_to: windowTo,
          room_type_ids: roomIds, rate_plan_id: ratePlanId,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setStatus({ kind: 'ok', msg: `Built ${j.count} variant${j.count === 1 ? '' : 's'} · refreshing…` });
      router.refresh();
    } catch (e: any) {
      setStatus({ kind: 'err', msg: `Build failed · ${e?.message ?? String(e)}` });
    }
  };

  if (!opts && status.kind !== 'err') {
    return (
      <div style={wrap}>
        <div style={statusRow('busy')}>{status.kind === 'busy' ? status.msg : 'Loading options…'}</div>
      </div>
    );
  }

  const buttonReady = valid && status.kind !== 'busy';

  return (
    <div style={wrap}>
      <div style={row}>
        <span className="t-eyebrow" style={{ marginRight: 4 }}>WINDOW</span>
        <input type="date" value={windowFrom} onChange={e => setWindowFrom(e.target.value)} style={dateInput} />
        <span style={dim}>→</span>
        <input type="date" value={windowTo} onChange={e => setWindowTo(e.target.value)} style={dateInput} />

        <span className="t-eyebrow" style={{ marginLeft: 14, marginRight: 4 }}>RATE PLAN</span>
        <select value={ratePlanId} onChange={e => setRatePlanId(Number(e.target.value))} style={selectInput}>
          {opts?.ratePlans.map(p => (
            <option key={p.rate_id} value={p.rate_id}>{p.rate_name}</option>
          ))}
        </select>

        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={submit}
          aria-disabled={!buttonReady}
          style={{
            ...button,
            background: buttonReady ? 'var(--moss)' : 'var(--paper-deep)',
            color: buttonReady ? 'var(--paper)' : 'var(--ink-mute)',
            cursor: buttonReady ? 'pointer' : 'not-allowed',
            border: buttonReady ? '1px solid var(--moss)' : '1px solid var(--paper-deep)',
            opacity: status.kind === 'busy' ? 0.7 : 1,
          }}
        >
          {status.kind === 'busy' ? 'Building…' : `Build ${roomIds.length || ''} variant${roomIds.length === 1 ? '' : 's'}`.trim()}
        </button>
      </div>

      <div style={row2}>
        <span className="t-eyebrow" style={{ marginRight: 4 }}>ROOMS</span>
        {opts?.roomTypes.map(rt => {
          const on = roomIds.includes(rt.room_type_id);
          return (
            <button
              key={rt.room_type_id} type="button" onClick={() => toggleRoom(rt.room_type_id)}
              style={{
                ...roomPill,
                background: on ? 'var(--moss)' : 'var(--paper)',
                color: on ? 'var(--paper)' : 'var(--ink)',
                borderColor: on ? 'var(--moss)' : 'var(--paper-deep)',
              }}
              title={`${rt.room_type_name} · max ${rt.max_guests} · ${rt.quantity} units`}
            >
              {rt.room_type_name}
              <span style={{ ...roomPillMeta, color: on ? 'var(--brass-soft, #d4b46d)' : 'var(--ink-mute)' }}>
                ·{rt.max_guests}p
              </span>
            </button>
          );
        })}
      </div>

      {status.kind !== 'idle' && (
        <div style={statusRow(status.kind)}>{status.msg}</div>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 6,
  marginTop: 12,
  overflow: 'hidden',
};
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px',
  borderBottom: '1px solid var(--paper-deep)',
  flexWrap: 'wrap',
};
const row2: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 12px',
  flexWrap: 'wrap',
};
const dim: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)', color: 'var(--ink-mute)',
};
const dateInput: React.CSSProperties = {
  padding: '4px 8px', fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
  background: 'var(--paper)', border: '1px solid var(--paper-deep)',
  borderRadius: 3, color: 'var(--ink)',
};
const selectInput: React.CSSProperties = {
  padding: '4px 8px', fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
  background: 'var(--paper)', border: '1px solid var(--paper-deep)',
  borderRadius: 3, color: 'var(--ink)',
  maxWidth: 220,
};
const button: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 4,
  fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
  textTransform: 'uppercase', letterSpacing: 'var(--ls-extra)', fontWeight: 600,
};
const roomPill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px',
  border: '1px solid var(--paper-deep)',
  borderRadius: 3,
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  cursor: 'pointer',
};
const roomPillMeta: React.CSSProperties = { fontSize: 10 };

function statusRow(kind: Status['kind']): React.CSSProperties {
  const colors: Record<typeof kind, { bg: string; bd: string; fg: string }> = {
    idle:  { bg: 'transparent',                    bd: 'var(--paper-deep)',         fg: 'var(--ink-mute)' },
    busy:  { bg: 'var(--paper)',                   bd: 'var(--paper-deep)',         fg: 'var(--ink-soft)' },
    ok:    { bg: 'var(--st-good-bg, #e8f0e6)',     bd: 'var(--st-good, #4a7a4d)',   fg: 'var(--st-good, #2d5a30)' },
    err:   { bg: 'var(--st-bad-bg, #f5e7e0)',      bd: 'var(--st-bad, #b65f4a)',    fg: 'var(--st-bad, #b65f4a)' },
  } as any;
  const c = colors[kind];
  return {
    padding: '8px 12px',
    fontSize: 'var(--t-xs)', fontFamily: 'var(--mono)',
    background: c.bg, color: c.fg,
    borderTop: `1px solid ${c.bd}`,
    letterSpacing: 'var(--ls-loose)',
  };
}
