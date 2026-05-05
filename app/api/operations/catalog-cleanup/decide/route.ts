// POST /api/operations/catalog-cleanup/decide
// Records F&B manager's decision on a dirty SKU surfaced by v_catalog_dirty.
// Idempotent: open decision per (description, item_category_name) is unique;
// re-posting updates the existing row instead of creating a duplicate.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

interface Body {
  description: string;
  item_category_name: string | null;
  action_type:
    | 'merge_into'
    | 'split_variants'
    | 'set_usali'
    | 'rename'
    | 'set_price'
    | 'set_category'
    | 'dismiss'
    | 'todo';
  target_description?: string | null;
  target_usali_dept?: string | null;
  target_usali_subdept?: string | null;
  target_category?: string | null;
  target_price_usd?: number | null;
  notes?: string | null;
  decided_by?: string | null;
}

const ALLOWED: Body['action_type'][] = [
  'merge_into', 'split_variants', 'set_usali', 'rename',
  'set_price', 'set_category', 'dismiss', 'todo',
];

export async function POST(req: Request) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.description || typeof body.description !== 'string') {
    return NextResponse.json({ error: 'description_required' }, { status: 400 });
  }
  if (!ALLOWED.includes(body.action_type)) {
    return NextResponse.json({ error: 'action_type_invalid' }, { status: 400 });
  }

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) {
    return NextResponse.json({ error: 'supabase_admin_unavailable', detail: e?.message }, { status: 500 });
  }

  // Upsert by (description, item_category_name, status='open')
  const row = {
    description: body.description.trim(),
    item_category_name: (body.item_category_name?.trim() || null),
    action_type: body.action_type,
    target_description: body.target_description?.trim() || null,
    target_usali_dept: body.target_usali_dept?.trim() || null,
    target_usali_subdept: body.target_usali_subdept?.trim() || null,
    target_category: body.target_category?.trim() || null,
    target_price_usd: body.target_price_usd ?? null,
    notes: body.notes?.trim() || null,
    decided_by: body.decided_by?.trim() || 'fnb-manager',
    status: 'open' as const,
  };

  // Idempotent upsert by (description, item_category_name, status='open').
  // Fetch any open decision matching this SKU first, update if found, else insert.
  let existingId: number | null = null;
  {
    let q = admin
      .from('catalog_cleanup_decisions')
      .select('id')
      .eq('description', row.description)
      .eq('status', 'open');
    q = row.item_category_name === null
      ? q.is('item_category_name', null)
      : q.eq('item_category_name', row.item_category_name);
    const { data: existing, error: lookupErr } = await q.maybeSingle();
    if (lookupErr) {
      return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    }
    existingId = existing?.id ?? null;
  }

  if (existingId != null) {
    const { error } = await admin
      .from('catalog_cleanup_decisions')
      .update({ ...row, decided_at: new Date().toISOString() })
      .eq('id', existingId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: true, id: existingId });
  }

  const { data, error } = await admin
    .from('catalog_cleanup_decisions')
    .insert(row)
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: true, id: data?.id });
}

// PATCH /api/operations/catalog-cleanup/decide?id=N — flip status (applied / rejected)
export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const idStr = url.searchParams.get('id');
  const status = url.searchParams.get('status');
  if (!idStr || !['applied', 'rejected', 'open'].includes(status || '')) {
    return NextResponse.json({ error: 'id_and_status_required' }, { status: 400 });
  }
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e: any) {
    return NextResponse.json({ error: 'supabase_admin_unavailable', detail: e?.message }, { status: 500 });
  }
  const update: Record<string, unknown> = { status };
  if (status === 'applied') update.applied_at = new Date().toISOString();
  const { error } = await admin
    .from('catalog_cleanup_decisions')
    .update(update)
    .eq('id', Number(idStr));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
