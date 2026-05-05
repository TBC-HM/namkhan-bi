// app/api/compiler/runs/[id]/route.ts
// GET -> { run, variants[], deploy? }
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = getSupabaseAdmin();
  const id = params.id;
  const [{ data: run }, { data: variants }, { data: deploys }] = await Promise.all([
    admin.schema('compiler').from('runs').select('*').eq('id', id).maybeSingle(),
    admin.schema('compiler').from('variants').select('*').eq('run_id', id).order('label'),
    admin.schema('compiler').from('deploys').select('*').eq('run_id', id).order('created_at', { ascending: false }),
  ]);
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  return NextResponse.json({ run, variants: variants ?? [], deploys: deploys ?? [] });
}
