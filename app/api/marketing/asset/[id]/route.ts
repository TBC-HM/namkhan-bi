// GET /api/marketing/asset/[id]
// Fetches a single asset for the right-drawer detail view.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const { data, error } = await supabase
    .schema('marketing')
    .from('v_media_ready')
    .select('*')
    .eq('asset_id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ asset_id: id }, { status: 404 });
  }
  return NextResponse.json(data);
}
