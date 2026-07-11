// app/api/sales/leads/advance-stage/route.ts
// PBS 2026-07-11 pm — Sales CRM UI (ADR-147). Moves a lead across sales.pipeline_stages.
// Auto-flags stage='won' → status='converted' and stage='lost' → status='lost' to mirror
// fn_promote_lead's terminal states.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { lead_id: number; stage: string }

const STAGES = new Set(['new','contacted','engaged','qualified','proposal','negotiation','won','lost']);

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    const leadId = Number(b.lead_id);
    const stage = String(b.stage ?? '').trim().toLowerCase();
    if (!Number.isFinite(leadId) || leadId <= 0) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
    if (!STAGES.has(stage)) return NextResponse.json({ error: 'unknown stage ' + stage }, { status: 400 });

    const sb = getSupabaseAdmin();
    const patch: Record<string, unknown> = { stage, stage_changed_at: new Date().toISOString() };
    if (stage === 'won')  patch.status = 'converted';
    if (stage === 'lost') patch.status = 'lost';

    const { error } = await sb.schema('sales').from('leads').update(patch).eq('id', leadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, lead_id: leadId, stage });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
