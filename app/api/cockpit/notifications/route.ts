import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cockpit/notifications — cacheable read endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unseen = searchParams.get('unseen');
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

  let query = supabase
    .from('cockpit_pbs_notifications')
    .select('id, created_at, seen_at, pr_number, message, type')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unseen === 'true') query = query.is('seen_at', null);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    status: 200,
    headers: {
      // Notifications: short TTL so new items surface quickly
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      'Vary': 'Accept-Encoding',
    },
  });
}
