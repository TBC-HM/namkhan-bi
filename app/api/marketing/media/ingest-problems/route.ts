// app/api/marketing/media/ingest-problems/route.ts
// PBS 2026-07-17 · media-pipeline-frontend brief · SCOPE 6 — surface assets
// the ingest pipeline cannot auto-process:
//   - orphan raw paths (storage_path contains space or comma)
//   - retries >= 3 (stuck in the queue)
//   - tiff / heic / heif mime (needs manual conversion)
//   - failed / qc_failed status
// Read-only from public.v_media_ingest_status. Returns one row per problem
// with a human-readable `problem` label so LibraryTab can render straight away.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StatusRow {
  queue_id: number;
  status: string | null;
  storage_path: string | null;
  detected_mime: string | null;
  size_mb: number | null;
  retries: number | null;
  last_attempt_at: string | null;
  asset_id: string | null;
}

function classify(r: StatusRow): string | null {
  const mime = (r.detected_mime ?? '').toLowerCase();
  if (mime === 'image/tiff' || mime === 'image/heic' || mime === 'image/heif') return 'needs conversion (' + mime + ')';
  const path = r.storage_path ?? '';
  if (/[ ,]/.test(path)) return 'invalid characters in path';
  if ((r.retries ?? 0) >= 3) return 'ingest retries ≥ 3';
  const st = (r.status ?? '').toLowerCase();
  if (st === 'failed' || st === 'qc_failed' || st === 'error') return 'status: ' + st;
  return null;
}

export async function GET() {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }

  const { data, error } = await sb
    .from('v_media_ingest_status')
    .select('queue_id, status, storage_path, detected_mime, size_mb, retries, last_attempt_at, asset_id')
    .order('last_attempt_at', { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = ((data ?? []) as StatusRow[])
    .map(r => ({ ...r, problem: classify(r) }))
    .filter((r): r is StatusRow & { problem: string } => r.problem !== null);

  return NextResponse.json({ ok: true, rows });
}