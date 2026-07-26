// app/api/specs/attachments/route.ts
// v2 2026-07-26 (spec-builder completion): uploads now land in the PUBLIC
// bucket `spec-attachments` (mirror of the university-shots pattern) so the
// returned URL actually serves. Previous path (documents-internal, private
// bucket + getPublicUrl) returned dead links — documents-internal stays
// private and untouched. Response contract {url, path} unchanged.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const BUCKET = 'spec-attachments';

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const moduleName = (fd.get('module') as string | null) ?? 'spec';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    if (!allowed.includes(ext)) return NextResponse.json({ error: 'Image files only (png/jpg/webp/gif)' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const path = `${moduleName.replace(/[^a-z0-9-]/gi, '-')}-${Date.now()}.${ext}`;

    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl, path }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
