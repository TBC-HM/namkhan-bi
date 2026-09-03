// app/api/cron/social-push/route.ts
// PBS 2026-09-03 — auto-push scheduled social posts whose scheduled_at <= now().
// Called by a pg_cron job (see db/proposed/social-push-cron.sql) every 5 min.
// Also callable manually via GET for testing.
//
// Auth: CRON_SECRET header (must match CRON_SECRET env var).
// Returns: { ok, due, pushed, failed, errors[] }
//
// pg_cron entry (apply after PBS approval):
//   SELECT cron.schedule(
//     'social-push-due',
//     '*/5 * * * *',
//     $$SELECT net.http_get(
//       url := current_setting('app.site_url') || '/api/cron/social-push',
//       headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret'))
//     )$$
//   );

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? '';

export async function GET(req: NextRequest) {
  // Basic auth — reject if secret not set or doesn't match
  if (CRON_SECRET) {
    const provided = req.headers.get('x-cron-secret') ?? '';
    if (provided !== CRON_SECRET) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = getSupabaseAdmin();

  // Find all scheduled posts whose time has arrived
  const { data: duePosts, error: qErr } = await sb
    .from('v_social_posts')
    .select('post_id,property_id,platform,scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20); // safety cap per run

  if (qErr) {
    return NextResponse.json({ ok: false, error: qErr.message }, { status: 500 });
  }

  const due = duePosts?.length ?? 0;
  if (due === 0) {
    return NextResponse.json({ ok: true, due: 0, pushed: 0, failed: 0, errors: [] });
  }

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const post of (duePosts ?? [])) {
    try {
      const { error: pushErr } = await sb.functions.invoke('social-push', {
        body: { mode: 'push', post_id: post.post_id, property_id: post.property_id },
      });
      if (pushErr) {
        failed++;
        errors.push(`${post.post_id}: ${pushErr.message}`);
      } else {
        pushed++;
      }
    } catch (e: any) {
      failed++;
      errors.push(`${post.post_id}: ${String(e?.message ?? e)}`);
    }
  }

  return NextResponse.json({ ok: true, due, pushed, failed, errors });
}
