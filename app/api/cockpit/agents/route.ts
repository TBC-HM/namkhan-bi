import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/cockpit/agents — cacheable read endpoint
export async function GET(_req: NextRequest) {
  const { data, error } = await supabase
    .from('cockpit_agent_identity')
    .select('id, name, role, description, status, created_at')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], {
    status: 200,
    headers: {
      // Agent roster changes rarely — cache for 5 min, SWR for 10 min
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Vary': 'Accept-Encoding',
    },
  });
}
