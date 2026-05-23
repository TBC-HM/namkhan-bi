'use client';

// app/revenue/_components/HodTasksList.tsx
// Editable HoD task list — PBS note#4: "I can add my own tasks and delete".
// CRUD against public.hod_tasks via @supabase/supabase-js client.

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Task {
  id: number;
  label: string;
  done: boolean;
}

interface Props {
  deptSlug?: string;
  propertyId: number;
  initial?: Task[];
}

export default function HodTasksList({ deptSlug = 'revenue', propertyId, initial = [] }: Props) {
  const sb = createClient();
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await sb.from('hod_tasks')
        .select('id, label, done')
        .eq('dept_slug', deptSlug)
        .eq('property_id', propertyId)
        .order('done')
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
        .select('id, label, done')
        .maybeSingle();
      if (data) setTasks((prev) => [data as Task, ...prev]);
      setDraft('');
    });
  };

  const toggle = (id: number, next: boolean) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: next } : t));
    startTransition(async () => {
      await sb.from('hod_tasks').update({ done: next }).eq('id', id);
    });
  };

  const remove = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      await sb.from('hod_tasks').delete().eq('id', id);
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
          {tasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <input type="checkbox" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} />
              <span style={{
                flex: 1, fontSize: 12,
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? 'var(--ink-soft, #5A5A5A)' : 'var(--ink, #1B1B1B)',
              }}>{t.label}</span>
              <button type="button" onClick={() => remove(t.id)}
                aria-label="Delete task"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--ink-soft, #5A5A5A)', padding: '0 4px',
                  fontFamily: 'inherit',
                }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
