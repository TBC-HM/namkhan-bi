// app/api/reports/studio/templates/route.ts
// Spreadsheet Studio v1 — list + save templates.
// Save goes through public.fn_studio_save_template (version-forward upsert;
// reports.studio_templates_history snapshots every UPDATE — never-overwrite law).

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sanitizeDefinition } from '@/lib/studio/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get('property_id')) || 260955;
  const { data, error } = await supabase
    .from('v_studio_templates')
    .select('id, property_id, name, definition, owner, version, status, updated_at')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const propertyId = Number(body.property_id) || 0;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const def = sanitizeDefinition(body.definition);
  if (!propertyId || !name || !def) {
    return NextResponse.json({ error: 'property_id, name and a valid definition are required' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('fn_studio_save_template', {
    p_property_id: propertyId,
    p_name: name,
    p_definition: def,
    p_owner: typeof body.owner === 'string' ? body.owner.slice(0, 60) : 'pbs',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data, saved: true });
}
