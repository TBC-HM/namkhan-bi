// app/api/cockpit/skills-for-role/route.ts
// Thin wrapper around the cockpit_agent_skills_for_role RPC. Used by the
// Skills tab to lazy-load skill rows when an agent panel is expanded.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { role?: string };
  try {
    body = (await req.json()) as { role?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }
  const role = body.role?.trim();
  if (!role) {
    return new Response(JSON.stringify({ error: 'role required' }), { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('cockpit_agent_skills_for_role', { p_role: role });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data ?? []), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
