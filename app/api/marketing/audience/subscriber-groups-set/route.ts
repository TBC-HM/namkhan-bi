// app/api/marketing/audience/subscriber-groups-set/route.ts
// PBS 2026-07-21 · Per-row group editor save endpoint.
// POST { subscriber_id: number, group_ids: string[] } — deletes existing
// memberships for the subscriber and reinserts the picked set atomically
// via the SECURITY DEFINER RPC public.fn_subscriber_groups_set(bigint, uuid[]).
// Auth: mirrors sibling routes (getCurrentAuthUser → 401 on miss).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  subscriber_id?: number | string;
  group_ids?: string[];
}

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  let body: Body = {};
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const sidRaw = body.subscriber_id;
  const sid = typeof sidRaw === 'string' ? Number(sidRaw) : sidRaw;
  if (!Number.isFinite(sid)) {
    return NextResponse.json({ ok: false, error: 'invalid_subscriber_id' }, { status: 400 });
  }

  const gids = Array.isArray(body.group_ids) ? body.group_ids.filter((s) => typeof s === 'string' && s.length > 0) : [];

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }

  const { data, error } = await admin.rpc('fn_subscriber_groups_set', {
    p_subscriber_id: sid,
    p_group_ids: gids,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });

  const res = data as { ok?: boolean; error?: string; deleted?: number; inserted?: number };
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'save_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, deleted: res.deleted ?? 0, inserted: res.inserted ?? 0 });
}
