import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { p_message?: string; p_requested_by?: string };
    const { p_message, p_requested_by = 'cockpit_chat' } = body;

    if (!p_message || typeof p_message !== 'string') {
      return NextResponse.json(
        { error: 'p_message is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc('search_media_chat', {
      p_message,
      p_requested_by,
    });

    if (error) {
      console.error('[media-search] RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // The RPC returns an array of rows. parsed_intent is a top-level field
    // on the first row (same value repeated on every row — we hoist it).
    // Assumption: parsed_intent is a column on each returned row (not a
    // separate top-level key in the RPC response object), so we extract
    // it from row[0] and strip it from the individual result rows.
    const rows = (data ?? []) as Record<string, unknown>[];
    const parsed_intent: Record<string, unknown> =
      rows.length > 0 && rows[0].parsed_intent
        ? (rows[0].parsed_intent as Record<string, unknown>)
        : {};

    const results = rows.map((row) => {
      const { parsed_intent: _pi, ...rest } = row;
      void _pi; // consumed above
      return rest;
    });

    return NextResponse.json({
      results,
      count: results.length,
      parsed_intent,
    });
  } catch (err) {
    console.error('[media-search] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
