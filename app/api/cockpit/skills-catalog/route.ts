// app/api/cockpit/skills-catalog/route.ts
// Wraps cockpit_skills_catalog RPC. Returns one row per skill with kpi_details,
// attached_to_agents, calls_7d, cost_usd_7d.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: { category?: string; search?: string; include_archived?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('cockpit_skills_catalog', {
    p_category: body.category ?? null,
    p_search: body.search ?? null,
    p_include_archived: body.include_archived ?? false,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data ?? []), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
