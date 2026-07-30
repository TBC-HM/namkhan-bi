// app/api/room/[token]/item/[itemId]/route.ts — external guest item serving.
// Brief dataroom-module-v1. Token-gated: public.fn_dataroom_guest_item
// (SECURITY DEFINER) re-validates the grant per request, enforces
// can_download × item.download_allowed, and writes the access_log row
// (view / download / denied_download) BEFORE any bytes leave.
//
// Serving matrix:
//  - note                      → markdown as text/plain (inline)
//  - registry_doc snapshot     → frozen copy in the private 'dataroom' bucket
//                                (copied_path) or frozen body_markdown
//  - registry_doc live_link    → re-resolved dms source (bucket/path or body)
//  - media_asset live_link     → resolve via v_marketing_media_page (same
//                                bucket logic as /api/marketing/media/preview)
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { token: string; itemId: string } }

interface GuestItem {
  allowed: boolean;
  reason?: string;
  guest_email?: string;
  item?: {
    id: string; title: string; kind: string; mode: string | null;
    source_ref: Record<string, unknown> | null;
    snapshot_ref: Record<string, unknown> | null;
    note_md: string | null; download_allowed: boolean;
  };
  resolved?: {
    storage_bucket: string | null; storage_path: string | null;
    mime: string | null; body_markdown: string | null; title: string | null;
  } | null;
}

function textResponse(body: string, filename: string, download: boolean): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/"/g, '')}.md"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const mode = req.nextUrl.searchParams.get('mode') === 'download' ? 'download' : 'view';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
  const ua = req.headers.get('user-agent') ?? '';

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_dataroom_guest_item', {
    p_token: params.token, p_item_id: params.itemId, p_action: mode, p_ip: ip, p_ua: ua,
  });
  if (error) return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const g = data as GuestItem;
  if (!g.allowed) return NextResponse.json({ error: g.reason ?? 'not_permitted' }, { status: 403 });
  const item = g.item!;
  const asDownload = mode === 'download';

  // 1) note → markdown text
  if (item.kind === 'note') {
    return textResponse(item.note_md ?? '(empty note)', item.title, asDownload);
  }

  // 2) media asset (live_link) — resolve like /api/marketing/media/preview
  if (item.kind === 'media_asset') {
    const assetId = String(item.source_ref?.asset_id ?? '');
    if (!assetId) return NextResponse.json({ error: 'no_asset_ref' }, { status: 404 });
    const { data: row } = await sb.from('v_marketing_media_page')
      .select('raw_path,master_path,mime_type,is_ai_generated')
      .eq('asset_id', assetId).maybeSingle();
    if (!row || (!row.raw_path && !row.master_path)) {
      return NextResponse.json({ error: 'asset_not_found' }, { status: 404 });
    }
    let bucket: string; let path: string;
    if (row.master_path) {
      bucket = row.is_ai_generated ? 'media-ai' : 'media-renders';
      path = row.master_path as string;
    } else if ((row.raw_path as string).startsWith('branding/')) {
      bucket = 'branding';
      path = (row.raw_path as string).replace(/^branding\//, '');
    } else {
      bucket = 'media-raw';
      path = row.raw_path as string;
    }
    return streamObject(sb, bucket, path, (row.mime_type as string) ?? 'image/jpeg', item.title, asDownload);
  }

  // 3) registry_doc snapshot — frozen copy in private dataroom bucket, or frozen markdown
  if (item.mode === 'snapshot') {
    const snap = item.snapshot_ref ?? {};
    const copiedPath = snap.copied_path ? String(snap.copied_path) : null;
    if (copiedPath) {
      return streamObject(sb, 'dataroom', copiedPath,
        snap.mime ? String(snap.mime) : 'application/octet-stream', item.title, asDownload);
    }
    if (snap.body_markdown) {
      return textResponse(String(snap.body_markdown), item.title, asDownload);
    }
    return NextResponse.json({ error: 'snapshot_empty' }, { status: 404 });
  }

  // 4) registry_doc live_link — re-resolved source from the RPC
  const res = g.resolved;
  if (res?.storage_bucket && res.storage_path) {
    return streamObject(sb, res.storage_bucket, res.storage_path,
      res.mime ?? 'application/octet-stream', item.title, asDownload);
  }
  if (res?.body_markdown) {
    return textResponse(res.body_markdown, item.title, asDownload);
  }
  return NextResponse.json({ error: 'source_unavailable' }, { status: 404 });
}

async function streamObject(
  sb: ReturnType<typeof getSupabaseAdmin>,
  bucket: string, path: string, mime: string, title: string, asDownload: boolean,
): Promise<Response> {
  const { data: blob, error } = await sb.storage.from(bucket).download(path);
  if (error || !blob) return NextResponse.json({ error: 'download_failed' }, { status: 500 });
  const buf = await blob.arrayBuffer();
  const safe = title.replace(/[^\w. -]+/g, '_').slice(0, 120) || 'document';
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': blob.type || mime,
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${safe}"`,
      'Cache-Control': 'no-store',
    },
  });
}
