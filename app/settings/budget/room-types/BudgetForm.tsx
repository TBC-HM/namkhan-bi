'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co"),
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "build-placeholder-anon"),
  { auth: { persistSession: false } }
);

interface Props {
  year: number;
  month: number;
  roomTypes: { room_type_id: number; room_type_name: string }[];
  existing: Record<number, number>;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BudgetForm({ year, month, roomTypes, existing }: Props) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(roomTypes.map((rt) => [rt.room_type_id, existing[rt.room_type_id]?.toString() ?? '']))
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const navigate = (newYear: number, newMonth: number) => {
    const url = `/settings/budget/room-types?year=${newYear}&month=${newMonth}`;
    window.location.href = url;
  };

  const save = async () => {
    setMsg(null);
    const errors: string[] = [];
    let saved = 0;
    for (const rt of roomTypes) {
      const raw = values[rt.room_type_id]?.trim();
      if (!raw) continue;
      const pct = Number(raw);
      if (!isFinite(pct) || pct < 0 || pct > 100) {
        errors.push(`${rt.room_type_name}: must be 0–100`);
        continue;
      }
      const { error } = await supabase.rpc('f_set_room_type_budget', {
        p_year: year,
        p_month: month,
        p_room_type_id: String(rt.room_type_id),
        p_occupancy_pct: pct,
      });
      if (error) errors.push(`${rt.room_type_name}: ${error.message}`);
      else saved++;
    }
    if (errors.length === 0) setMsg(`Saved ${saved} row${saved === 1 ? '' : 's'} for ${MONTHS[month - 1]} ${year}.`);
    else setMsg(`Saved ${saved} · errors: ${errors.join(' | ')}`);
    // Refresh
    setTimeout(() => window.location.reload(), saved > 0 ? 800 : 2000);
  };

  return (
    <div style={{ background: 'var(--paper-warm)', border: '1px solid var(--paper-deep)', borderRadius: 8, padding: '16px 20px', marginTop: 14 }}>
      {/* Year / Month picker */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: 'var(--ls-loose)' }}>Period</span>
        <select
          value={year}
          onChange={(e) => startTransition(() => navigate(Number(e.target.value), month))}
          style={{ padding: '6px 10px', border: '1px solid var(--line-soft)', borderRadius: 4, background: 'var(--paper-pure, #fff)', fontSize: 'var(--t-base)' }}
        >
          {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={month}
          onChange={(e) => startTransition(() => navigate(year, Number(e.target.value)))}
          style={{ padding: '6px 10px', border: '1px solid var(--line-soft)', borderRadius: 4, background: 'var(--paper-pure, #fff)', fontSize: 'var(--t-base)' }}
        >
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-base)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--paper-deep)' }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 'var(--t-xs)', color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>Room type</th>
            <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 'var(--t-xs)', color: 'var(--brass)', letterSpacing: 'var(--ls-extra)', textTransform: 'uppercase', fontFamily: 'var(--mono)', width: 180 }}>Budget occupancy %</th>
          </tr>
        </thead>
        <tbody>
          {roomTypes.map((rt) => (
            <tr key={rt.room_type_id} style={{ borderTop: '1px solid var(--paper-warm)' }}>
              <td style={{ padding: '8px 10px', fontWeight: 500 }}>{rt.room_type_name}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="—"
                  value={values[rt.room_type_id] ?? ''}
                  onChange={(e) => setValues({ ...values, [rt.room_type_id]: e.target.value })}
                  style={{
                    width: 120,
                    padding: '6px 10px',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 4,
                    fontSize: 'var(--t-base)',
                    fontFamily: 'var(--mono)',
                    textAlign: 'right',
                    background: 'var(--paper-pure, #fff)',
                  }}
                />
                <span style={{ marginLeft: 6, color: 'var(--ink-mute)' }}>%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{
            padding: '10px 18px',
            background: 'var(--moss)',
            color: 'var(--paper-warm)',
            border: 'none',
            borderRadius: 4,
            fontSize: 'var(--t-base)',
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.6 : 1,
            fontFamily: 'var(--sans)',
          }}
        >
          {pending ? 'Saving…' : `Save ${MONTHS[month - 1]} ${year}`}
        </button>
        {msg && <span style={{ fontSize: 'var(--t-sm)', color: msg.includes('error') ? 'var(--st-bad-tx, #c5391d)' : 'var(--moss)' }}>{msg}</span>}
      </div>
    </div>
  );
}
