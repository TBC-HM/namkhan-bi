// app/api/marketing/media/download-webp/route.ts
// GET ?asset_id=…&channel=web_hero — convert master → WebP q85 with EXIF GPS injection.
// GPS coords come from property.location (lat/lng). Skipped if is_hotel_property=false
// or property has no coords.
// PBS 2026-07-14 — Media QA v2 upgrade #4.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://kpenyneooigsyuuomgct.supabase.co';

function decDegToRational(dec: number): [[number, number], [number, number], [number, number]] {
  const abs = Math.abs(dec);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const secFloat = (minFloat - min) * 60;
  const sec = Math.round(secFloat * 10000);
  return [[deg, 1], [min, 1], [sec, 10000]];
}

export async function GET(req: NextRequest) {
  const asset_id = req.nextUrl.searchParams.get('asset_id');
  const channel  = req.nextUrl.searchParams.get('channel') ?? 'web_hero';
  if (!asset_id) return NextResponse.json({ error: 'asset_id required' }, { status: 400 });

  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }

  const { data: asset } = await sb.from('v_marketing_media_page')
    .select('asset_id, property_id, original_filename, master_path, raw_path, is_ai_generated, is_hotel_property, seo_target_filename')
    .eq('asset_id', asset_id).maybeSingle();
  if (!asset?.master_path && !asset?.raw_path) {
    return NextResponse.json({ error: 'asset_not_found' }, { status: 404 });
  }

  const bucket = asset.master_path
    ? (asset.is_ai_generated ? 'media-ai' : 'media-renders')
    : ((asset.raw_path ?? '').startsWith('branding/') ? 'branding' : 'media-raw');
  const path = asset.master_path
    ?? ((asset.raw_path ?? '').startsWith('branding/') ? asset.raw_path!.replace(/^branding\//, '') : asset.raw_path!);

  // Fetch source via signed URL (works for public + private buckets).
  const { data: signed, error: sErr } = await sb.storage.from(bucket).createSignedUrl(path, 900);
  if (sErr || !signed?.signedUrl) {
    return NextResponse.json({ error: 'sign_failed', detail: sErr?.message }, { status: 500 });
  }
  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok) return NextResponse.json({ error: 'upstream_fetch_failed', status: upstream.status }, { status: 502 });
  const inputBuf = Buffer.from(await upstream.arrayBuffer());

  // Fetch property coords only if hotel-property.
  let gps: { lat: number; lng: number } | null = null;
  if (asset.is_hotel_property !== false && asset.property_id) {
    const { data: loc } = await sb.schema('property' as any).from('location')
      .select('latitude, longitude').eq('property_id', asset.property_id).maybeSingle();
    if (loc?.latitude != null && loc?.longitude != null) {
      gps = { lat: Number(loc.latitude), lng: Number(loc.longitude) };
    } else {
      // Fallback via public bridge if the schema call didn't resolve.
      const { data: loc2 } = await sb.from('v_property_display')
        .select('latitude, longitude').eq('property_id', asset.property_id).maybeSingle();
      if (loc2?.latitude != null && loc2?.longitude != null) {
        gps = { lat: Number(loc2.latitude), lng: Number(loc2.longitude) };
      }
    }
  }

  let pipeline = sharp(inputBuf).webp({ quality: 85 });
  if (gps) {
    try {
      pipeline = pipeline.withExif({
        IFD0: {
          GPSLatitudeRef: gps.lat >= 0 ? 'N' : 'S',
          GPSLatitude: decDegToRational(gps.lat).flat().join(',') as any,
          GPSLongitudeRef: gps.lng >= 0 ? 'E' : 'W',
          GPSLongitude: decDegToRational(gps.lng).flat().join(',') as any,
        } as any,
      } as any);
    } catch { /* sharp EXIF write is best-effort; still return WebP */ }
  }

  const outBuf = await pipeline.toBuffer();

  const stem = (asset.seo_target_filename && asset.seo_target_filename.replace(/\.webp$/i, ''))
            || (asset.original_filename ?? asset.asset_id).replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const filename = `${stem}.webp`;

  return new NextResponse(outBuf as any, {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(outBuf.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0',
      'X-Namkhan-GPS': gps ? 'embedded' : 'omitted',
      'X-Namkhan-Channel': channel,
    },
  });
}
