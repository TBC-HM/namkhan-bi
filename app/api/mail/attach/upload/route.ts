// app/api/mail/attach/upload/route.ts
// POST multipart/form-data → { ok: true, url, name, size }
// Uploads one or more files into storage bucket `mail-attachments`
// (public read) and returns their public URLs.
// PBS 2026-07-17 · used by ComposeModal 📎 attach flow.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'mail-attachments';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_form' }, { status: 400 });
  }

  const files: File[] = [];
  for (const [, v] of form.entries()) {
    if (v instanceof File && v.size > 0) files.push(v);
  }
  if (files.length === 0) return NextResponse.json({ ok: false, error: 'no_files' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const uploaded: Array<{ url: string; name: string; size: number; content_type: string }> = [];
  const failures: Array<{ name: string; error: string }> = [];

  for (const f of files) {
    try {
      const safeName = f.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      const key = user.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safeName;
      const buf = new Uint8Array(await f.arrayBuffer());
      const { error } = await sb.storage.from(BUCKET).upload(key, buf, {
        contentType: f.type || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(key);
      uploaded.push({ url: pub.publicUrl, name: safeName, size: f.size, content_type: f.type || 'application/octet-stream' });
    } catch (e) {
      failures.push({ name: f.name, error: e instanceof Error ? e.message : 'upload_failed' });
    }
  }

  return NextResponse.json({ ok: uploaded.length > 0, uploaded, failures });
}
