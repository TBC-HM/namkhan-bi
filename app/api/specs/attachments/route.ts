// app/api/specs/attachments/route.ts
// Uploads screenshot to Supabase Storage (documents-internal/spec-attachments/)
// Returns public URL embedded in the spec brief.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

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
    const path = `spec-attachments/${moduleName.replace(/[^a-z0-9-]/gi, '-')}-${Date.now()}.${ext}`;

    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from('documents-internal').upload(path, bytes, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: urlData } = sb.storage.from('documents-internal').getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl, path }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
