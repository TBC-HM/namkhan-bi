import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cockpit/audit — cacheable read endpoint
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get('agent');
  const action = searchParams.get('action');
  const ticketId = searchParams.get('ticket_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100);

  let query = supabase
    .from('cockpit_audit_log')
    .select('id, created_at, agent, action, ticket_id, details')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agent) query = query.eq('agent', agent);
  if (action) query = query.eq('action', action);
  if (ticketId) query = query.eq('ticket_id', Number(ticketId));

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    status: 200,
    headers: {
      // Audit log: shorter freshness window — 15s fresh, 45s SWR
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45',
      'Vary': 'Accept-Encoding',
    },
  });
}
