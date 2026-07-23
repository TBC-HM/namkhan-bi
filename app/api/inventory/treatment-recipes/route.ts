// app/api/inventory/treatment-recipes/route.ts
// Upserts spa treatment recipes (up to 5 products per treatment).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const { treatment_name, property_id, rows } = await req.json() as {
      treatment_name: string;
      property_id: number;
      rows: Array<{ sort_order: number; item_id: string; qty_per_treatment: number; notes: string | null }>;
    };
    if (!treatment_name || !property_id || !rows?.length) {
      return NextResponse.json({ error: 'treatment_name, property_id, rows required' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    // Delete existing rows for this treatment then insert fresh
    await sb.schema('inv').from('treatment_recipes')
      .delete()
      .eq('treatment_name', treatment_name)
      .eq('property_id', property_id);

    const { error } = await sb.schema('inv').from('treatment_recipes').insert(
      rows.map(r => ({ ...r, treatment_name, property_id }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, rows: rows.length }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
