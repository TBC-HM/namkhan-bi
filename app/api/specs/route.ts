// app/api/specs/route.ts — POST: save a spec questionnaire as a build_brief
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { slug, title, content_md, tags, status } = await req.json();
    if (!slug || !title || !content_md) {
      return NextResponse.json({ error: 'slug, title, content_md required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.schema('documentation').from('build_briefs').insert({
      slug, title, content_md,
      tags: tags ?? ['spec'],
      status: status ?? 'ready',
      target_repo: 'TBC-HM/namkhan-bi',
      target_branch: 'main',
      last_updated_by: 'spec-builder-ui',
    }).select('slug, title').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
