'use client';

// app/revenue/_components/BugsList.tsx
// HoD Bugs widget: + button to add, then renders the bug list. PBS #166.
//
// v2 PBS 2026-07-27 (Mai Vou flow) — this is the staff-facing bug surface:
//   - Add now POSTs to /api/cockpit/bugs (server captures WHO reported from
//     the session; the old direct insert wrote status:'open' which the DB
//     CHECK rejects → every + Add failed SILENTLY, and created_by was
//     hardcoded 'pbs').
//   - Status pills: reported → being fixed → ❓ needs your answer → ✓ fixed.
//   - Recently-fixed section (14 days) so the reporter SEES resolution
//     without ever leaving her dashboard.
//   - Vocabulary fixed: wont_fix (DB) not wontfix.

import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Bug {
  id: number;
  body: string | null;
  status: string | null;
  created_at: string | null;
  page_url: string | null;
  created_by: string | null;
  done_at: string | null;
  fix_label: string | null;
  open_question: { question?: string } | null;
}

interface Props {
  deptSlug?: string;
  propertyId: number;
  initial?: Bug[];
}

const SELECT = 'id, body, status, created_at, page_url, created_by, done_at, fix_label, open_question';

function pill(b: Bug): { label: string; bg: string; fg: string } {
  if (b.open_question) return { label: '❓ needs your answer', bg: '#FBF3D9', fg: '#7a5500' };
  if (b.status === 'done') return { label: '✓ fixed', bg: '#EAF1EE', fg: '#084838' };
  if (b.status === 'processing') return { label: 'being fixed', bg: '#EAF1EE', fg: '#084838' };
  if (b.status === 'acked') return { label: 'in queue', bg: '#F0EAD8', fg: '#B48A3A' };
  return { label: 'reported', bg: '#FDECE4', fg: '#8A2A1D' };
}

export default function BugsList({ deptSlug = 'revenue', propertyId, initial = [] }: Props) {
  const sb = createClient();
  const [bugs, setBugs] = useState<Bug[]>(initial);
  const [fixed, setFixed] = useState<Bug[]>([]);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = async () => {
    const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
    const [open, done] = await Promise.all([
      sb.from('cockpit_bugs').select(SELECT)
        .eq('dept_slug', deptSlug).eq('property_id', String(propertyId))
        .in('status', ['new', 'acked', 'processing'])
        .order('created_at', { ascending: false }).limit(20),
      sb.from('cockpit_bugs').select(SELECT)
        .eq('dept_slug', deptSlug).eq('property_id', String(propertyId))
        .eq('status', 'done').gte('done_at', cutoff)
        .order('done_at', { ascending: false }).limit(5),
    ]);
    if (open.data) setBugs(open.data as Bug[]);
    if (done.data) setFixed(done.data as Bug[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await load(); })();
    const iv = setInterval(load, 60_000); // keep the box live — status moves without reload
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptSlug, propertyId]);

  const add = () => {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await fetch('/api/cockpit/bugs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dept: deptSlug,
          body,
          property_id: String(propertyId),
          page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (r.ok) {
        setDraft('');
        setMsg('Reported ✓ — it enters the repair queue automatically; watch its status here.');
        await load();
      } else {
        const j = await r.json().catch(() => ({} as { error?: string }));
        setMsg(`Report FAILED: ${j.error ?? r.status} — nothing was saved.`);
      }
      setTimeout(() => setMsg(null), 6000);
    });
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }}
            style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Report a bug… (what you expected vs what you see)"
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
      {msg && (
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: msg.includes('FAILED') ? '#8A2A1D' : '#084838' }}>{msg}</div>
      )}
      {bugs.length === 0 && fixed.length === 0 ? (
        <div style={{ padding: 8, fontSize: 12, color: 'var(--ink-soft, #5A5A5A)', fontStyle: 'italic' }}>
          no open bugs
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bugs.map((b) => {
            const p = pill(b);
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                  background: p.bg, color: p.fg, whiteSpace: 'nowrap', flexShrink: 0,
                }}>{p.label}</span>
                <span style={{ flex: 1, color: 'var(--ink, #1B1B1B)' }}>{String(b.body ?? '').slice(0, 80)}</span>
                {b.created_by && (
                  <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)', whiteSpace: 'nowrap' }}>
                    {String(b.created_by).split('(')[0].split('@')[0].trim()}
                  </span>
                )}
              </div>
            );
          })}
          {fixed.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', margin: '8px 0 2px' }}>
                Recently fixed
              </div>
              {fixed.map((b) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12, opacity: 0.85 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#EAF1EE', color: '#084838', whiteSpace: 'nowrap', flexShrink: 0 }}>✓ fixed</span>
                  <span style={{ flex: 1, color: 'var(--ink, #1B1B1B)', textDecoration: 'none' }}>{String(b.body ?? '').slice(0, 70)}</span>
                  {b.fix_label && <span style={{ fontSize: 10, color: 'var(--ink-soft, #5A5A5A)' }}>{b.fix_label.slice(0, 30)}</span>}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
