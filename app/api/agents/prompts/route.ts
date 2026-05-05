// app/api/agents/prompts/route.ts
// GET    /api/agents/prompts                  — list all prompts (DB + fs)
// GET    /api/agents/prompts?key=<key>        — fetch one (resolved value)
// PUT    /api/agents/prompts  body:{key,content,edited_by?}  — save override
// DELETE /api/agents/prompts?key=<key>        — remove override (revert to fs)
// GET    /api/agents/prompts/history?key=...  — change history

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROMPT_REGISTRY, loadPromptSync, invalidatePrompt } from '@/lib/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  // Fetch all overrides once
  const { data: overrides } = await admin.schema('docs').from('agent_prompt_overrides')
    .select('prompt_key, content, description, category, edited_by, edited_at, is_active');
  const map = new Map<string, any>((overrides || []).map((o: any) => [o.prompt_key, o]));

  if (key) {
    // Single prompt — resolved value (DB override > fs)
    const fs = loadPromptSync(key);
    const ov = map.get(key);
    return NextResponse.json({
      ok: true,
      key,
      fs_content: fs,
      override_content: ov?.content ?? null,
      effective_content: ov?.is_active && ov?.content ? ov.content : fs,
      has_override: !!ov?.is_active,
      edited_by: ov?.edited_by ?? null,
      edited_at: ov?.edited_at ?? null,
      registry: PROMPT_REGISTRY.find(r => r.key === key) || null,
    });
  }

  // List all prompts in the registry + their override status
  const items = PROMPT_REGISTRY.map(r => {
    const fs = loadPromptSync(r.key);
    const ov = map.get(r.key);
    return {
      ...r,
      has_override: !!ov?.is_active,
      fs_chars: fs.length,
      override_chars: ov?.content?.length ?? 0,
      edited_by: ov?.edited_by ?? null,
      edited_at: ov?.edited_at ?? null,
    };
  });
  return NextResponse.json({ ok: true, items });
}

export async function PUT(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: { key?: string; content?: string; edited_by?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  if (!body.key || typeof body.content !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing key or content' }, { status: 400 });
  }
  if (!PROMPT_REGISTRY.find(r => r.key === body.key)) {
    return NextResponse.json({ ok: false, error: 'unknown prompt key' }, { status: 400 });
  }

  const reg = PROMPT_REGISTRY.find(r => r.key === body.key)!;

  const { error } = await admin.schema('docs').from('agent_prompt_overrides')
    .upsert({
      prompt_key: body.key,
      content: body.content,
      description: reg.label,
      category: reg.category,
      edited_by: body.edited_by || 'PBS',
      edited_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'prompt_key' });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  invalidatePrompt(body.key);
  return NextResponse.json({ ok: true, saved: body.key });
}

export async function DELETE(req: NextRequest) {
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }
  const key = new URL(req.url).searchParams.get('key');
  if (!key) return NextResponse.json({ ok: false, error: 'missing key' }, { status: 400 });

  const { error } = await admin.schema('docs').from('agent_prompt_overrides')
    .delete().eq('prompt_key', key);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  invalidatePrompt(key);
  return NextResponse.json({ ok: true, removed: key });
}
