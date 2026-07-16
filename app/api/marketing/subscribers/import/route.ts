// app/api/marketing/subscribers/import/route.ts
// POST { rows: [{email,name?,tags?}], source, tags?[] }  → bulk upsert via fn_subscriber_bulk_upsert
// Auth: signed-in user cookie required. New rows opted_in_at=NULL (unconfirmed).
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row { email?: string; name?: string; tags?: string[] }
interface Body { rows?: Row[]; source?: string; tags?: string[]; notes?: string }

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const rows = Array.isArray(b.rows) ? b.rows : [];
  if (!rows.length) return NextResponse.json({ ok: false, error: 'no_rows' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const rpcArg = {
    source: b.source || 'manual',
    tags: b.tags || [],
    notes: b.notes || null,
    created_by: user.id,
    rows: rows
      .filter((r) => r && typeof r.email === 'string' && r.email.includes('@'))
      .slice(0, 5000)
      .map((r) => ({
        email: r.email!.trim().toLowerCase(),
        name: r.name ?? null,
        tags: Array.isArray(r.tags) ? r.tags : (b.tags ?? []),
      })),
  };

  const { data, error } = await admin.rpc('fn_subscriber_bulk_upsert', { p: rpcArg });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const result = (data ?? {}) as { ok?: boolean; ids?: number[]; inserted?: number; updated?: number; skipped?: number };
  const ids = result.ids ?? [];

  // Return fresh rows for optimistic UI hydration.
  let new_rows: unknown[] = [];
  if (ids.length) {
    const fresh = await admin
      .from('v_marketing_subscribers')
      .select('id, email, name, tags, source, opted_in_at, unsubscribed_at, bounced_at, notes, created_at, updated_at, is_active')
      .in('id', ids);
    new_rows = fresh.data ?? [];
  }

  return NextResponse.json({
    ok: true,
    inserted: result.inserted ?? 0,
    updated: result.updated ?? 0,
    skipped: result.skipped ?? 0,
    ids,
    new_rows,
  });
}
