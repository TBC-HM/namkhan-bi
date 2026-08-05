// app/api/modules/briefs/goal/route.ts
// goal-editor-v1: GET loads current goal data; POST refines it.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_get_brief_goal_data', {
      p_brief_slug: slug,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { brief_slug, goal_text } = await req.json();
    if (!brief_slug || !goal_text) {
      return NextResponse.json(
        { error: 'brief_slug and goal_text required' },
        { status: 400 }
      );
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_refine_brief_goal', {
      p_brief_slug: brief_slug,
      p_goal_text: goal_text,
      p_by: 'PBS',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.ok === false) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
