// app/cockpit/team/page.tsx
// Cockpit · Team — live list of every agent identity in cockpit_agent_identity.
// Server component, reads Supabase directly (no API route required).

import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

type Agent = {
  role: string;
  display_name: string | null;
  avatar: string | null;
  tagline: string | null;
  color: string | null;
  dept: string | null;
  status: string | null;
  hierarchy_level: number | null;
  reports_to: string | null;
  created_at: string;
};

export default async function CockpitTeamPage() {
  const { data, error } = await supabase
    .from('cockpit_agent_identity')
    .select('role, display_name, avatar, tagline, color, dept, status, hierarchy_level, reports_to, created_at')
    .order('hierarchy_level', { ascending: true, nullsFirst: false })
    .order('dept', { ascending: true, nullsFirst: false })
    .order('role', { ascending: true });

  const agents = (data ?? []) as Agent[];

  // Group by dept for display
  const byDept = agents.reduce<Record<string, Agent[]>>((acc, a) => {
    const k = a.dept ?? 'unassigned';
    (acc[k] ||= []).push(a);
    return acc;
  }, {});

  const totalActive = agents.filter((a) => a.status !== 'archived' && a.status !== 'dormant').length;
  const totalDormant = agents.filter((a) => a.status === 'dormant').length;

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-8">
      <header className="mb-8 flex items-end justify-between border-b border-stone-300 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">Cockpit · Team</p>
          <h1 className="mt-1 font-serif text-3xl text-stone-900">
            Agent roster <em className="font-serif italic text-amber-700">live</em>
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {agents.length} agents · {totalActive} active · {totalDormant} dormant ·
            source: <code className="font-mono text-xs text-stone-500">public.cockpit_agent_identity</code>
          </p>
        </div>
        <Link href="/cockpit" className="text-sm text-stone-600 hover:text-stone-900">
          ← back to cockpit
        </Link>
      </header>

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Error loading team: {error.message}
        </div>
      )}

      {agents.length === 0 && !error && (
        <div className="rounded border border-stone-300 bg-white p-8 text-center text-stone-500">
          No agents registered yet. Add rows to <code>cockpit_agent_identity</code> to see them here.
        </div>
      )}

      {Object.entries(byDept).map(([dept, list]) => (
        <section key={dept} className="mb-10">
          <h2 className="mb-3 text-xs uppercase tracking-[0.18em] text-stone-500">
            {dept} <span className="text-stone-400">· {list.length}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => (
              <div
                key={a.role}
                className="flex items-start gap-3 rounded border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-serif text-lg text-white"
                  style={{ backgroundColor: a.color ?? '#78716c' }}
                >
                  {a.avatar ?? (a.display_name ?? a.role)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-serif text-base text-stone-900">
                      {a.display_name ?? a.role}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        a.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : a.status === 'dormant'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {a.status ?? 'unknown'}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-stone-500">{a.role}</p>
                  {a.tagline && (
                    <p className="mt-1 text-sm italic text-stone-600">{a.tagline}</p>
                  )}
                  {a.reports_to && (
                    <p className="mt-1 text-[11px] text-stone-400">reports to · {a.reports_to}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
