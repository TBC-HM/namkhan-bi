/**
 * GET /api/parity/breaches-count
 * Returns active parity breach count for the frontend badge — ticket #596
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 300; // ISR: revalidate every 5 min

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call the DB helper function defined in parity_setup.sql
    const { data, error } = await supabase
      .schema('revenue')
      .rpc('active_breach_count');

    if (error) throw new Error(error.message);

    return NextResponse.json({
      count: Number(data ?? 0),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/parity/breaches-count]', (err as Error).message);
    return NextResponse.json({ count: 0, fetchedAt: new Date().toISOString() });
  }
}
