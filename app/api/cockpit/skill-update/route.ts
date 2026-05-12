// app/api/cockpit/skill-update/route.ts
// Wraps cockpit_skill_update RPC. The RPC validates inputs (e.g. unknown
// KPI slugs return 400), audits the change, and returns id+name+updated_at.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UpdateBody {
  skill_id: number;
  description?: string | null;
  category?: string | null;
  serves_kpis?: string[] | null;
  notes?: string | null;
  cost_class?: string | null;
  authority_level?: string | null;
  active?: boolean | null;
  estimated_cost_milli?: number | null;
  archived_reason?: string | null;
}

export async function POST(req: Request) {
  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }
  if (!body.skill_id || typeof body.skill_id !== 'number') {
    return new Response(JSON.stringify({ error: 'skill_id required' }), { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('cockpit_skill_update', {
    p_skill_id: body.skill_id,
    p_description: body.description ?? null,
    p_category: body.category ?? null,
    p_serves_kpis: body.serves_kpis ?? null,
    p_notes: body.notes ?? null,
    p_cost_class: body.cost_class ?? null,
    p_authority_level: body.authority_level ?? null,
    p_active: body.active ?? null,
    p_estimated_cost_milli: body.estimated_cost_milli ?? null,
    p_archived_reason: body.archived_reason ?? null,
  });

  if (error) {
    // Pass through the RPC's status hint when present (e.g. 400 invalid KPI slug)
    const status = /invalid|not found|unknown/i.test(error.message) ? 400 : 500;
    return new Response(JSON.stringify({ error: error.message }), { status });
  }
  return new Response(JSON.stringify(data ?? null), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
