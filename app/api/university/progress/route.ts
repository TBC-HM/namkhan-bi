// app/api/university/progress/route.ts
// TBC University · Learn layer progress API.
// GET  ?path=<slug>  → path, items (quiz answers already stripped by the bridge
//                      view), and the current user's progress rows.
// POST {action:'complete', item_id}            → mark an article item done.
// POST {action:'quiz', item_id, answers:[int]} → grade server-side
//                      (public.fn_university_quiz_submit — correct answers
//                      never reach the client before submission).
// Identity = session-scope email (workspace cookie). Legacy open mode has no
// email; we fall back to 'guest' so the checklist still works — the supervisor
// view shows those rows as "guest" (agent-class decision, ADR-186).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionScope } from '@/lib/session-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function userEmail(): Promise<string> {
  try {
    const scope = await getSessionScope();
    return (scope.email ?? '').toLowerCase() || 'guest';
  } catch {
    return 'guest';
  }
}

export async function GET(req: NextRequest) {
  const pathSlug = (req.nextUrl.searchParams.get('path') ?? '').trim().toLowerCase();
  if (!pathSlug) return NextResponse.json({ ok: false, error: 'path required' }, { status: 400 });

  try {
    const sb = getSupabaseAdmin();
    const email = await userEmail();
    const [pathRes, itemsRes, progRes] = await Promise.all([
      sb.from('v_university_paths').select('*').eq('slug', pathSlug).maybeSingle(),
      sb.from('v_university_path_items').select('*').eq('path_slug', pathSlug).order('sort_order'),
      sb.from('v_university_user_progress').select('*').eq('path_slug', pathSlug).eq('user_email', email),
    ]);
    if (!pathRes.data) return NextResponse.json({ ok: false, error: 'path not found' }, { status: 404 });
    return NextResponse.json({
      ok: true,
      email,
      path: pathRes.data,
      items: itemsRes.data ?? [],
      progress: progRes.data ?? [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'load failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string; item_id?: number; answers?: number[];
  };
  const itemId = Number(body.item_id);
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ ok: false, error: 'item_id required' }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const email = await userEmail();
    if (body.action === 'quiz') {
      const { data, error } = await sb.rpc('fn_university_quiz_submit', {
        p: { email, item_id: itemId, answers: Array.isArray(body.answers) ? body.answers : [] },
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data);
    }
    const { data, error } = await sb.rpc('fn_university_progress_mark', {
      p: { email, item_id: itemId },
    });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'save failed' }, { status: 500 });
  }
}
