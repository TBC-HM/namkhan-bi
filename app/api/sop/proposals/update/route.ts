// app/api/sop/proposals/update/route.ts
// PBS 2026-07-11: Edit a proposal's title / purpose / priority / tags in place.
//
// POST { id: number, title?: string, purpose_short?: string, priority?: 1|2|3, tags?: string[] }
//   → { ok, row }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  id?: number | string;
  title?: string;
  purpose_short?: string;
  priority?: number;
  tags?: string[];
}

export async function POST(req: Request) {
  try {
    const b = await req.json() as Body;
    const id = Number(b.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof b.title === 'string' && b.title.trim())        patch.title = b.title.trim();
    if (typeof b.purpose_short === 'string')                  patch.purpose_short = b.purpose_short.trim();
    if (Number.isFinite(b.priority) && (b.priority as number) >= 1 && (b.priority as number) <= 3) {
      patch.priority = b.priority;
    }
    if (Array.isArray(b.tags))                                patch.tags = b.tags.map((t) => String(t).trim()).filter(Boolean);

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ error: 'no valid fields provided' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .schema('knowledge')
      .from('sop_proposals')
      .update(patch)
      .eq('id', id)
      .select('id, dept_code, title, purpose_short, priority, tags, status, linked_sop_code')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, row: data });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
