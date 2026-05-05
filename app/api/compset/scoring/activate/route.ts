// POST /api/compset/scoring/activate
// Activates a draft scoring_config (or re-activates a retired one) by calling
// public.compset_activate_scoring_config(p_config_id, p_reason). The RPC is
// transactional — it deactivates the current active config and activates the
// chosen one in one shot, writing one audit row.
//
// Body: { config_id: uuid, reason: string (min 10 chars) }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'admin client unavailable' },
      { status: 500 },
    );
  }

  let body: { config_id?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const config_id = typeof body.config_id === 'string' ? body.config_id : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!UUID_RE.test(config_id)) {
    return NextResponse.json(
      { ok: false, error: 'config_id must be a UUID.' },
      { status: 400 },
    );
  }
  if (reason.length < 10) {
    return NextResponse.json(
      { ok: false, error: 'reason must be at least 10 characters.' },
      { status: 400 },
    );
  }

  const { data, error } = await admin.rpc('compset_activate_scoring_config', {
    p_config_id: config_id,
    p_reason: reason,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    config_id: data as string,
    activated_at: new Date().toISOString(),
  });
}
