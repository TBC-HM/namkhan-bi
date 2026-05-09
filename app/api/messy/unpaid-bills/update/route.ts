// app/api/messy/unpaid-bills/update/route.ts
// PBS 2026-05-09: classification dropdown on /messy-data unpaid-bills panel.
// Accepts JSON or form-encoded body; updates messy.unpaid_bills.human_status
// (and optional human_notes) by id. Single-owner v1 — service-role.

import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HUMAN_STATUSES = new Set(['', 'open', 'double', 'wrong_entry', 'paid_off_book', 'reconciled']);

export async function POST(req: Request) {
  noStore();
  const ct = req.headers.get('content-type') ?? '';
  let id: number | null = null;
  let human_status: string | null = null;
  let human_notes: string | null = null;
  let isForm = false;

  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    id = Number(body.id) || null;
    human_status = typeof body.human_status === 'string' ? body.human_status : null;
    human_notes  = typeof body.human_notes  === 'string' ? body.human_notes  : null;
  } else {
    isForm = true;
    const fd = await req.formData().catch(() => null);
    if (fd) {
      id = Number(fd.get('id')) || null;
      const hs = fd.get('human_status');
      const hn = fd.get('human_notes');
      human_status = typeof hs === 'string' ? hs : null;
      human_notes  = typeof hn === 'string' ? hn : null;
    }
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (human_status !== null && !HUMAN_STATUSES.has(human_status)) {
    return NextResponse.json({ error: 'invalid human_status' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (human_status !== null) patch.human_status = human_status === '' ? null : human_status;
  if (human_notes  !== null) patch.human_notes  = human_notes;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .schema('messy')
    .from('unpaid_bills')
    .update(patch)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Form submit: bounce back to /messy-data so the page re-renders with the new value.
  if (isForm) return NextResponse.redirect(new URL('/messy-data', req.url), 303);
  return NextResponse.json({ ok: true });
}
