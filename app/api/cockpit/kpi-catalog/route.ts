// app/api/cockpit/kpi-catalog/route.ts
// Wraps cockpit_kpi_catalog RPC. Returns the 29-entry KPI catalog.

import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('cockpit_kpi_catalog');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify(data ?? []), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
