// app/api/marketing/factsheets/route.ts
// PBS 2026-07-16 (item 5) — GET marketing factsheets (public.v_marketing_factsheets bridge).
//   GET ?deal_type=fit → { rows: [...] } filtered to factsheets tagged with that deal type
//                        OR untagged (universal). Also returns factsheets for null property_id.
//   GET (no filter)   → every factsheet for Namkhan.
// Used by the proposal composer dropdown + the /marketing/factsheets page.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dealType = url.searchParams.get('deal_type');
    const pid = Number(url.searchParams.get('property_id') || NAMKHAN);

    const sb = getSupabaseAdmin();
    let q = sb.from('v_marketing_factsheets')
      .select('doc_id, property_id, title, body_markdown, file_name, mime, file_size_bytes, storage_bucket, storage_path, external_url, for_deal_types, tags, updated_at, created_at')
      .or('property_id.eq.' + pid + ',property_id.is.null')
      .order('created_at', { ascending: false });

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });

    let rows = (data ?? []) as Array<Record<string, any>>;
    if (dealType) {
      rows = rows.filter((r) => {
        const arr = (r.for_deal_types ?? []) as string[];
        return arr.length === 0 || arr.includes(dealType);
      });
    }
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), rows: [] }, { status: 500 });
  }
}
