// POST /api/operations/staff/photo
// Upload a single staff avatar to the public "staff-photos" bucket and update
// ops.staff_employment.photo_path. Returns { ok, photo_path } or { error }.

import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const supa = getSupabaseAdmin();
    const fd = await req.formData();
    const file = fd.get('file');
    const staff_id = fd.get('staff_id');
    if (!file || !(file instanceof File)) return NextResponse.json({ ok: false, error: 'Missing file' }, { status: 400 });
    if (typeof staff_id !== 'string' || staff_id.length < 16) return NextResponse.json({ ok: false, error: 'Missing staff_id' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ ok: false, error: 'Image required' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'Max 5 MB' }, { status: 413 });

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = ['jpg','jpeg','png','webp','gif','heic','heif'].includes(ext) ? ext : 'jpg';
    const rand = crypto.randomBytes(6).toString('hex');
    const path = `${staff_id}/${rand}.${safeExt}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supa.storage.from('staff-photos').upload(path, buf, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

    const { error: rpcErr } = await supa.rpc('set_staff_photo', { p_staff_id: staff_id, p_path: path });
    if (rpcErr) {
      return NextResponse.json({ ok: false, error: rpcErr.message, photo_path: path }, { status: 500 });
    }

    return NextResponse.json({ ok: true, photo_path: path });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
