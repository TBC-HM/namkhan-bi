// app/api/mail/message/[id]/attachment/[attachmentId]/save-to-docs/route.ts
// PBS 2026-07-16 (item 6) — save a mail attachment straight into dms.documents.
// Flow:
//   1. Auth = the signed-in user (Gmail-scope access).
//   2. Fetch the raw bytes via lib/userGmail.getAttachmentBytes.
//   3. Upload to Supabase Storage bucket `dms-docs` at
//      mail-imports/{yyyy-mm-dd}/{msgId}/{attachmentId}-{filename}.
//   4. INSERT a dms.documents row via getSupabaseAdmin() (service role bypasses
//      the PostgREST public-only rule — see MEMORY §0.5).
//   5. Return { ok: true, doc_id } so the client can toast + link.
// Body (JSON, all optional except title):
//   { title, doc_type, tags[], filename, mime, size, property_id? }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser, getAttachmentBytes } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;
const BUCKET = 'dms-docs';

interface Body {
  title?: string;
  doc_type?: string;
  tags?: string[];
  filename?: string;
  mime?: string;
  size?: number;
  property_id?: number;
}

function sanitize(name: string): string {
  return name.replace(/[^\w\.\-]+/g, '_').slice(0, 128) || 'attachment';
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const { id: msgId, attachmentId } = await ctx.params;
  let body: Body = {};
  try { body = await req.json(); } catch { body = {}; }

  try {
    // 1. Fetch bytes from Gmail (reuses the same helper as the download route).
    const { data, mimeType, filename, size } = await getAttachmentBytes(user.id, msgId, attachmentId);

    // 2. Path: mail-imports/{yyyy-mm-dd}/{msgId}/{attachmentId}-{safeName}
    const day = new Date().toISOString().slice(0, 10);
    const safeName = sanitize(body.filename ?? filename);
    const path = 'mail-imports/' + day + '/' + msgId + '/' + attachmentId + '-' + safeName;

    const sb = getSupabaseAdmin();

    // 3. Upload to storage.
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, data, {
      contentType: body.mime ?? mimeType,
      upsert: true,
    });
    if (upErr) {
      return NextResponse.json({ error: 'storage_upload_failed: ' + upErr.message }, { status: 500 });
    }

    // 4. Insert dms.documents row via service role.
    const insertPayload = {
      property_id: body.property_id ?? NAMKHAN,
      doc_type: body.doc_type ?? 'other',
      title: (body.title && body.title.trim()) || filename,
      storage_bucket: BUCKET,
      storage_path: path,
      file_name: body.filename ?? filename,
      mime: body.mime ?? mimeType,
      file_size_bytes: body.size ?? size,
      status: 'active',
      language: 'en',
      source: 'mail_attachment',
      tags: Array.isArray(body.tags) && body.tags.length > 0 ? body.tags : ['mail-import'],
      raw: { gmail_message_id: msgId, gmail_attachment_id: attachmentId, saved_by: user.email },
    };

    const { data: doc, error: dbErr } = await sb
      .schema('dms')
      .from('documents')
      .insert(insertPayload)
      .select('doc_id')
      .single();
    if (dbErr) {
      // Best-effort cleanup of the uploaded blob to avoid orphans on DB failure.
      await sb.storage.from(BUCKET).remove([path]).catch(() => {});
      return NextResponse.json({ error: 'doc_insert_failed: ' + dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, doc_id: (doc as { doc_id: string }).doc_id, bucket: BUCKET, path });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'save_failed: ' + msg }, { status: 500 });
  }
}
