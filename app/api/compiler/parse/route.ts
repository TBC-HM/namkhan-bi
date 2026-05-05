// app/api/compiler/parse/route.ts
// POST { prompt } -> creates a compiler.runs row, returns { runId, parsed }
import { NextRequest, NextResponse } from 'next/server';
import { parsePrompt } from '@/lib/compiler/parse';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt: string = String(body.prompt ?? '').trim();
    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

    const parsed = parsePrompt(prompt);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .schema('compiler')
      .from('runs')
      .insert({
        prompt,
        parsed_spec: parsed,
        status: 'draft',
        property_id: 'namkhan',
        cost_eur: 0,
        model: 'regex-mvp',
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ runId: data!.id, parsed, warnings: parsed.warnings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
