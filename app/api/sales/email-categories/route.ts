// CRUD for sales.email_categories + sales.email_category_rules
//   GET  /api/sales/email-categories            → { categories, rules }
//   POST /api/sales/email-categories            → create category   (body: {key,label,display_order,description})
//   PATCH /api/sales/email-categories?type=cat  → update category
//   DELETE /api/sales/email-categories?type=cat&key=xxx
//   POST /api/sales/email-categories?type=rule  → create rule
//   PATCH /api/sales/email-categories?type=rule → update rule
//   DELETE /api/sales/email-categories?type=rule&id=uuid

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getSupabaseAdmin();
  const [{ data: categories }, { data: rules }] = await Promise.all([
    sb.schema('sales').from('email_categories').select('*').order('display_order'),
    sb.schema('sales').from('email_category_rules').select('*').order('priority'),
  ]);
  return NextResponse.json({ categories: categories ?? [], rules: rules ?? [] });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'cat';
  const sb = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  if (type === 'cat') {
    const { data, error } = await sb.schema('sales').from('email_categories').insert({
      key: body.key,
      label: body.label,
      display_order: body.display_order ?? 100,
      description: body.description ?? null,
      active: body.active ?? true,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, category: data });
  }
  if (type === 'rule') {
    const { data, error } = await sb.schema('sales').from('email_category_rules').insert({
      category_key: body.category_key,
      match_field: body.match_field,
      match_op: body.match_op ?? 'ilike',
      pattern: body.pattern,
      priority: body.priority ?? 100,
      active: body.active ?? true,
      notes: body.notes ?? null,
    }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rule: data });
  }
  return NextResponse.json({ error: 'unknown type' }, { status: 400 });
}

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'cat';
  const sb = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  if (type === 'cat') {
    if (!body.key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ['label','display_order','description','active','default_category']) {
      if (k in body) update[k] = body[k];
    }
    const { data, error } = await sb.schema('sales').from('email_categories')
      .update(update).eq('key', body.key).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, category: data });
  }
  if (type === 'rule') {
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ['category_key','match_field','match_op','pattern','priority','active','notes']) {
      if (k in body) update[k] = body[k];
    }
    const { data, error } = await sb.schema('sales').from('email_category_rules')
      .update(update).eq('id', body.id).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rule: data });
  }
  return NextResponse.json({ error: 'unknown type' }, { status: 400 });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'cat';
  const sb = getSupabaseAdmin();
  if (type === 'cat') {
    const key = url.searchParams.get('key');
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const { error } = await sb.schema('sales').from('email_categories').delete().eq('key', key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (type === 'rule') {
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await sb.schema('sales').from('email_category_rules').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown type' }, { status: 400 });
}
