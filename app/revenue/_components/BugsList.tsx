'use client';

// app/revenue/_components/BugsList.tsx
// HoD Bugs widget: + button to add (writes to public.cockpit_bugs),
// then renders the open bug list. Mirrors HodTasksList shape. PBS #166.

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Bug {
  id: number;
  body: string | null;
  status: string | null;
  created_at: string | null;
  page_url: string | null;
}

interface Props {
  deptSlug?: string;
  propertyId: number;
  initial?: Bug[];
}

export default function BugsList({ deptSlug = 'revenue', propertyId, initial = [] }: Props) {
  const sb = createClient();
  const [bugs, setBugs] = useState<Bug[]>(initial);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await sb.from('cockpit_bugs')
        .select('id, body, status, created_at, page_url')
        .eq('dept_slug', deptSlug)
        .eq('property_id', String(propertyId))
        .not('status', 'in', '(closed,resolved,wontfix,done)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled && data) setBugs(data as Bug[]);
    })();
    return () => { cancelled = true; };
  }, [sb, deptSlug, propertyId]);

  const add = () => {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const pageUrl = typeof window !== 'undefined' ? window.location.pathname : '(HoD)';
      const { data } = await sb.from('cockpit_bugs')
        .insert({
          dept_slug: deptSlug,
          property_id: String(propertyId),
          body,
          status: 'open',
          page_url: pageUrl,
          created_by: 'pbs',
        })
        .select('id, body, status, created_at, page_url')
        .maybeSingle();
      if (data) setBugs((prev) => [data as Bug, ...prev]);
      setDraft('');
    });
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }}
            style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Report a bug…"
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
            background: '#8A2A1D', color: '#FFFFFF',
            border: '1px solid #8A2A1D', borderRadius: 4,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ Add</button>
      </form>
      {bugs.length === 0 ? (
        <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          no open bugs
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bugs.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#8A2A1D',
                flex: '0 0 8px',
              }} aria-hidden />
              <span style={{ flex: 1, color: 'var(--ink, #1B1B1B)' }}>{String(b.body ?? '').slice(0, 80)}</span>
              {b.page_url && (
                <span style={{
                  fontSize: 10, color: 'var(--ink-soft, #5A5A5A)',
                  padding: '1px 6px', border: '1px solid var(--hairline, #E6DFCC)', borderRadius: 99,
                }}>{String(b.page_url).replace(/^https?:\/\/[^\/]+/, '')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
