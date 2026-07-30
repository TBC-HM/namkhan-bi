// app/api/dataroom/rooms/[roomId]/route.ts — internal room detail + actions.
// Brief dataroom-module-v1.
//   GET  → sections + items + grants + access log (bridge views)
//   POST → {action: add_item | invite | revoke | retire_item | set_slot_state}
// Snapshot mechanics (research R2): registry docs with a storage object are
// PHYSICALLY COPIED into the private 'dataroom' bucket at link time
// (rooms/<roomId>/items/<itemId>/<file>); markdown-only docs are frozen
// DB-side inside fn_dataroom_add_item. Version-pinning was rejected —
// dms.documents mutates in place, so only a copy survives source edits (A3c).
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { roomId: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const sb = getSupabaseAdmin();
  const [room, sections, items, grants, log] = await Promise.all([
    sb.from('v_dataroom_rooms').select('*').eq('id', params.roomId).maybeSingle(),
    sb.from('v_dataroom_sections').select('*').eq('room_id', params.roomId).order('sort'),
    sb.from('v_dataroom_items').select('*').eq('room_id', params.roomId).order('added_at'),
    sb.from('v_dataroom_grants').select('*').eq('room_id', params.roomId).order('granted_at', { ascending: false }),
    sb.from('v_dataroom_access_log').select('*').eq('room_id', params.roomId).order('at', { ascending: false }).limit(200),
  ]);
  if (room.error || !room.data) return NextResponse.json({ error: 'room_not_found' }, { status: 404 });
  return NextResponse.json({
    room: room.data,
    sections: sections.data ?? [],
    items: items.data ?? [],
    grants: grants.data ?? [],
    access_log: log.data ?? [],
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {}
  const action = String(body.action ?? '');
  const sb = getSupabaseAdmin();

  if (action === 'invite') {
    const email = String(body.email ?? '').trim();
    if (!email.includes('@')) return NextResponse.json({ error: 'email_required' }, { status: 400 });
    const { data, error } = await sb.rpc('fn_dataroom_invite', {
      p_room_id: params.roomId,
      p_email: email,
      p_display_name: body.display_name ? String(body.display_name) : null,
      p_expires_days: body.expires_days === null ? null : Number(body.expires_days ?? 30),
      p_can_download: Boolean(body.can_download),
      p_granted_by: 'cockpit',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'revoke') {
    const { data, error } = await sb.rpc('fn_dataroom_revoke', { p_grant_id: String(body.grant_id ?? '') });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { revoked: false });
  }

  if (action === 'retire_item') {
    const { data, error } = await sb.rpc('fn_dataroom_retire_item', {
      p_item_id: String(body.item_id ?? ''),
      p_reason: String(body.reason ?? 'retired from cockpit'),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? { retired: false });
  }

  if (action === 'set_slot_state') {
    const state = String(body.state ?? 'auto');
    if (!['auto', 'waived', 'na'].includes(state)) {
      return NextResponse.json({ error: 'bad_state' }, { status: 400 });
    }
    const { data, error } = await sb.rpc('fn_dataroom_set_slot_state', {
      p_section_id: String(body.section_id ?? ''), p_state: state,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? {});
  }

  if (action === 'add_item') {
    const kind = String(body.kind ?? '');
    const sectionId = String(body.section_id ?? '');
    if (!sectionId) return NextResponse.json({ error: 'section_required' }, { status: 400 });
    const itemId = randomUUID();
    let title = String(body.title ?? '').trim();
    let mode: string | null = null;
    let sourceRef: Record<string, unknown> | null = null;
    let snapshotRef: Record<string, unknown> | null = null;
    let noteMd: string | null = null;

    if (kind === 'note') {
      noteMd = String(body.note_md ?? '');
      if (!title) title = 'Note';
    } else if (kind === 'media_asset') {
      const assetId = String(body.asset_id ?? '');
      if (!assetId) return NextResponse.json({ error: 'asset_id_required' }, { status: 400 });
      mode = 'live_link';
      sourceRef = { asset_id: assetId };
      if (!title) title = `Media asset ${assetId.slice(0, 8)}`;
    } else if (kind === 'registry_doc') {
      const docId = String(body.doc_id ?? '');
      mode = body.mode === 'live_link' ? 'live_link' : 'snapshot';
      if (!docId) return NextResponse.json({ error: 'doc_id_required' }, { status: 400 });
      const { data: doc, error: docErr } = await sb.from('v_documents_registry')
        .select('doc_id,title,file_name,storage_bucket,storage_path,mime,file_size_bytes')
        .eq('doc_id', docId).maybeSingle();
      if (docErr || !doc) return NextResponse.json({ error: 'doc_not_found' }, { status: 404 });
      sourceRef = { doc_id: docId };
      if (!title) title = String(doc.title ?? 'Document');
      if (mode === 'snapshot' && doc.storage_bucket && doc.storage_path) {
        // physical copy into the private dataroom bucket (research R2)
        const { data: blob, error: dlErr } = await sb.storage
          .from(String(doc.storage_bucket)).download(String(doc.storage_path));
        if (dlErr || !blob) return NextResponse.json({ error: 'source_download_failed' }, { status: 500 });
        const fileName = String(doc.file_name ?? 'document').replace(/[^\w. -]+/g, '_');
        const destPath = `rooms/${params.roomId}/items/${itemId}/${fileName}`;
        const buf = Buffer.from(await blob.arrayBuffer());
        const { error: upErr } = await sb.storage.from('dataroom')
          .upload(destPath, buf, { contentType: String(doc.mime ?? 'application/octet-stream'), upsert: true });
        if (upErr) return NextResponse.json({ error: `copy_failed: ${upErr.message}` }, { status: 500 });
        snapshotRef = {
          copied_path: destPath,
          copied_bucket: 'dataroom',
          mime: doc.mime ?? null,
          file_size_bytes: doc.file_size_bytes ?? null,
          source_bucket: doc.storage_bucket,
          source_path: doc.storage_path,
        };
      }
    } else {
      return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
    }

    const { data, error } = await sb.rpc('fn_dataroom_add_item', {
      p_id: itemId,
      p_room_id: params.roomId,
      p_section_id: sectionId,
      p_title: title,
      p_kind: kind,
      p_mode: mode,
      p_source_ref: sourceRef,
      p_snapshot_ref: snapshotRef,
      p_note_md: noteMd,
      p_download_allowed: Boolean(body.download_allowed),
      p_added_by: 'cockpit',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}
