// app/api/cockpit/tickets/respond/route.ts
//
// POST { id, note, new_status? } — append note to ticket + optionally change status.

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://build-placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'build-placeholder-key',
);

export async function POST(req: Request) {
  noStore();
  const body = await req.json().catch(() => ({})) as {
    id?: number;
    note?: string;
    new_status?: string | null;
  };
  const id = Number(body.id);
  const note = (body.note ?? '').trim();
  if (!id || !note) {
    return NextResponse.json({ error: 'id and note required' }, { status: 400 });
  }
  const { data, error } = await supabase.rpc('fn_respond_ticket', {
    p_id: id,
    p_note: note,
    p_new_status: body.new_status ?? null,
  });
  if (error) {
    console.error('[cockpit/tickets/respond] rpc error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const updated = (data as any)?.updated ?? 0;
  if (updated === 0) {
    return NextResponse.json({ ok: false, error: `ticket #${id} not found` }, { status: 404 });
  }
  return NextResponse.json({ ok: true, updated, new_status: (data as any)?.new_status });
}
