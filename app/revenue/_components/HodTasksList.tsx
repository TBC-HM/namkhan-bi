'use client';

// app/revenue/_components/HodTasksList.tsx
// Editable HoD task list — PBS #164 expanded:
//   • due date · remind X days before · recurring (daily/weekly/monthly/yearly)
//   • red badge on row when remind threshold reached, darker red when overdue
// CRUD against public.hod_tasks via @supabase/supabase-js client.

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

type Recurring = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;

interface Task {
  id: number;
  label: string;
  done: boolean;
  due_date: string | null;
  remind_before_days: number | null;
  recurring: Recurring;
}

interface Props {
  deptSlug?: string;
  propertyId: number;
  initial?: Task[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function reminderState(t: Task): 'overdue' | 'due' | 'none' {
  if (t.done || !t.due_date) return 'none';
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const due = new Date(t.due_date + 'T00:00:00Z');
  const remind = new Date(due); remind.setUTCDate(due.getUTCDate() - (t.remind_before_days ?? 0));
  if (due < today) return 'overdue';
  if (remind <= today) return 'due';
  return 'none';
}

export default function HodTasksList({ deptSlug = 'revenue', propertyId, initial = [] }: Props) {
  const sb = createClient();
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await sb.from('hod_tasks')
        .select('id, label, done, due_date, remind_before_days, recurring')
        .eq('dept_slug', deptSlug)
        .eq('property_id', propertyId)
        .order('done')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled && data) setTasks(data as Task[]);
    })();
    return () => { cancelled = true; };
  }, [sb, deptSlug, propertyId]);

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    startTransition(async () => {
      const { data } = await sb.from('hod_tasks')
        .insert({ dept_slug: deptSlug, property_id: propertyId, label, done: false })
        .select('id, label, done, due_date, remind_before_days, recurring')
        .maybeSingle();
      if (data) setTasks((prev) => [data as Task, ...prev]);
      setDraft('');
    });
  };

  const patch = (id: number, fields: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...fields } : t));
    startTransition(async () => {
      await sb.from('hod_tasks').update(fields).eq('id', id);
    });
  };

  const toggle = (id: number, next: boolean) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    // Recurring: ticking done resets the due_date by the recurrence interval.
    if (next && t.recurring && t.due_date) {
      const due = new Date(t.due_date + 'T00:00:00Z');
      const step = t.recurring;
      if (step === 'daily')   due.setUTCDate(due.getUTCDate() + 1);
      if (step === 'weekly')  due.setUTCDate(due.getUTCDate() + 7);
      if (step === 'monthly') due.setUTCMonth(due.getUTCMonth() + 1);
      if (step === 'yearly')  due.setUTCFullYear(due.getUTCFullYear() + 1);
      patch(id, { done: false, due_date: iso(due) });
      return;
    }
    patch(id, { done: next });
  };

  const remove = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await sb.from('hod_tasks').delete().eq('id', id);
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }}
            style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          disabled={isPending}
          style={{
            flex: 1, padding: '6px 10px', fontSize: 12,
            border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 4,
            background: 'var(--paper, #FFFFFF)', color: 'var(--ink, #1B1B1B)',
            fontFamily: 'inherit',
          }}
        />
        <button type="submit" disabled={isPending || draft.trim().length === 0}
          style={{
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'var(--primary, #1F3A2E)', color: '#FFFFFF',
            border: '1px solid var(--primary, #1F3A2E)', borderRadius: 4,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Add</button>
      </form>
      {tasks.length === 0 ? (
        <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          no tasks yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tasks.map((t) => {
            const state = reminderState(t);
            const dot = state === 'overdue' ? '#8A2A1D' : state === 'due' ? '#C0584C' : 'transparent';
            const isOpen = expanded.has(t.id);
            return (
              <div key={t.id} style={{ borderBottom: '1px solid var(--hairline, #E6DFCC)', paddingBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <input type="checkbox" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} />
                  {state !== 'none' && (
                    <span aria-label={state} style={{
                      width: 8, height: 8, borderRadius: '50%', background: dot,
                      flex: '0 0 8px',
                      boxShadow: state === 'overdue' ? '0 0 0 2px rgba(138,42,29,0.25)' : 'none',
                    }} />
                  )}
                  <span style={{
                    flex: 1, fontSize: 12,
                    textDecoration: t.done ? 'line-through' : 'none',
                    color: t.done ? 'var(--ink-soft, #5A5A5A)' : 'var(--ink, #1B1B1B)',
                  }}>{t.label}</span>
                  {t.due_date && (
                    <span style={{
                      fontSize: 10, color: state === 'overdue' ? '#8A2A1D' : 'var(--ink-soft, #5A5A5A)',
                      fontWeight: state !== 'none' ? 600 : 400,
                    }}>{t.due_date}{t.recurring ? ` ↻${t.recurring[0]}` : ''}</span>
                  )}
                  <button type="button" onClick={() => toggleExpand(t.id)} aria-label="Configure"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: 'var(--ink-soft, #5A5A5A)', padding: '0 4px',
                      fontFamily: 'inherit',
                    }}>{isOpen ? '▾' : '▸'}</button>
                  <button type="button" onClick={() => remove(t.id)}
                    aria-label="Delete task"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 14, color: 'var(--ink-soft, #5A5A5A)', padding: '0 4px',
                      fontFamily: 'inherit',
                    }}>×</button>
                </div>
                {isOpen && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 24px 8px', fontSize: 11, alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>due</span>
                      <input type="date"
                        value={t.due_date ?? ''}
                        onChange={(e) => patch(t.id, { due_date: e.target.value || null })}
                        style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 3 }}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>remind</span>
                      <input type="number" min={0} max={365}
                        value={t.remind_before_days ?? ''}
                        onChange={(e) => patch(t.id, { remind_before_days: e.target.value === '' ? null : Number(e.target.value) })}
                        style={{ width: 50, fontSize: 11, padding: '2px 4px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 3 }}
                      />
                      <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>d before</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--ink-soft, #5A5A5A)' }}>repeat</span>
                      <select
                        value={t.recurring ?? ''}
                        onChange={(e) => patch(t.id, { recurring: (e.target.value || null) as Recurring })}
                        style={{ fontSize: 11, padding: '2px 4px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 3 }}
                      >
                        <option value="">never</option>
                        <option value="daily">daily</option>
                        <option value="weekly">weekly</option>
                        <option value="monthly">monthly</option>
                        <option value="yearly">yearly</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
