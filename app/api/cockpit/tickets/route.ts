import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cockpit/tickets — cacheable read endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const arm = searchParams.get('arm');
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

  let query = supabase
    .from('cockpit_tickets')
    .select('id, created_at, updated_at, source, arm, intent, status, parsed_summary, github_issue_url')
    .order('id', { ascending: false })
    .limit(limit);

  if (status) query = query.eq('status', status);
  if (arm) query = query.eq('arm', arm);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    status: 200,
    headers: {
      // Public CDN + browser cache: fresh for 30s, stale-while-revalidate for 60s
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'Vary': 'Accept-Encoding',
    },
  });
}
