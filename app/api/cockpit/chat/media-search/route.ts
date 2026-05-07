// app/api/cockpit/chat/media-search/route.ts
// ticket #114 — media search chat route
// Calls marketing.search_media_chat RPC; returns { results, count, parsed_intent }

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface MediaSearchRow {
  asset_id: string;
  filename: string;
  thumbnail_url: string | null;
  qc_score: number | null;
  tier: string | null;
  asset_type: string | null;
  caption: string | null;
  alt_text: string | null;
  tag_slugs: string[] | null;
}

interface SearchMediaChatResponse {
  results: MediaSearchRow[];
  parsed_intent: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { message?: string; requested_by?: string };
  const p_message = body.message?.trim() ?? '';
  const p_requested_by = body.requested_by ?? 'cockpit_chat';

  if (!p_message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
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

  // The RPC returns a single JSONB row: { results: [...], parsed_intent: {...} }
  const payload = data as SearchMediaChatResponse | null;
  const results: MediaSearchRow[] = payload?.results ?? [];
  const parsed_intent: Record<string, unknown> = payload?.parsed_intent ?? {};

  return NextResponse.json({
    results,
    count: results.length,
    parsed_intent,
  });
}
